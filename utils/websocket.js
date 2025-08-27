import { Server } from 'socket.io';

let io;

// Initialize WebSocket server
export const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join market room for real-time updates
    socket.on('join-market', (marketId) => {
      socket.join(`market-${marketId}`);
      console.log(`User ${socket.id} joined market ${marketId}`);
    });

    // Leave market room
    socket.on('leave-market', (marketId) => {
      socket.leave(`market-${marketId}`);
      console.log(`User ${socket.id} left market ${marketId}`);
    });

    // Join user room for personal notifications
    socket.on('join-user', (userId) => {
      socket.join(`user-${userId}`);
      console.log(`User ${socket.id} joined personal room ${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Get WebSocket instance
export const getWebSocketInstance = () => {
  if (!io) {
    throw new Error('WebSocket not initialized. Call initializeWebSocket first.');
  }
  return io;
};

// Market-related events
export const emitMarketPriceUpdate = (marketId, priceData) => {
  if (io) {
    io.to(`market-${marketId}`).emit('market:priceUpdate', {
      marketId,
      yesPrice: priceData.yesPrice,
      noPrice: priceData.noPrice,
      totalYesAmount: priceData.totalYesAmount,
      totalNoAmount: priceData.totalNoAmount,
      timestamp: new Date()
    });
    console.log(`Market price update sent for market ${marketId}:`, priceData);
  }
};

export const emitNewTrade = (marketId, tradeData) => {
  if (io) {
    io.to(`market-${marketId}`).emit('market:newTrade', {
      marketId,
      trade: tradeData,
      timestamp: new Date()
    });
    console.log(`New trade notification sent for market ${marketId}`);
  }
};

export const emitMarketExpired = (marketId, marketData) => {
  if (io) {
    io.to(`market-${marketId}`).emit('market:expired', {
      marketId,
      question: marketData.question,
      expiry: marketData.expiry,
      timestamp: new Date()
    });
    console.log(`Market expired notification sent for market ${marketId}`);
  }
};

export const emitMarketSettled = (marketId, settlementData) => {
  if (io) {
    io.to(`market-${marketId}`).emit('market:settled', {
      marketId,
      result: settlementData.result,
      question: settlementData.question,
      temperature: settlementData.temperature,
      threshold: settlementData.threshold,
      timestamp: new Date()
    });
    console.log(`Market settlement notification sent for market ${marketId}:`, settlementData.result);
  }
};

// User-related events
export const emitUserBalanceUpdate = (userId, balanceData) => {
  if (io) {
    io.to(`user-${userId}`).emit('user:balanceUpdate', {
      userId,
      newBalance: balanceData.newBalance,
      change: balanceData.change,
      reason: balanceData.reason,
      timestamp: new Date()
    });
    console.log(`Balance update sent to user ${userId}: ${balanceData.newBalance}`);
  }
};

export const emitUserTradeExecuted = (userId, tradeData) => {
  if (io) {
    io.to(`user-${userId}`).emit('user:tradeExecuted', {
      userId,
      trade: tradeData,
      timestamp: new Date()
    });
    console.log(`Trade execution notification sent to user ${userId}`);
  }
};

export const emitUserTradeRefunded = (userId, refundData) => {
  if (io) {
    io.to(`user-${userId}`).emit('user:tradeRefunded', {
      userId,
      trade: refundData.trade,
      refundAmount: refundData.refundAmount,
      reason: refundData.reason,
      timestamp: new Date()
    });
    console.log(`Trade refund notification sent to user ${userId}`);
  }
};

// Emit trade settlement result to user
export const emitUserTradeSettled = (userId, settlementData) => {
  if (io) {
    io.to(`user-${userId}`).emit('user:tradeSettled', {
      userId,
      trade: settlementData.trade,
      payout: settlementData.payout,
      marketResult: settlementData.marketResult,
      won: settlementData.won,
      marketQuestion: settlementData.marketQuestion,
      timestamp: new Date()
    });
    console.log(`Trade settlement notification sent to user ${userId}`);
  }
};

// Emit market outcome notification to user
export const emitMarketOutcomeNotification = (userId, outcomeData) => {
  if (io) {
    io.to(`user-${userId}`).emit('market:outcome', {
      userId,
      marketId: outcomeData.marketId,
      marketQuestion: outcomeData.marketQuestion,
      result: outcomeData.result,
      threshold: outcomeData.threshold,
      actualValue: outcomeData.actualValue,
      userTrades: outcomeData.userTrades,
      totalPayout: outcomeData.totalPayout,
      timestamp: new Date()
    });
    console.log(`Market outcome notification sent to user ${userId}`);
  }
};

// Emit detailed trade summary after market settlement
export const emitUserTradeSummary = (userId, summaryData) => {
  if (io) {
    io.to(`user-${userId}`).emit('user:tradeSummary', {
      userId,
      marketId: summaryData.marketId,
      marketQuestion: summaryData.marketQuestion,
      totalInvested: summaryData.totalInvested,
      totalPayout: summaryData.totalPayout,
      netResult: summaryData.netResult,
      trades: summaryData.trades,
      marketResult: summaryData.marketResult,
      timestamp: new Date()
    });
    console.log(`Trade summary notification sent to user ${userId}`);
  }
};

// Broadcast to all connected users
export const broadcastToAll = (event, data) => {
  if (io) {
    io.emit(event, {
      ...data,
      timestamp: new Date()
    });
    console.log(`Broadcast sent to all users: ${event}`);
  }
};
