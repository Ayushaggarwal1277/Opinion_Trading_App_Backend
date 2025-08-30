import cron from "node-cron";
import { Market } from "../models/market.models.js";
import fetch from "node-fetch"; 
import { Trade } from "../models/trade.models.js";
import { 
    emitMarketExpired, 
    emitMarketSettled, 
    emitUserBalanceUpdate, 
    emitUserTradeRefunded,
    emitMarketPriceUpdate,
    emitUserTradeSettled,
    emitMarketOutcomeNotification,
    emitUserTradeSummary
} from "../utils/websocket.js";

// Check markets every minute - update amounts and expire when time reached
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    
    // Update amounts for all active markets
    const activeMarkets = await Market.find({ status: "active" });
    
    for (let market of activeMarkets) {
      // Calculate current amounts from executed trades
      // For YES: buy side adds to YES amount, sell side subtracts from YES amount
      const yesBuyTrades = await Trade.find({ 
        market: market._id, 
        option: "yes", 
        side: "buy",
        status: "EXECUTED" 
      });
      
      const yesSellTrades = await Trade.find({ 
        market: market._id, 
        option: "yes", 
        side: "sell",
        status: "EXECUTED" 
      });
      
      const noBuyTrades = await Trade.find({ 
        market: market._id, 
        option: "no", 
        side: "buy",
        status: "EXECUTED" 
      });
      
      const noSellTrades = await Trade.find({ 
        market: market._id, 
        option: "no", 
        side: "sell",
        status: "EXECUTED" 
      });
      
      // Calculate total amounts (buy adds, sell subtracts)
      const totalYesBuy = yesBuyTrades.reduce((sum, trade) => sum + trade.executedAmount, 0);
      const totalYesSell = yesSellTrades.reduce((sum, trade) => sum + trade.executedAmount, 0);
      const totalNoBuy = noBuyTrades.reduce((sum, trade) => sum + trade.executedAmount, 0);
      const totalNoSell = noSellTrades.reduce((sum, trade) => sum + trade.executedAmount, 0);
      
      const totalYesAmount = totalYesBuy - totalYesSell;
      const totalNoAmount = totalNoBuy - totalNoSell;
      
      // Update market amounts
      market.totalYesAmount = totalYesAmount;
      market.totalNoAmount = totalNoAmount;
      
      // Emit real-time amount updates
      emitMarketPriceUpdate(market._id.toString(), {
        yesPrice: market.yesPrice,
        noPrice: market.noPrice,
        totalYesAmount: market.totalYesAmount,
        totalNoAmount: market.totalNoAmount
      });
      
      // **NEW FEATURE: Check threshold-based auto-settlement**
      // If YES price goes above threshold, trigger immediate settlement
      let shouldAutoSettle = false;
      let autoSettleReason = "";
      
      if (market.yesPrice >= market.threshold) {
        shouldAutoSettle = true;
        autoSettleReason = `YES price (₹${market.yesPrice}) reached threshold (₹${market.threshold})`;
        console.log(`🚨 THRESHOLD TRIGGERED: ${market.question} - ${autoSettleReason}`);
      }
      
      // Check if market has expired OR threshold reached
      if (market.expiry <= now || shouldAutoSettle) {
        const expiryReason = shouldAutoSettle ? autoSettleReason : `Time expired at: ${market.expiry}`;
        console.log(`Expiring market: ${market.question} - ${expiryReason}`);
        market.status = "expired";
        
        // Emit market expiry notification with reason
        emitMarketExpired(market._id.toString(), {
          question: market.question,
          expiry: market.expiry,
          reason: expiryReason,
          autoSettled: shouldAutoSettle,
          thresholdTriggered: shouldAutoSettle
        });
        
        // Handle pending trades - refund users
        const pendingTrades = await Trade.find({ 
          market: market._id, 
          status: "PENDING" 
        }).populate('user');
        
        for (let trade of pendingTrades) {
          // Refund the user's money (amount * price for buy orders)
          const refundAmount = trade.side === "buy" ? trade.amount * trade.price : trade.amount * (10 - trade.price);
          trade.user.balance += refundAmount;
          await trade.user.save();
          
          // Emit user balance update
          emitUserBalanceUpdate(trade.user._id.toString(), {
            newBalance: trade.user.balance,
            change: refundAmount,
            reason: `Market expired - trade refunded`
          });

          // Emit trade refund notification
          emitUserTradeRefunded(trade.user._id.toString(), {
            trade: {
              _id: trade._id,
              option: trade.option,
              side: trade.side,
              amount: trade.amount,
              price: trade.price,
              marketId: market._id
            },
            refundAmount: refundAmount,
            reason: "Market expired"
          });
          
          // Mark trade as cancelled
          trade.status = "CANCELLED";
          await trade.save();
        }
        
        console.log(`Market ${market.question} has been expired and ${pendingTrades.length} pending trades were cancelled`);
      }
      
      await market.save();
      console.log(`Updated amounts for market "${market.question}": totalYesAmount=${totalYesAmount} (buy: ${totalYesBuy}, sell: ${totalYesSell}), totalNoAmount=${totalNoAmount} (buy: ${totalNoBuy}, sell: ${totalNoSell})`);
    }
    
    const expiredCount = activeMarkets.filter(m => m.expiry <= now).length;
    if (expiredCount > 0) {
      console.log(`Processed ${expiredCount} expired markets and updated ${activeMarkets.length} market amounts`);
    }
  } catch (error) {
    console.error("Error in market amount update and expiry scheduler:", error);
  }
});

