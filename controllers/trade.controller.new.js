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

const executeTrade = async(marketId, user) => {
    const market = await Market.findById(marketId);
    if(!market) return;

    const pendingTrades = await Trade.find({market: marketId, status: "PENDING"});
    for(let trade of pendingTrades) {
        // In a prediction market, all trades should execute immediately
        // The price they pay becomes the new market price
        let execute = true;
        let executePrice = trade.price;
        
        if(execute) {
            trade.status = "EXECUTED";
            trade.executePrice = executePrice;
            await trade.save();
            
            if(trade.option === "yes" && trade.status === "EXECUTED") {
                // Update yesPrice based on the new trade
                if (market.totalYesAmount === 0) {
                    market.yesPrice = trade.price;
                } else {
                    market.yesPrice = ((market.yesPrice * market.totalYesAmount) + (trade.price * trade.amount)) / (market.totalYesAmount + trade.amount);
                }
                market.totalYesAmount += trade.amount;
                market.noPrice = 10 - market.yesPrice;
            }
            else if(trade.option === "no" && trade.status === "EXECUTED") {
                // Update noPrice based on the new trade
                if (market.totalNoAmount === 0) {
                    market.noPrice = trade.price;
                } else {
                    market.noPrice = ((market.noPrice * market.totalNoAmount) + (trade.price * trade.amount)) / (market.totalNoAmount + trade.amount);
                }
                market.totalNoAmount += trade.amount;
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

            // Notify user of trade execution
            const tradeUser = await User.findById(trade.user);
            if (tradeUser) {
                emitUserTradeExecuted(trade.user.toString(), {
                    _id: trade._id,
                    option: trade.option,
                    amount: trade.amount,
                    price: trade.price,
                    executePrice: trade.executePrice,
                    status: trade.status,
                    marketId: marketId
                });
            }
        }
    }
};

const createTrade = asyncHandler(async (req, res) => {
    const user = req.user;  //use middleware in routes

    const { marketId } = req.params;
    const { option, amount, price } = req.body;

    if (!option || !amount || !price) {
        return res.status(400).json({
            success: false,
            message: "Please provide option, amount and price"
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

    if (amount*price > user.balance) {
        return res.status(400).json({
            success: false,
            message: "Insufficient balance"
        });
    }

    const trade = await Trade.create({
        user: user._id,
        market: marketId,
        amount,
        option,
        price
    });

    if (!trade) {
        return res.status(500).json({
            success: false,
            message: "Failed to create trade"
        });
    }

    user.balance -= amount*price;
    
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
        reason: `Trade placed: ${amount} shares of ${option.toUpperCase()} at ${price}`
    });

    // Emit new trade notification to market
    emitNewTrade(marketId, {
        _id: trade._id,
        option,
        amount,
        price,
        status: trade.status,
        user: user._id,
        timestamp: trade.createdAt
    });

    await executeTrade(marketId, user);

    return res.status(201).json({
        success: true,
        message: "Trade created successfully",
        trade: {
            _id: trade._id,
            option,
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
