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

    // **IMPROVED EXECUTION LOGIC** - Consider all platform exposure
    // Platform should calculate total exposure including executed + pending + new trade
    
    // Get ALL trades for this market (executed + pending)
    const allExistingTrades = await Trade.find({
        market: marketId
    });

    // Separate executed and pending trades
    const executedTrades = allExistingTrades.filter(t => t.status === "EXECUTED");
    const pendingTrades = allExistingTrades.filter(t => t.status === "PENDING");

    // Calculate current platform position
    let totalYesShares = 0;
    let totalYesValue = 0;
    let totalNoShares = 0;
    let totalNoValue = 0;

    // Add executed trades to platform position
    executedTrades.forEach(trade => {
        if (trade.option === "yes") {
            totalYesShares += trade.executedAmount;
            totalYesValue += trade.executedAmount * trade.executePrice;
        } else {
            totalNoShares += trade.executedAmount;
            totalNoValue += trade.executedAmount * trade.executePrice;
        }
    });

    // Add pending trades to potential position
    pendingTrades.forEach(trade => {
        if (trade.option === "yes") {
            totalYesShares += trade.amount;
            totalYesValue += trade.amount * trade.price;
        } else {
            totalNoShares += trade.amount;
            totalNoValue += trade.amount * trade.price;
        }
    });

    // Add new trade to calculate new total position
    if (newTrade.option === "yes") {
        totalYesShares += newTrade.amount;
        totalYesValue += newTrade.amount * newTrade.price;
    } else {
        totalNoShares += newTrade.amount;
        totalNoValue += newTrade.amount * newTrade.price;
    }

    // Calculate platform's total exposure and profit scenarios
    const totalCollected = totalYesValue + totalNoValue;
    const payoutIfYesWins = totalYesShares * 10;
    const payoutIfNoWins = totalNoShares * 10;
    const profitIfYesWins = totalCollected - payoutIfYesWins;
    const profitIfNoWins = totalCollected - payoutIfNoWins;
    const worstCaseProfit = Math.min(profitIfYesWins, profitIfNoWins);

    console.log(`💰 Platform Exposure Analysis:
        Total Collected: ₹${totalCollected}
        YES Shares: ${totalYesShares} (payout ₹${payoutIfYesWins} if YES wins)
        NO Shares: ${totalNoShares} (payout ₹${payoutIfNoWins} if NO wins)
        Profit if YES wins: ₹${profitIfYesWins}
        Profit if NO wins: ₹${profitIfNoWins}
        Worst case profit: ₹${worstCaseProfit}`);

    // Execute new trade if platform doesn't lose money in any scenario
    if (worstCaseProfit >= 0) {
        console.log(`🚀 EXECUTING TRADE - Platform guaranteed no loss! (Worst case: ₹${worstCaseProfit})`);
        
        // Execute the new trade
        newTrade.status = "EXECUTED";
        newTrade.executePrice = newTrade.price;
        newTrade.executedAmount = newTrade.amount;
        await newTrade.save();

        // Also execute any remaining pending trades since they're all profitable now
        if (pendingTrades.length > 0) {
            console.log(`🔄 Also executing ${pendingTrades.length} pending trades...`);
            for (let pendingTrade of pendingTrades) {
                pendingTrade.status = "EXECUTED";
                pendingTrade.executePrice = pendingTrade.price;
                pendingTrade.executedAmount = pendingTrade.amount;
                await pendingTrade.save();

                // Notify user of execution
                emitUserTradeExecuted(pendingTrade.user.toString(), {
                    _id: pendingTrade._id,
                    option: pendingTrade.option,
                    amount: pendingTrade.amount,
                    price: pendingTrade.price,
                    executePrice: pendingTrade.price,
                    status: "EXECUTED",
                    marketId: marketId
                });
            }
        }

        // Update market prices based on executed trades
        const allExecutedTrades = await Trade.find({
            market: marketId,
            status: "EXECUTED"
        });

        if (allExecutedTrades.length > 0) {
            let totalYesVol = 0, totalYesVal = 0, totalNoVol = 0, totalNoVal = 0;
            
            allExecutedTrades.forEach(trade => {
                if (trade.option === "yes") {
                    totalYesVol += trade.executedAmount;
                    totalYesVal += trade.executedAmount * trade.executePrice;
                } else {
                    totalNoVol += trade.executedAmount;
                    totalNoVal += trade.executedAmount * trade.executePrice;
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
            totalCollected,
            profitIfYesWins,
            profitIfNoWins,
            worstCaseProfit
        });

        // **NEW: Check if threshold reached after price update**
        const thresholdTriggered = await checkMarketThreshold(marketId);
        if (thresholdTriggered) {
            console.log(`🎯 Market auto-settled due to threshold after trade execution!`);
        }

        // Notify user of new trade execution
        emitUserTradeExecuted(newTrade.user.toString(), {
            _id: newTrade._id,
            option: newTrade.option,
            amount: newTrade.amount,
            price: newTrade.price,
            executePrice: newTrade.price,
            status: "EXECUTED",
            marketId: marketId
        });

        return true; // Trade was executed
    } else {
        console.log(`⏳ TRADE PENDING - Platform would lose money (worst case: ₹${worstCaseProfit})`);
        
        // Keep trade as pending
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

        return false; // Trade is pending
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
