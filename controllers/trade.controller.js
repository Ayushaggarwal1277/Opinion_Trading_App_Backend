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

    // **CORRECTED PARTIAL EXECUTION ALGORITHM**
    // CRITICAL: Platform must NEVER be in a losing position
    
    console.log(`📊 Current Market State:
        Executed/Partial trades: ${executedTrades.length}
        Pending trades: ${pendingTrades.length}
        New trade: ${newTrade.amount} ${newTrade.option.toUpperCase()} at ₹${newTrade.price}`);

    // Calculate CURRENT platform exposure from executed trades only
    let preYesShares = 0;
    let preYesValue = 0;
    let preNoShares = 0;
    let preNoValue = 0;

    executedTrades.forEach(trade => {
        const tradeAmount = trade.executedAmount || trade.amount;
        if (trade.option === "yes") {
            preYesShares += tradeAmount;
            preYesValue += tradeAmount * trade.executePrice;
        } else {
            preNoShares += tradeAmount;
            preNoValue += tradeAmount * trade.executePrice;
        }
    });

    const currentCollected = preYesValue + preNoValue;
    const currentPayoutIfYesWins = preYesShares * 10;
    const currentPayoutIfNoWins = preNoShares * 10;
    const currentProfitIfYesWins = currentCollected - currentPayoutIfYesWins;
    const currentProfitIfNoWins = currentCollected - currentPayoutIfNoWins;
    const currentWorstCase = Math.min(currentProfitIfYesWins, currentProfitIfNoWins);

    console.log(`🔍 CURRENT Platform Position Analysis:
        YES: ${preYesShares} shares, ₹${preYesValue} collected
        NO: ${preNoShares} shares, ₹${preNoValue} collected
        Total collected: ₹${currentCollected}
        If YES wins: Pay ₹${currentPayoutIfYesWins}, Profit: ₹${currentProfitIfYesWins}
        If NO wins: Pay ₹${currentPayoutIfNoWins}, Profit: ₹${currentProfitIfNoWins}
        Current worst case: ₹${currentWorstCase}`);

    if (currentWorstCase < 0) {
        console.log(`🚨 CRITICAL: Platform is ALREADY in losing position (₹${currentWorstCase})!`);
        console.log(`🛑 Rejecting new trade to prevent further losses.`);
        
        // Keep new trade as pending
        emitNewTrade(marketId, {
            _id: newTrade._id,
            option: newTrade.option,
            side: newTrade.side,
            amount: newTrade.amount,
            price: newTrade.price,
            status: "PENDING",
            user: newTrade.user,
            timestamp: newTrade.createdAt,
            reason: "Platform exposure exceeded"
        });

        return false; // Platform already losing, reject new trade
    }

    // Try to find profitable partial matches that maintain platform safety
    const yesTradesAvailable = [...pendingTrades.filter(t => t.option === "yes")];
    const noTradesAvailable = [...pendingTrades.filter(t => t.option === "no")];

    // Add new trade to appropriate list
    if (newTrade.option === "yes") {
        yesTradesAvailable.push(newTrade);
    } else {
        noTradesAvailable.push(newTrade);
    }

    // Sort by best prices for optimal matching
    yesTradesAvailable.sort((a, b) => b.price - a.price);
    noTradesAvailable.sort((a, b) => a.price - b.price);

    let bestExecutions = [];
    let bestTotalValue = 0;

    // **SAFE GREEDY MATCHING ALGORITHM**
    // Only execute pairs that guarantee platform profit
    for (let yesTradeIndex = 0; yesTradeIndex < yesTradesAvailable.length; yesTradeIndex++) {
        const yesTrade = yesTradesAvailable[yesTradeIndex];
        let yesRemainingAmount = yesTrade.remainingAmount || yesTrade.amount;

        if (yesRemainingAmount <= 0) continue;

        for (let noTradeIndex = 0; noTradeIndex < noTradesAvailable.length; noTradeIndex++) {
            const noTrade = noTradesAvailable[noTradeIndex];
            let noRemainingAmount = noTrade.remainingAmount || noTrade.amount;

            if (noRemainingAmount <= 0) continue;

            // STRICT CHECK: Only execute if pair generates PROFIT (not just break-even)
            const pairTotal = yesTrade.price + noTrade.price;
            if (pairTotal > 10) { // Must be > 10 for guaranteed profit
                const executionAmount = Math.min(yesRemainingAmount, noRemainingAmount);
                const executionValue = executionAmount * pairTotal;
                const platformProfit = executionValue - (executionAmount * 10);

                console.log(`💰 PROFITABLE PAIR FOUND:
                    YES: ${executionAmount} shares at ₹${yesTrade.price}
                    NO: ${executionAmount} shares at ₹${noTrade.price}
                    Pair total: ₹${pairTotal} (> ₹10)
                    Platform profit: ₹${platformProfit}`);

                bestExecutions.push({
                    yesTradeId: yesTrade._id,
                    noTradeId: noTrade._id,
                    amount: executionAmount,
                    yesPrice: yesTrade.price,
                    noPrice: noTrade.price,
                    totalValue: executionValue,
                    profit: platformProfit
                });

                bestTotalValue += executionValue;

                // Update remaining amounts
                yesRemainingAmount -= executionAmount;
                noRemainingAmount -= executionAmount;
                yesTrade.remainingAmount = yesRemainingAmount;
                noTrade.remainingAmount = noRemainingAmount;

                if (yesRemainingAmount <= 0) break;
            }
        }
    }

    console.log(`📈 EXECUTION SUMMARY:
        Found ${bestExecutions.length} profitable pairs
        Total execution value: ₹${bestTotalValue}`);

    // **EXECUTE ALL PROFITABLE PAIRS**
    if (bestExecutions.length > 0) {
        for (const execution of bestExecutions) {
            const yesTradeToUpdate = await Trade.findById(execution.yesTradeId);
            const noTradeToUpdate = await Trade.findById(execution.noTradeId);

            // Update YES trade
            const yesOriginalAmount = yesTradeToUpdate.amount;
            const yesExecutedSoFar = yesTradeToUpdate.executedAmount || 0;
            const yesNewExecuted = yesExecutedSoFar + execution.amount;

            await Trade.findByIdAndUpdate(execution.yesTradeId, {
                executePrice: execution.yesPrice,
                executedAmount: yesNewExecuted,
                status: yesNewExecuted >= yesOriginalAmount ? "EXECUTED" : "PARTIALLY_EXECUTED",
                executedAt: new Date()
            });

            // Update NO trade
            const noOriginalAmount = noTradeToUpdate.amount;
            const noExecutedSoFar = noTradeToUpdate.executedAmount || 0;
            const noNewExecuted = noExecutedSoFar + execution.amount;

            await Trade.findByIdAndUpdate(execution.noTradeId, {
                executePrice: execution.noPrice,
                executedAmount: noNewExecuted,
                status: noNewExecuted >= noOriginalAmount ? "EXECUTED" : "PARTIALLY_EXECUTED",
                executedAt: new Date()
            });

            console.log(`✅ EXECUTED PAIR:
                YES Trade ${execution.yesTradeId}: ${execution.amount} shares at ₹${execution.yesPrice}
                NO Trade ${execution.noTradeId}: ${execution.amount} shares at ₹${execution.noPrice}
                Platform profit: ₹${execution.profit}`);

            // Emit live trade notifications
            emitNewTrade(marketId, {
                _id: yesTradeToUpdate._id,
                option: "yes",
                side: yesTradeToUpdate.side,
                amount: execution.amount,
                price: execution.yesPrice,
                status: yesNewExecuted >= yesOriginalAmount ? "EXECUTED" : "PARTIALLY_EXECUTED",
                executedAmount: yesNewExecuted,
                user: yesTradeToUpdate.user,
                timestamp: new Date(),
                reason: "Partial execution matched"
            });

            emitNewTrade(marketId, {
                _id: noTradeToUpdate._id,
                option: "no",
                side: noTradeToUpdate.side,
                amount: execution.amount,
                price: execution.noPrice,
                status: noNewExecuted >= noOriginalAmount ? "EXECUTED" : "PARTIALLY_EXECUTED",
                executedAmount: noNewExecuted,
                user: noTradeToUpdate.user,
                timestamp: new Date(),
                reason: "Partial execution matched"
            });
        }

        // Emit updated order book after all executions
        emitOrderBookUpdate(marketId);
        return true;
    } else {
        console.log(`📋 NO PROFITABLE PAIRS FOUND - All trades remain pending`);
        
        // Emit the new trade as pending
        emitNewTrade(marketId, {
            _id: newTrade._id,
            option: newTrade.option,
            side: newTrade.side,
            amount: newTrade.amount,
            price: newTrade.price,
            status: "PENDING",
            user: newTrade.user,
            timestamp: newTrade.createdAt,
            reason: "No profitable matches available"
        });

        return false;
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

        // Emit order book update for partial executions
        emitOrderBookUpdate(marketId, {
            type: 'partial_execution',
            trades: executionsThisRound.map(exec => ({
                yesTradeId: exec.yesTradeId,
                noTradeId: exec.noTradeId,
                executedAmount: exec.amount,
                yesPrice: exec.yesPrice,
                noPrice: exec.noPrice
            }))
        });

        // Check if threshold reached after price update
        const thresholdTriggered = await checkMarketThreshold(marketId);
        if (thresholdTriggered) {
            console.log(`🎯 Market auto-settled due to threshold after partial executions!`);
        }

        return true; // Some executions happened
    } 
    
    // **COMPREHENSIVE PLATFORM EXPOSURE CHECK**
    // If no direct pairs found, check if ONLY the new trade can execute without platform loss
    console.log(`🔍 No direct pairs found. Checking if new trade alone is safe to execute...`);
    
    // Calculate current platform position from ONLY executed trades
    let currentYesShares = 0;
    let currentYesValue = 0;
    let currentNoShares = 0;
    let currentNoValue = 0;

    executedTrades.forEach(trade => {
        const tradeAmount = trade.executedAmount || trade.amount;
        if (trade.option === "yes") {
            currentYesShares += tradeAmount;
            currentYesValue += tradeAmount * trade.executePrice;
        } else {
            currentNoShares += tradeAmount;
            currentNoValue += tradeAmount * trade.executePrice;
        }
    });

    // Calculate position if ONLY the new trade is added (don't include pending trades)
    let newYesShares = currentYesShares;
    let newYesValue = currentYesValue;
    let newNoShares = currentNoShares;
    let newNoValue = currentNoValue;

    // Add ONLY the new trade
    if (newTrade.option === "yes") {
        newYesShares += newTrade.amount;
        newYesValue += newTrade.amount * newTrade.price;
    } else {
        newNoShares += newTrade.amount;
        newNoValue += newTrade.amount * newTrade.price;
    }

    // Calculate platform profit scenarios with ONLY the new trade added
    const totalCollected = newYesValue + newNoValue;
    const payoutIfYesWins = newYesShares * 10;
    const payoutIfNoWins = newNoShares * 10;
    const profitIfYesWins = totalCollected - payoutIfYesWins;
    const profitIfNoWins = totalCollected - payoutIfNoWins;
    const worstCaseProfit = Math.min(profitIfYesWins, profitIfNoWins);

    console.log(`💰 Platform Exposure Analysis (Current + New Trade Only):
        Current position: ${currentYesShares} YES, ${currentNoShares} NO
        After new trade: ${newYesShares} YES, ${newNoShares} NO
        Total would be collected: ₹${totalCollected}
        Payout if YES wins: ₹${payoutIfYesWins}
        Payout if NO wins: ₹${payoutIfNoWins}
        Profit if YES wins: ₹${profitIfYesWins}
        Profit if NO wins: ₹${profitIfNoWins}
        Worst case profit: ₹${worstCaseProfit}`);

    // Execute new trade if platform doesn't lose money in worst case scenario
    if (worstCaseProfit >= 0) {
        console.log(`🚀 EXECUTING NEW TRADE - Platform guaranteed no loss! (Worst case: ₹${worstCaseProfit})`);
        
        // Execute ONLY the new trade (don't execute pending trades)
        newTrade.status = "EXECUTED";
        newTrade.executePrice = newTrade.price;
        newTrade.executedAmount = newTrade.amount;
        await newTrade.save();

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

            // Update market with volume-weighted average prices
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

        // Emit market update (single trade execution)
        emitMarketPriceUpdate(marketId, {
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            totalYesAmount: market.totalYesAmount,
            totalNoAmount: market.totalNoAmount,
            executed: true,
            singleTradeExecution: true,
            newTradeAmount: newTrade.amount,
            newTradeOption: newTrade.option
        });

        // Check threshold after execution
        const thresholdTriggered = await checkMarketThreshold(marketId);
        if (thresholdTriggered) {
            console.log(`🎯 Market auto-settled due to threshold after single trade execution!`);
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
