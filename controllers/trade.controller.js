import asyncHandler from "../utils/asyncHandler.js";
import { Trade } from "../models/trade.models.js";
import { User } from "../models/users.models.js";
import { Market } from "../models/market.models.js";
import { 
    emitMarketPriceUpdate, 
    emitNewTrade, 
    emitUserBalanceUpdate, 
    emitUserTradeExecuted 
} from "../utils/websocket.js";
import { checkMarketThreshold } from "../jobs/marketScheduler.js";

// Helper function to calculate platform profit potential
const calculatePlatformProfit = (yesAmount, yesValue, noAmount, noValue) => {
    const totalCollected = yesValue + noValue;
    const maxPayoutIfYesWins = yesAmount * 10;
    const maxPayoutIfNoWins = noAmount * 10;
    const maximumPayout = Math.max(maxPayoutIfYesWins, maxPayoutIfNoWins);
    const guaranteedProfit = totalCollected - maximumPayout;
    
    return {
        totalCollected,
        maxPayoutIfYesWins,
        maxPayoutIfNoWins,
        maximumPayout,
        guaranteedProfit,
        isProfitable: guaranteedProfit >= 0
    };
};

// Helper function to update market prices based on executed trades
const updateMarketPrices = async (marketId) => {
    const market = await Market.findById(marketId);
    if (!market) return;

    // Get all executed trades for this market
    const executedTrades = await Trade.find({
        market: marketId,
        status: "EXECUTED"
    });

    let totalYesVolume = 0;
    let totalYesValue = 0;
    let totalNoVolume = 0;
    let totalNoValue = 0;

    // Calculate weighted average prices based on executed trades
    executedTrades.forEach(trade => {
        if (trade.option === "yes" && trade.side === "buy") {
            totalYesVolume += trade.executedAmount;
            totalYesValue += trade.executedAmount * trade.executePrice;
        } else if (trade.option === "no" && trade.side === "buy") {
            totalNoVolume += trade.executedAmount;
            totalNoValue += trade.executedAmount * trade.executePrice;
        }
    });

    // Update prices based on weighted average, default to 5 if no trades
    if (totalYesVolume > 0) {
        market.yesPrice = Math.max(0.5, Math.min(9.5, totalYesValue / totalYesVolume));
    }
    
    if (totalNoVolume > 0) {
        market.noPrice = Math.max(0.5, Math.min(9.5, totalNoValue / totalNoVolume));
    }

    // Ensure prices are complementary (sum to 10) based on the more active side
    if (totalYesVolume > totalNoVolume && totalYesVolume > 0) {
        market.noPrice = 10 - market.yesPrice;
    } else if (totalNoVolume > totalYesVolume && totalNoVolume > 0) {
        market.yesPrice = 10 - market.noPrice;
    }

    // Update total amounts
    market.totalYesAmount = totalYesVolume;
    market.totalNoAmount = totalNoVolume;

    await market.save();
    return market;
};

