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

const executeTrade = async(marketId, newTrade) => {
    const market = await Market.findById(marketId);
    if(!market) return;

    // Find matching trades for the new trade
    let matchingTrades = [];
    
    if (newTrade.option === "yes") {
        if (newTrade.side === "buy") {
            // For YES BUY order, find:
            // 1. YES SELL orders at EXACT same price
            // 2. NO BUY orders where (newTrade.price + noTrade.price = 10)
            matchingTrades = await Trade.find({
                market: marketId,
                status: "PENDING",
                _id: { $ne: newTrade._id },
                $or: [
                    // YES sell orders at EXACT same price
                    { 
                        option: "yes", 
                        side: "sell",
                        price: newTrade.price
                    },
                    // NO buy orders where prices add up to EXACTLY 10
                    { 
                        option: "no", 
                        side: "buy",
                        price: 10 - newTrade.price
                    }
                ]
            });
        } else {
            // For YES SELL order, find:
            // 1. YES BUY orders at EXACT same price
            // 2. NO SELL orders where (newTrade.price + noTrade.price = 10)
            matchingTrades = await Trade.find({
                market: marketId,
                status: "PENDING",
                _id: { $ne: newTrade._id },
                $or: [
                    // YES buy orders at EXACT same price
                    { 
                        option: "yes", 
                        side: "buy",
                        price: newTrade.price
                    },
                    // NO sell orders where prices add up to EXACTLY 10
                    { 
                        option: "no", 
                        side: "sell",
                        price: 10 - newTrade.price
                    }
                ]
            });
        }
    } else {
        // For NO orders
        if (newTrade.side === "buy") {
            // For NO BUY order, find:
            // 1. NO SELL orders at EXACT same price
            // 2. YES BUY orders where (newTrade.price + yesTrade.price = 10)
            matchingTrades = await Trade.find({
                market: marketId,
                status: "PENDING", 
                _id: { $ne: newTrade._id },
                $or: [
                    // NO sell orders at EXACT same price
                    { 
                        option: "no", 
                        side: "sell",
                        price: newTrade.price
                    },
                    // YES buy orders where prices add up to EXACTLY 10
                    { 
                        option: "yes", 
                        side: "buy",
                        price: 10 - newTrade.price
                    }
                ]
            });
        } else {
            // For NO SELL order, find:
            // 1. NO BUY orders at EXACT same price
            // 2. YES SELL orders where (newTrade.price + yesTrade.price = 10)
            matchingTrades = await Trade.find({
                market: marketId,
                status: "PENDING", 
                _id: { $ne: newTrade._id },
                $or: [
                    // NO buy orders at EXACT same price
                    { 
                        option: "no", 
                        side: "buy",
                        price: newTrade.price
                    },
                    // YES sell orders where prices add up to EXACTLY 10
                    { 
                        option: "yes", 
                        side: "sell",
                        price: 10 - newTrade.price
                    }
                ]
            });
        }
    }

    // Execute matching trades
    let remainingAmount = newTrade.amount;
    
    for (let matchingTrade of matchingTrades) {
        if (remainingAmount <= 0) break;
        
        const executeAmount = Math.min(remainingAmount, matchingTrade.amount);
        const executePrice = matchingTrade.price; // Take the existing order's price
        
        // Update both trades
        if (executeAmount === matchingTrade.amount) {
            // Fully execute the matching trade
            matchingTrade.status = "EXECUTED";
            matchingTrade.executePrice = executePrice;
            matchingTrade.executedAmount = executeAmount;
            await matchingTrade.save();
        } else {
            // Partially execute the matching trade - split it
            matchingTrade.amount -= executeAmount;
            await matchingTrade.save();
            
            // Create executed portion
            const executedPortion = await Trade.create({
                user: matchingTrade.user,
                market: marketId,
                amount: executeAmount,
                option: matchingTrade.option,
                side: matchingTrade.side,
                price: matchingTrade.price,
                status: "EXECUTED",
                executePrice: executePrice,
                executedAmount: executeAmount
            });
        }
        
        // Update new trade
        if (executeAmount === remainingAmount) {
            // Fully execute the new trade
            newTrade.status = "EXECUTED";
            newTrade.executePrice = executePrice;
            newTrade.executedAmount = executeAmount;
            await newTrade.save();
        } else {
            // Partially execute the new trade
            newTrade.amount -= executeAmount;
            await newTrade.save();
            
            // Create executed portion
            const executedPortion = await Trade.create({
                user: newTrade.user,
                market: marketId,
                amount: executeAmount,
                option: newTrade.option,
                side: newTrade.side,
                price: newTrade.price,
                status: "EXECUTED",
                executePrice: executePrice,
                executedAmount: executeAmount
            });
            
            // Notify user of partial execution
            emitUserTradeExecuted(newTrade.user.toString(), {
                _id: executedPortion._id,
                option: executedPortion.option,
                amount: executeAmount,
                price: executedPortion.price,
                executePrice: executePrice,
                status: "EXECUTED",
                marketId: marketId
            });
        }
        
        remainingAmount -= executeAmount;
        
        // Update market prices based on executed trades
        if (newTrade.option === "yes") {
            if (market.totalYesAmount === 0) {
                market.yesPrice = executePrice;
            } else {
                market.yesPrice = ((market.yesPrice * market.totalYesAmount) + (executePrice * executeAmount)) / (market.totalYesAmount + executeAmount);
            }
            market.totalYesAmount += executeAmount;
            market.noPrice = 10 - market.yesPrice;
        } else {
            if (market.totalNoAmount === 0) {
                market.noPrice = executePrice;
            } else {
                market.noPrice = ((market.noPrice * market.totalNoAmount) + (executePrice * executeAmount)) / (market.totalNoAmount + executeAmount);
            }
            market.totalNoAmount += executeAmount;
            market.yesPrice = 10 - market.noPrice;
        }
        
        await market.save();
        
        // Emit real-time price update
        emitMarketPriceUpdate(marketId, {
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            totalYesAmount: market.totalYesAmount,
            totalNoAmount: market.totalNoAmount
        });
        
        // Notify both users of trade execution
        const matchingUser = await User.findById(matchingTrade.user);
        if (matchingUser) {
            emitUserTradeExecuted(matchingTrade.user.toString(), {
                _id: matchingTrade._id,
                option: matchingTrade.option,
                amount: executeAmount,
                price: matchingTrade.price,
                executePrice: executePrice,
                status: "EXECUTED",
                marketId: marketId
            });
        }
    }
    
    // If new trade was fully executed, notify user
    if (newTrade.status === "EXECUTED") {
        emitUserTradeExecuted(newTrade.user.toString(), {
            _id: newTrade._id,
            option: newTrade.option,
            amount: newTrade.executedAmount || newTrade.amount,
            price: newTrade.price,
            executePrice: newTrade.executePrice,
            status: "EXECUTED",
            marketId: marketId
        });
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

    // Emit new trade notification to market
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

    // Try to execute the trade immediately
    await executeTrade(marketId, trade);

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

export {
    createTrade
};
