import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  // Initialize WebSocket connection
  connect() {
    if (this.socket) {
      return this.socket;
    }

    this.socket = io('http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.isConnected = false;
    });

    return this.socket;
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Join a market room for real-time updates
  joinMarket(marketId) {
    if (this.socket && this.isConnected) {
      console.log('Joining market room:', marketId);
      this.socket.emit('join-market', marketId);
    } else {
      console.log('Cannot join market - socket not connected:', {
        hasSocket: !!this.socket,
        isConnected: this.isConnected
      });
    }
  }

  // Leave a market room
  leaveMarket(marketId) {
    if (this.socket && this.isConnected) {
      console.log('Leaving market room:', marketId);
      this.socket.emit('leave-market', marketId);
    }
  }

  // Join user room for personal notifications
  joinUser(userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-user', userId);
    }
  }

  // Listen for market updates
  onMarketUpdate(callback) {
    if (this.socket) {
      console.log('Setting up market update listener');
      this.socket.on('market:priceUpdate', (data) => {
        console.log('WebSocket received market:priceUpdate:', data);
        callback(data);
      });
    }
  }

  // Listen for trade updates
  onTradeUpdate(callback) {
    if (this.socket) {
      console.log('Setting up trade update listener');
      this.socket.on('market:newTrade', (data) => {
        console.log('WebSocket received market:newTrade:', data);
        callback(data);
      });
    }
  }

  // Listen for price updates
  onPriceUpdate(callback) {
    if (this.socket) {
      this.socket.on('market:priceUpdate', callback);
    }
  }

  // Listen for order book updates
  onOrderBookUpdate(callback) {
    if (this.socket) {
      this.socket.on('orderbook-update', callback);
    }
  }

  // Listen for user notifications
  onUserNotification(callback) {
    if (this.socket) {
      this.socket.on('user-notification', callback);
    }
  }

  // Listen for trade settlement notifications
  onTradeSettled(callback) {
    if (this.socket) {
      this.socket.on('user:tradeSettled', callback);
    }
  }

  // Listen for trade summary notifications
  onTradeSummary(callback) {
    if (this.socket) {
      this.socket.on('user:tradeSummary', callback);
    }
  }

  // Listen for market outcome notifications
  onMarketOutcome(callback) {
    if (this.socket) {
      this.socket.on('market:outcome', callback);
    }
  }

  // Listen for trade refund notifications
  onTradeRefunded(callback) {
    if (this.socket) {
      this.socket.on('user:tradeRefunded', callback);
    }
  }

  // Generic event listener
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Remove event listeners
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Check if connected
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }
}

// Create a singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;
