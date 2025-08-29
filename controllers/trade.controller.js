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

    // **NEW SMART EXECUTION LOGIC**
    // Platform acts as market maker - execute trades when profitable
    
    // Get all pending trades for this market
    const pendingTrades = await Trade.find({
        market: marketId,
        status: "PENDING"
    });

    // **SMART PAIR-WISE EXECUTION** - Execute profitable combinations immediately
    // Your scenario: YES ₹9 + NO ₹9 should execute (₹8 profit), YES ₹2 stays pending
    
    // Get all pending trades and separate by option
    const allTrades = [...pendingTrades, newTrade];
    const yesTrades = allTrades.filter(t => t.option === "yes").sort((a, b) => b.price - a.price); // Sorting YES trades by price (high to low)
    const noTrades = allTrades.filter(t => t.option === "no").sort((a, b) => b.price - a.price);

    console.log(`📊 Available trades:
        YES: ${yesTrades.map(t => `₹${t.price}`).join(', ')}
        NO: ${noTrades.map(t => `₹${t.price}`).join(', ')}`);

    // Find and execute profitable pairs
    let tradesToExecute = [];
    let totalProfit = 0;
    
    // Create a copy to track available trades
    let availableYes = [...yesTrades];
    let availableNo = [...noTrades];

    // Try to match YES and NO trades for profit
    for (let i = 0; i < availableYes.length; i++) {
        const yTrade = availableYes[i];
        if (!yTrade) continue; // Already used
        
        for (let j = 0; j < availableNo.length; j++) {
            const nTrade = availableNo[j];
            if (!nTrade) continue; // Already used
            
            // Calculate profit for this pair (assuming equal amounts for simplicity)
            const minAmount = Math.min(yTrade.amount, nTrade.amount);
            const collected = (minAmount * yTrade.price) + (minAmount * nTrade.price);
            const maxPayout = minAmount * 10; // Winner gets ₹10 per share
            const profit = collected - maxPayout;
            
            console.log(`🔍 Pair check: YES ₹${yTrade.price} + NO ₹${nTrade.price} = ₹${collected} collected, payout ₹${maxPayout}, profit ₹${profit}`);
            
            if (profit >= 0) {
                // This pair is profitable or break-even (no loss) - execute it
                tradesToExecute.push(yTrade, nTrade);
                totalProfit += profit;
                
                // Mark as used
                availableYes[i] = null;
                availableNo[j] = null;
                
                console.log(`✅ Executing pair! Profit/Break-even: ₹${profit}`);
                break; // Move to next YES trade
            }
        }
    }

    // Execute profitable pairs immediately
    if (tradesToExecute.length > 0) {
        console.log(`🚀 EXECUTING ${tradesToExecute.length} TRADES with total profit ₹${totalProfit}!`);
        
        let executedYesAmount = 0;
        let executedNoAmount = 0;
        let executedYesValue = 0;
        let executedNoValue = 0;
        
        for (let trade of tradesToExecute) {
            trade.status = "EXECUTED";
            trade.executePrice = trade.price;
            trade.executedAmount = trade.amount;
            await trade.save();

            if (trade.option === "yes") {
                executedYesAmount += trade.amount;
                executedYesValue += trade.amount * trade.price;
            } else {
                executedNoAmount += trade.amount;
                executedNoValue += trade.amount * trade.price;
            }

            // Notify user of execution
            emitUserTradeExecuted(trade.user.toString(), {
                _id: trade._id,
                option: trade.option,
                amount: trade.amount,
                price: trade.price,
                executePrice: trade.price,
                status: "EXECUTED",
                marketId: marketId
            });
        }

        // Update market prices based on executed volume - MAKE THEM COMPLEMENTARY
        if (executedYesAmount > 0 && executedNoAmount > 0) {
            // Both YES and NO trades executed - calculate based on weighted average
            const avgYesPrice = executedYesValue / executedYesAmount;
            const avgNoPrice = executedNoValue / executedNoAmount;
            
            // Use the price with higher volume as the primary price
            if (executedYesAmount >= executedNoAmount) {
                // More YES volume - set YES price, make NO complementary
                market.yesPrice = Math.max(0.5, Math.min(9.5, avgYesPrice));
                market.noPrice = 10 - market.yesPrice;
            } else {
                // More NO volume - set NO price, make YES complementary  
                market.noPrice = Math.max(0.5, Math.min(9.5, avgNoPrice));
                market.yesPrice = 10 - market.noPrice;
            }
        } else if (executedYesAmount > 0) {
            // Only YES trades executed
            const avgYesPrice = executedYesValue / executedYesAmount;
            market.yesPrice = Math.max(0.5, Math.min(9.5, avgYesPrice));
            market.noPrice = 10 - market.yesPrice;
        } else if (executedNoAmount > 0) {
            // Only NO trades executed
            const avgNoPrice = executedNoValue / executedNoAmount;
            market.noPrice = Math.max(0.5, Math.min(9.5, avgNoPrice));
            market.yesPrice = 10 - market.noPrice;
        }
        
        // Ensure prices are always complementary and within bounds
        if (market.yesPrice + market.noPrice !== 10) {
            const total = market.yesPrice + market.noPrice;
            market.yesPrice = (market.yesPrice / total) * 10;
            market.noPrice = 10 - market.yesPrice;
        }
        
        // Update total amounts
        market.totalYesAmount = (market.totalYesAmount || 0) + executedYesAmount;
        market.totalNoAmount = (market.totalNoAmount || 0) + executedNoAmount;

        await market.save();

        // Emit market update
        emitMarketPriceUpdate(marketId, {
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            totalYesAmount: market.totalYesAmount,
            totalNoAmount: market.totalNoAmount,
            executed: true,
            profit: totalProfit,
            executedPairs: tradesToExecute.length / 2
        });

        // Check if new trade was executed or still pending
        const wasNewTradeExecuted = tradesToExecute.some(t => t._id.toString() === newTrade._id.toString());
        
        if (!wasNewTradeExecuted) {
            // New trade wasn't part of profitable pairs, emit as pending
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
        }

        return wasNewTradeExecuted; // Return whether new trade was executed
    } else {
        console.log(`⏳ TRADES PENDING - Need ₹${maximumPayout - totalCollected} more to guarantee profit`);
        
        // Emit new trade to order book but don't execute yet
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

        return false; // Indicate trades are still pending
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
