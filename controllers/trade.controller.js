import asyncHandler from "../utils/asyncHandler.js";
import { Trade } from "../models/trade.models.js";
import { User } from "../models/users.models.js";
import { Market } from "../models/market.models.js";
import { 
    emitMarketPriceUpdate, 
    emitNewTrade, 
    emitUserBalanceUpdate, 
    emitUserTradeExecuted,
    emitOrderBookUpdate
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

// Helper: update market prices based on executed trades (volume-weighted; complementary)
const updateMarketPrices = async (marketId) => {
    const market = await Market.findById(marketId);
    if (!market) return;

    const executedTrades = await Trade.find({ market: marketId, status: { $in: ["EXECUTED", "PARTIALLY_EXECUTED"] } });

    let totalYesVolume = 0, totalYesValue = 0, totalNoVolume = 0, totalNoValue = 0;
    executedTrades.forEach(trade => {
        const execAmt = trade.executedAmount || 0;
        if (trade.option === "yes" && execAmt > 0) {
            totalYesVolume += execAmt;
            totalYesValue += execAmt * trade.executePrice;
        } else if (trade.option === "no" && execAmt > 0) {
            totalNoVolume += execAmt;
            totalNoValue += execAmt * trade.executePrice;
        }
    });

    if (totalYesVolume > 0) {
        market.yesPrice = Math.max(0.5, Math.min(9.5, totalYesValue / totalYesVolume));
        market.noPrice = 10 - market.yesPrice;
    }
    if (totalNoVolume > 0) {
        market.noPrice = Math.max(0.5, Math.min(9.5, totalNoValue / totalNoVolume));
        market.yesPrice = 10 - market.noPrice;
    }

    market.totalYesAmount = totalYesVolume;
    market.totalNoAmount = totalNoVolume;
    await market.save();
    return market;
};
const executeTrade = async (marketId, newTrade) => {
  const market = await Market.findById(marketId);
  if (!market) return;

  // Fetch trades
  const allTrades = await Trade.find({ market: marketId });
  const executedTrades = allTrades.filter(t => ["EXECUTED", "PARTIALLY_EXECUTED"].includes(t.status));
  const pendingTrades = allTrades.filter(t => t.status === "PENDING");

  // Current platform state
  let yesShares = 0, yesValue = 0, noShares = 0, noValue = 0;
  executedTrades.forEach(t => {
    const amt = t.executedAmount || 0;
    if (t.option === "yes") { yesShares += amt; yesValue += amt * t.executePrice; }
    else { noShares += amt; noValue += amt * t.executePrice; }
  });

  // Include new trade in pending list
  let yesPending = pendingTrades.filter(t => t.option === "yes");
  let noPending = pendingTrades.filter(t => t.option === "no");
  if (newTrade.option === "yes") yesPending.push(newTrade);
  else noPending.push(newTrade);

  // FIFO: sort by createdAt
  yesPending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  noPending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  let matches = [];

    // Try matching FIFO with safety (profit >= 0) allowing partials
  let i = 0, j = 0;
  while (i < yesPending.length && j < noPending.length) {
    const y = yesPending[i];
    const n = noPending[j];
    const yRemain = (y.amount - (y.executedAmount || 0));
    const nRemain = (n.amount - (n.executedAmount || 0));
        const tryQty = Math.min(yRemain, nRemain);

        // Per-share profit delta when pairing these two
        const delta = (y.price + n.price) - 10; // >=0 is always safe
        let execQty = 0;
        if (delta >= 0) {
            execQty = tryQty;
        } else {
            // Current worst-case profit from executed so far
            const currentCollected = yesValue + noValue;
            const currentWorst = Math.min(currentCollected - yesShares * 10, currentCollected - noShares * 10);
            const maxSafe = Math.floor(currentWorst / (-delta));
            execQty = Math.max(0, Math.min(tryQty, maxSafe));
        }

        if (execQty > 0) {
            // Apply
            matches.push({ yes: y, no: n, qty: execQty, yesPrice: y.price, noPrice: n.price });
            yesShares += execQty; yesValue += execQty * y.price;
            noShares += execQty; noValue += execQty * n.price;

            y.executedAmount = (y.executedAmount || 0) + execQty;
            y.status = y.executedAmount >= y.amount ? "EXECUTED" : "PARTIALLY_EXECUTED";
            n.executedAmount = (n.executedAmount || 0) + execQty;
            n.status = n.executedAmount >= n.amount ? "EXECUTED" : "PARTIALLY_EXECUTED";

            if (y.executedAmount >= y.amount) i++;
            if (n.executedAmount >= n.amount) j++;
            // If we couldn't take full tryQty due to safety, stop (FIFO)
            if (execQty < tryQty) break;
        } else {
            break;
        }
  }

    // Save executions
  for (const m of matches) {
    await Trade.findByIdAndUpdate(m.yes._id, {
      status: m.yes.status,
      executedAmount: m.yes.executedAmount,
      executePrice: m.yesPrice,
      executedAt: new Date()
    });
    await Trade.findByIdAndUpdate(m.no._id, {
      status: m.no.status,
      executedAmount: m.no.executedAmount,
      executePrice: m.noPrice,
      executedAt: new Date()
    });

    emitNewTrade(marketId, { ...m, status: "EXECUTED" });
  }

    // HOUSE fallback: execute remaining of newTrade alone while profit stays >= 0
    let remainingNew = (newTrade.amount - (newTrade.executedAmount || 0));
    if (remainingNew > 0) {
        const price = newTrade.price;
        if (newTrade.option === "yes") {
            const delta = price - 10; // per share
            let execQty = 0;
            if (delta >= 0) {
                execQty = remainingNew;
            } else {
                const currentCollected = yesValue + noValue;
                const currentWorst = Math.min(currentCollected - yesShares * 10, currentCollected - noShares * 10);
                const maxSafe = Math.floor(currentWorst / (-delta));
                execQty = Math.max(0, Math.min(remainingNew, maxSafe));
            }
            if (execQty > 0) {
                yesShares += execQty; yesValue += execQty * price;
                newTrade.executedAmount = (newTrade.executedAmount || 0) + execQty;
                newTrade.executePrice = price;
                newTrade.status = newTrade.executedAmount >= newTrade.amount ? "EXECUTED" : "PARTIALLY_EXECUTED";
                await Trade.findByIdAndUpdate(newTrade._id, {
                    executedAmount: newTrade.executedAmount,
                    executePrice: price,
                    status: newTrade.status,
                    executedAt: new Date()
                });
                emitNewTrade(marketId, { _id: newTrade._id, option: "yes", amount: execQty, price, status: newTrade.status, house: true });
            }
        } else { // no
            const delta = price - 10;
            let execQty = 0;
            if (delta >= 0) {
                execQty = remainingNew;
            } else {
                const currentCollected = yesValue + noValue;
                const currentWorst = Math.min(currentCollected - yesShares * 10, currentCollected - noShares * 10);
                const maxSafe = Math.floor(currentWorst / (-delta));
                execQty = Math.max(0, Math.min(remainingNew, maxSafe));
            }
            if (execQty > 0) {
                noShares += execQty; noValue += execQty * price;
                newTrade.executedAmount = (newTrade.executedAmount || 0) + execQty;
                newTrade.executePrice = price;
                newTrade.status = newTrade.executedAmount >= newTrade.amount ? "EXECUTED" : "PARTIALLY_EXECUTED";
                await Trade.findByIdAndUpdate(newTrade._id, {
                    executedAmount: newTrade.executedAmount,
                    executePrice: price,
                    status: newTrade.status,
                    executedAt: new Date()
                });
                emitNewTrade(marketId, { _id: newTrade._id, option: "no", amount: execQty, price, status: newTrade.status, house: true });
            }
        }
    }

  emitOrderBookUpdate(marketId);
  return matches.length > 0;
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
        // Get all pending and partially executed trades for this market
        const activeTrades = await Trade.find({
            market: marketId,
            status: { $in: ["PENDING", "PARTIALLY_EXECUTED"] }
        }).sort({ price: -1 }); // Sort by price descending

        // Process trades to show remaining amounts
        const processedTrades = activeTrades.map(trade => {
            let remainingAmount;
            
            if (trade.status === "PENDING") {
                // For pending trades, show full amount
                remainingAmount = trade.amount;
            } else if (trade.status === "PARTIALLY_EXECUTED") {
                // For partially executed trades, show remaining amount
                remainingAmount = trade.amount - (trade.executedAmount || 0);
            }

            return {
                ...trade.toObject(),
                remainingAmount: remainingAmount,
                isPartiallyExecuted: trade.status === "PARTIALLY_EXECUTED"
            };
        }).filter(trade => trade.remainingAmount > 0); // Only show trades with remaining amount

        // Group trades by option and side
        const yesOrders = processedTrades
            .filter(trade => trade.option === "yes" && trade.side === "buy")
            .map(trade => ({
                price: trade.price,
                quantity: trade.remainingAmount, // Show remaining amount, not original amount
                originalQuantity: trade.amount, // Keep original for reference
                executedQuantity: trade.executedAmount || 0,
                id: trade._id,
                status: trade.status,
                isPartiallyExecuted: trade.isPartiallyExecuted
            }));

        const noOrders = processedTrades
            .filter(trade => trade.option === "no" && trade.side === "buy")
            .map(trade => ({
                price: trade.price,
                quantity: trade.remainingAmount, // Show remaining amount, not original amount
                originalQuantity: trade.amount, // Keep original for reference
                executedQuantity: trade.executedAmount || 0,
                id: trade._id,
                status: trade.status,
                isPartiallyExecuted: trade.isPartiallyExecuted
            }));

        return res.status(200).json({
            success: true,
            data: {
                yesOrders,
                noOrders,
                totalOrders: processedTrades.length,
                partiallyExecutedCount: processedTrades.filter(t => t.isPartiallyExecuted).length
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

        const orders = userTrades.map(trade => {
            const remainingAmount = trade.status === "PARTIALLY_EXECUTED" 
                ? trade.amount - (trade.executedAmount || 0) 
                : (trade.status === "PENDING" ? trade.amount : 0);

            return {
                _id: trade._id,
                option: trade.option,
                side: trade.side,
                amount: trade.amount,
                price: trade.price,
                status: trade.status,
                executePrice: trade.executePrice,
                executedAmount: trade.executedAmount || 0,
                remainingAmount: remainingAmount,
                isPartiallyExecuted: trade.status === "PARTIALLY_EXECUTED",
                createdAt: trade.createdAt,
                market: trade.market
            };
        });

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