const executeTrade = async(marketId, newTrade) => {
    const market = await Market.findById(marketId);
    if(!market) return;

    // **ENHANCED PARTIAL EXECUTION LOGIC**
    // Find profitable matches between pending trades and new trade
    
    // Get all existing trades for this market
    const allExistingTrades = await Trade.find({
        market: marketId
    });

    // Separate by status
    const executedTrades = allExistingTrades.filter(t => t.status === "EXECUTED" || t.status === "PARTIALLY_EXECUTED");
    const pendingTrades = allExistingTrades.filter(t => t.status === "PENDING");

    console.log(`📊 Current Market State:
        Executed/Partial trades: ${executedTrades.length}
        Pending trades: ${pendingTrades.length}
        New trade: ${newTrade.amount} ${newTrade.option.toUpperCase()} at ₹${newTrade.price}`);

    // **PARTIAL EXECUTION ALGORITHM**
    // Try to find profitable partial matches between pending trades of opposite types
    const yesTradesAvailable = pendingTrades.filter(t => t.option === "yes");
    const noTradesAvailable = pendingTrades.filter(t => t.option === "no");

    // Add new trade to the appropriate list for matching
    if (newTrade.option === "yes") {
        yesTradesAvailable.push(newTrade);
    } else {
        noTradesAvailable.push(newTrade);
    }

    // Sort by best prices for optimal matching (YES: highest price first, NO: lowest price first)
    yesTradesAvailable.sort((a, b) => b.price - a.price);
    noTradesAvailable.sort((a, b) => a.price - b.price);

    let executionsThisRound = [];
    let totalExecutedValue = 0;

    // **GREEDY MATCHING ALGORITHM**
    // Match YES and NO trades optimally, allowing partial fills
    for (let yesTradeIndex = 0; yesTradeIndex < yesTradesAvailable.length; yesTradeIndex++) {
        const yesTrade = yesTradesAvailable[yesTradeIndex];
        let yesRemainingAmount = yesTrade.remainingAmount || yesTrade.amount;

        if (yesRemainingAmount <= 0) continue;

        for (let noTradeIndex = 0; noTradeIndex < noTradesAvailable.length; noTradeIndex++) {
            const noTrade = noTradesAvailable[noTradeIndex];
            let noRemainingAmount = noTrade.remainingAmount || noTrade.amount;

            if (noRemainingAmount <= 0) continue;

            // Check if this pair is profitable (YES price + NO price >= 10)
            if (yesTrade.price + noTrade.price >= 10) {
                // Calculate optimal execution amount (minimum of both remaining amounts)
                const executionAmount = Math.min(yesRemainingAmount, noRemainingAmount);
                const executionValue = executionAmount * (yesTrade.price + noTrade.price);
                const platformProfit = executionValue - (executionAmount * 10);

                console.log(`🎯 PROFITABLE MATCH FOUND:
                    YES: ${executionAmount} shares at ₹${yesTrade.price}
                    NO: ${executionAmount} shares at ₹${noTrade.price}
                    Total collected: ₹${executionValue}
                    Platform profit: ₹${platformProfit}`);

                // Execute this partial match
                executionsThisRound.push({
                    yesTradeId: yesTrade._id,
                    noTradeId: noTrade._id,
                    amount: executionAmount,
                    yesPrice: yesTrade.price,
                    noPrice: noTrade.price,
                    totalValue: executionValue,
                    profit: platformProfit
                });

                totalExecutedValue += executionValue;

                // Update remaining amounts
                yesRemainingAmount -= executionAmount;
                noRemainingAmount -= executionAmount;

                // Update trades in arrays for next iteration
                yesTrade.remainingAmount = yesRemainingAmount;
                noTrade.remainingAmount = noRemainingAmount;

                // If one trade is fully executed, break inner loop
                if (yesRemainingAmount <= 0) break;
            }
        }
    }

    // **EXECUTE PARTIAL MATCHES**
    if (executionsThisRound.length > 0) {
        console.log(`� EXECUTING ${executionsThisRound.length} PARTIAL MATCHES - Total value: ₹${totalExecutedValue}`);

        for (const execution of executionsThisRound) {
            // Update YES trade
            const yesTradeToUpdate = await Trade.findById(execution.yesTradeId);
            const originalYesAmount = yesTradeToUpdate.amount;
            const executedYesAmount = (yesTradeToUpdate.executedAmount || 0) + execution.amount;

            if (executedYesAmount >= originalYesAmount) {
                // Fully executed
                yesTradeToUpdate.status = "EXECUTED";
                yesTradeToUpdate.executedAmount = originalYesAmount;
            } else {
                // Partially executed
                yesTradeToUpdate.status = "PARTIALLY_EXECUTED";
                yesTradeToUpdate.executedAmount = executedYesAmount;
            }
            yesTradeToUpdate.executePrice = execution.yesPrice;
            await yesTradeToUpdate.save();

            // Update NO trade
            const noTradeToUpdate = await Trade.findById(execution.noTradeId);
            const originalNoAmount = noTradeToUpdate.amount;
            const executedNoAmount = (noTradeToUpdate.executedAmount || 0) + execution.amount;

            if (executedNoAmount >= originalNoAmount) {
                // Fully executed
                noTradeToUpdate.status = "EXECUTED";
                noTradeToUpdate.executedAmount = originalNoAmount;
            } else {
                // Partially executed
                noTradeToUpdate.status = "PARTIALLY_EXECUTED";
                noTradeToUpdate.executedAmount = executedNoAmount;
            }
            noTradeToUpdate.executePrice = execution.noPrice;
            await noTradeToUpdate.save();

            // Notify users of executions
            emitUserTradeExecuted(yesTradeToUpdate.user.toString(), {
                _id: yesTradeToUpdate._id,
                option: "yes",
                amount: execution.amount,
                originalAmount: originalYesAmount,
                price: execution.yesPrice,
                executePrice: execution.yesPrice,
                status: yesTradeToUpdate.status,
                marketId: marketId,
                isPartial: yesTradeToUpdate.status === "PARTIALLY_EXECUTED"
            });

            emitUserTradeExecuted(noTradeToUpdate.user.toString(), {
                _id: noTradeToUpdate._id,
                option: "no",
                amount: execution.amount,
                originalAmount: originalNoAmount,
                price: execution.noPrice,
                executePrice: execution.noPrice,
                status: noTradeToUpdate.status,
                marketId: marketId,
                isPartial: noTradeToUpdate.status === "PARTIALLY_EXECUTED"
            });
        }

        // Update market prices based on all executed trades
        const allExecutedTrades = await Trade.find({
            market: marketId,
            status: { $in: ["EXECUTED", "PARTIALLY_EXECUTED"] }
        });

        if (allExecutedTrades.length > 0) {
            let totalYesVol = 0, totalYesVal = 0, totalNoVol = 0, totalNoVal = 0;
            
            allExecutedTrades.forEach(trade => {
                const execAmount = trade.executedAmount || trade.amount;
                if (trade.option === "yes") {
                    totalYesVol += execAmount;
                    totalYesVal += execAmount * trade.executePrice;
                } else {
                    totalNoVol += execAmount;
                    totalNoVal += execAmount * trade.executePrice;
                }
            });

            // Update market with volume-weighted average prices (complementary)
            if (totalYesVol > 0 && totalNoVol > 0) {
                const avgYesPrice = totalYesVal / totalYesVol;
                const avgNoPrice = totalNoVal / totalNoVol;
                
                if (totalYesVol >= totalNoVol) {
                    market.yesPrice = Math.max(0.5, Math.min(9.5, avgYesPrice));
                    market.noPrice = 10 - market.yesPrice;
                } else {
                    market.noPrice = Math.max(0.5, Math.min(9.5, avgNoPrice));
                    market.yesPrice = 10 - market.noPrice;
                }
            } else if (totalYesVol > 0) {
                market.yesPrice = Math.max(0.5, Math.min(9.5, totalYesVal / totalYesVol));
                market.noPrice = 10 - market.yesPrice;
            } else if (totalNoVol > 0) {
                market.noPrice = Math.max(0.5, Math.min(9.5, totalNoVal / totalNoVol));
                market.yesPrice = 10 - market.noPrice;
            }

            market.totalYesAmount = totalYesVol;
            market.totalNoAmount = totalNoVol;
            await market.save();
        }

        // Emit market update with execution details
        emitMarketPriceUpdate(marketId, {
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            totalYesAmount: market.totalYesAmount,
            totalNoAmount: market.totalNoAmount,
            executed: true,
            totalCollected: totalExecutedValue,
            partialExecutions: executionsThisRound.length
        });

        // Check if threshold reached after price update
        const thresholdTriggered = await checkMarketThreshold(marketId);
        if (thresholdTriggered) {
            console.log(`🎯 Market auto-settled due to threshold after partial executions!`);
        }

        return true; // Some executions happened
    } else {
        console.log(`⏳ NO PROFITABLE MATCHES FOUND - Trades remain pending`);
        
        // Keep new trade as pending and emit to order book
        emitNewTrade(marketId, {
            _id: newTrade._id,
            option: newTrade.option,
            side: newTrade.side,
            amount: newTrade.amount,
            price: newTrade.price,
            status: "PENDING",
            user: newTrade.user,
            timestamp: newTrade.createdAt
        });

        return false; // No executions
    }
};