// Settle markets every minute (changed from every 15 minutes)
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    // Find markets that just expired and need settlement
    const marketsToSettle = await Market.find({
      status: "expired",
      result: { $exists: false } // Only markets that haven't been settled yet
    });

    for (let market of marketsToSettle) {
      console.log(`Settling market: ${market.question}`);

      let result;
      let settlementData = {};

      // **ENHANCED SETTLEMENT LOGIC**
      // Check if market was auto-settled due to threshold or expired naturally
      const wasThresholdTriggered = market.yesPrice >= market.threshold;
      
      if (wasThresholdTriggered) {
        // Threshold-based settlement: YES wins automatically
        result = "YES";
        settlementData = {
          type: "threshold",
          yesPrice: market.yesPrice,
          threshold: market.threshold,
          reason: `YES price reached ₹${market.yesPrice} (threshold: ₹${market.threshold})`
        };
        console.log(`🎯 Threshold settlement: ${market.question} - YES WINS (price: ₹${market.yesPrice})`);
      } else {
        // Time-based settlement: Use real-world data (temperature)
        let temp;
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=28.625&longitude=77.25&current_weather=true`);
          const data = await res.json();
          temp = data.current_weather.temperature;
          console.log(`Current temperature: ${temp}°C, Threshold: ${market.threshold}°C`);
        } catch (err) {
          console.error("Failed to fetch real-world data", err);
          continue; // skip this market for now
        }

        // Determine result based on temperature
        result = temp >= market.threshold ? "YES" : "NO";
        settlementData = {
          type: "time_based",
          temperature: temp,
          threshold: market.threshold,
          reason: `Market expired - Temperature: ${temp}°C ${temp >= market.threshold ? '>=' : '<'} ${market.threshold}°C`
        };
        console.log(`⏰ Time-based settlement: ${market.question} - ${result} WINS (temp: ${temp}°C)`);
      }

      // Update market with result
      market.result = result;
      await market.save();

      // Emit market settlement notification with enhanced data
      emitMarketSettled(market._id.toString(), {
        result: result,
        question: market.question,
        settlementType: settlementData.type,
        reason: settlementData.reason,
        ...settlementData // spread temperature/threshold/yesPrice data
      });

      // Process executed trades and calculate winnings
      const trades = await Trade.find({ market: market._id, status: "EXECUTED" }).populate('user');
      
      // Track user trade summaries
      const userTradeSummaries = {};
      
      for (let trade of trades) {
        let payout = 0;
        const won = trade.option.toUpperCase() === result;

        if (won) {
          // Winner gets 9 per share
          payout = trade.executedAmount * 9;
        } else {
          // Loser gets nothing
          payout = 0;
        }

        const oldBalance = trade.user.balance;
        trade.user.balance += payout;
        await trade.user.save();

        // Emit balance update
        emitUserBalanceUpdate(trade.user._id.toString(), {
          newBalance: trade.user.balance,
          change: payout,
          reason: `Market settled - ${won ? 'You won!' : 'You lost - no payout'}`
        });

        // Emit individual trade settlement notification
        emitUserTradeSettled(trade.user._id.toString(), {
          trade: {
            _id: trade._id,
            option: trade.option,
            side: trade.side,
            amount: trade.executedAmount,
            price: trade.price,
            marketId: market._id
          },
          payout: payout,
          marketResult: result,
          won: won,
          marketQuestion: market.question
        });

        // Track user summary data
        const userId = trade.user._id.toString();
        if (!userTradeSummaries[userId]) {
          userTradeSummaries[userId] = {
            userId: userId,
            marketId: market._id,
            marketQuestion: market.question,
            totalInvested: 0,
            totalPayout: 0,
            trades: [],
            marketResult: result
          };
        }

        const tradeInvestment = trade.side === "buy" ? 
          trade.executedAmount * trade.price : 
          trade.executedAmount * (10 - trade.price);

        userTradeSummaries[userId].totalInvested += tradeInvestment;
        userTradeSummaries[userId].totalPayout += payout;
        userTradeSummaries[userId].trades.push({
          _id: trade._id,
          option: trade.option,
          side: trade.side,
          amount: trade.executedAmount,
          price: trade.price,
          invested: tradeInvestment,
          payout: payout,
          won: won
        });

        trade.status = "SETTLED";
        await trade.save();
      }

      // Send trade summary notifications to each user
      Object.values(userTradeSummaries).forEach(summary => {
        summary.netResult = summary.totalPayout - summary.totalInvested;
        
        // Send comprehensive trade summary
        emitUserTradeSummary(summary.userId, summary);
        
        // Send market outcome notification
        emitMarketOutcomeNotification(summary.userId, {
          marketId: market._id,
          marketQuestion: market.question,
          result: result,
          threshold: market.threshold,
          actualValue: temp,
          userTrades: summary.trades,
          totalPayout: summary.totalPayout
        });
      });

      // Handle pending trades - refund users
      const pendingTrades = await Trade.find({ market: market._id, status: "PENDING" }).populate('user');
      for (let trade of pendingTrades) {
        const refundAmount = trade.side === "buy" ? trade.amount * trade.price : trade.amount * (10 - trade.price);
        trade.user.balance += refundAmount;
        await trade.user.save();
        
        // Emit balance update for refunds
        emitUserBalanceUpdate(trade.user._id.toString(), {
          newBalance: trade.user.balance,
          change: refundAmount,
          reason: `Market settled - pending trade refunded`
        });

        // Emit trade refund notification
        emitUserTradeRefunded(trade.user._id.toString(), {
          trade: {
            _id: trade._id,
            option: trade.option,
            side: trade.side,
            amount: trade.amount,
            price: trade.price,
            marketId: market._id
          },
          refundAmount: refundAmount,
          reason: "Market settled"
        });
        
        trade.status = "CANCELLED";
        await trade.save();
      }

      console.log(`Market "${market.question}" settled with result: ${result}. Processed ${trades.length} executed trades and ${pendingTrades.length} pending trades.`);
    }

    if (marketsToSettle.length > 0) {
      console.log(`Settled ${marketsToSettle.length} markets`);
    }
  } catch (error) {
    console.error("Error in market settlement scheduler:", error);
  }
});

// **NEW FUNCTION: Check threshold immediately after trade execution**
export const checkMarketThreshold = async (marketId) => {
  try {
    const market = await Market.findById(marketId);
    if (!market || market.status !== "active") return;

    console.log(`🔍 Checking threshold for market: ${market.question} (YES: ₹${market.yesPrice}, Threshold: ₹${market.threshold})`);

    if (market.yesPrice >= market.threshold) {
      console.log(`🚨 IMMEDIATE THRESHOLD SETTLEMENT: ${market.question} - YES price (₹${market.yesPrice}) >= threshold (₹${market.threshold})`);
      
      // Mark market as expired for immediate settlement
      market.status = "expired";
      await market.save();

      // Emit immediate expiry notification
      emitMarketExpired(market._id.toString(), {
        question: market.question,
        expiry: market.expiry,
        reason: `YES price (₹${market.yesPrice}) reached threshold (₹${market.threshold})`,
        autoSettled: true,
        thresholdTriggered: true,
        immediate: true
      });

      // Handle pending trades - refund users immediately
      const pendingTrades = await Trade.find({ 
        market: market._id, 
        status: "PENDING" 
      }).populate('user');

      for (let trade of pendingTrades) {
        const refundAmount = trade.side === "buy" ? trade.amount * trade.price : trade.amount * (10 - trade.price);
        trade.user.balance += refundAmount;
        await trade.user.save();
        
        emitUserBalanceUpdate(trade.user._id.toString(), {
          newBalance: trade.user.balance,
          change: refundAmount,
          reason: `Threshold reached - trade refunded`
        });

        emitUserTradeRefunded(trade.user._id.toString(), {
          trade: {
            _id: trade._id,
            option: trade.option,
            side: trade.side,
            amount: trade.amount,
            price: trade.price,
            marketId: market._id
          },
          refundAmount: refundAmount,
          reason: "Threshold reached - market auto-settled"
        });
        
        trade.status = "CANCELLED";
        await trade.save();
      }

      console.log(`✅ Market ${market.question} auto-expired due to threshold. ${pendingTrades.length} pending trades cancelled.`);
      return true; // Threshold was triggered
    }
    
    return false; // Threshold not reached
  } catch (error) {
    console.error("Error checking market threshold:", error);
    return false;
  }
};