const createTrade = asyncHandler(async (req, res) => {
    const user = req.user;  //use middleware in routes

    const { marketId } = req.params;
    const { option, side = "buy", amount, price } = req.body;

    if (!option || !amount || !price) {
        return res.status(400).json({
            success: false,
            message: "Please provide option, amount and price"
        });
    }

    if (!["buy", "sell"].includes(side)) {
        return res.status(400).json({
            success: false,
            message: "Side must be 'buy' or 'sell'"
        });
    }

    const market = await Market.findById(marketId);
    if (!market) {
        return res.status(404).json({
            success: false,
            message: "Market not found"
        });
    }

    if (market.status == "expired" ) {
        return res.status(400).json({
            success: false,
            message: "Market has expired"
        });
    }

    // For buy orders, check if user has enough balance
    if (side === "buy" && amount * price > user.balance) {
        return res.status(400).json({
            success: false,
            message: "Insufficient balance"
        });
    }

    // For sell orders, check if user has shares to sell (this would require tracking user positions)
    // For now, we'll allow all sell orders

    const trade = await Trade.create({
        user: user._id,
        market: marketId,
        amount,
        option,
        side,
        price
    });

    if (!trade) {
        return res.status(500).json({
            success: false,
            message: "Failed to create trade"
        });
    }

    // Only deduct balance for buy orders
    if (side === "buy") {
        user.balance -= amount * price;
        
        // Initialize trades array if it doesn't exist
        if (!user.trades) {
            user.trades = [];
        }
        
        user.trades.push(trade._id);
        await user.save();

        // Emit user balance update
        emitUserBalanceUpdate(user._id.toString(), {
            newBalance: user.balance,
            change: -(amount * price),
            reason: `${side.toUpperCase()} order placed: ${amount} shares of ${option.toUpperCase()} at ${price}`
        });
    }

    // Try to execute the trade immediately with new smart logic
    const wasExecuted = await executeTrade(marketId, trade);

    // Only emit new trade if it wasn't executed (still pending)
    if (!wasExecuted) {
        emitNewTrade(marketId, {
            _id: trade._id,
            option,
            side,
            amount,
            price,
            status: trade.status,
            user: user._id,
            timestamp: trade.createdAt
        });
    }

    // Update market prices and emit updates (this might be handled inside executeTrade now)
    const updatedMarket = await updateMarketPrices(marketId);
    emitMarketPriceUpdate(marketId, {
        yesPrice: updatedMarket.yesPrice,
        noPrice: updatedMarket.noPrice,
        totalYesAmount: updatedMarket.totalYesAmount,
        totalNoAmount: updatedMarket.totalNoAmount
    });

    return res.status(201).json({
        success: true,
        message: "Trade created successfully",
        trade: {
            _id: trade._id,
            option,
            side,
            amount,
            price,
            status: trade.status,
            market: marketId
        }
    });

});

const getOrderBook = asyncHandler(async (req, res) => {
    const { marketId } = req.params;

    try {
        // Get all pending trades for this market
        const pendingTrades = await Trade.find({
            market: marketId,
            status: "PENDING"
        }).sort({ price: -1 }); // Sort by price descending

        // Group trades by option and side
        const yesOrders = pendingTrades
            .filter(trade => trade.option === "yes" && trade.side === "buy")
            .map(trade => ({
                price: trade.price,
                quantity: trade.amount,
                id: trade._id
            }));

        const noOrders = pendingTrades
            .filter(trade => trade.option === "no" && trade.side === "buy")
            .map(trade => ({
                price: trade.price,
                quantity: trade.amount,
                id: trade._id
            }));

        return res.status(200).json({
            success: true,
            data: {
                yesOrders,
                noOrders,
                totalOrders: pendingTrades.length
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch order book"
        });
    }
});

// Get user's orders for a specific market
const getUserOrders = asyncHandler(async (req, res) => {
    const user = req.user;
    const { marketId } = req.params;

    try {
        // Get all trades by this user for this market
        const userTrades = await Trade.find({
            user: user._id,
            market: marketId
        }).populate('market', 'question yesPrice noPrice')
          .sort({ createdAt: -1 });

        const orders = userTrades.map(trade => ({
            _id: trade._id,
            option: trade.option,
            side: trade.side,
            amount: trade.amount,
            price: trade.price,
            status: trade.status,
            executePrice: trade.executePrice,
            executedAmount: trade.executedAmount,
            createdAt: trade.createdAt,
            market: trade.market
        }));

        return res.status(200).json({
            success: true,
            data: {
                orders,
                totalOrders: orders.length
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user orders"
        });
    }
});

// Get all user's orders across all markets
const getAllUserOrders = asyncHandler(async (req, res) => {
    const user = req.user;

    try {
        // Get all trades by this user
        const userTrades = await Trade.find({
            user: user._id
        }).populate('market', 'question yesPrice noPrice status')
          .sort({ createdAt: -1 });

        const orders = userTrades.map(trade => ({
            _id: trade._id,
            option: trade.option,
            side: trade.side,
            amount: trade.amount,
            price: trade.price,
            status: trade.status,
            executePrice: trade.executePrice,
            executedAmount: trade.executedAmount,
            createdAt: trade.createdAt,
            market: trade.market
        }));

        // Group by status for easy filtering
        const groupedOrders = {
            pending: orders.filter(order => order.status === "PENDING"),
            executed: orders.filter(order => order.status === "EXECUTED"),
            partiallyExecuted: orders.filter(order => order.status === "PARTIALLY_EXECUTED"),
            cancelled: orders.filter(order => order.status === "CANCELLED"),
            settled: orders.filter(order => order.status === "SETTLED")
        };

        return res.status(200).json({
            success: true,
            data: {
                orders,
                groupedOrders,
                totalOrders: orders.length
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user orders"
        });
    }
});

export {
    createTrade,
    getOrderBook,
    getUserOrders,
    getAllUserOrders
};
