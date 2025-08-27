import React, { useState, useEffect } from 'react';
import webSocketService from '../services/websocket';
import { useAuth } from '../context/AuthContext';

const NotificationPanel = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    // Listen for various trade notifications
    const handleTradeSettled = (data) => {
      const notification = {
        id: Date.now() + Math.random(),
        type: 'trade-settled',
        title: data.won ? '🎉 Trade Won!' : '😞 Trade Lost',
        message: data.won 
          ? `You won ₹${data.payout} from your ${data.trade.option.toUpperCase()} trade!`
          : `Your ${data.trade.option.toUpperCase()} trade didn't win. Better luck next time!`,
        data: data,
        timestamp: new Date(),
        read: false
      };
      addNotification(notification);
    };

    const handleTradeSummary = (data) => {
      const profit = data.netResult > 0;
      const notification = {
        id: Date.now() + Math.random(),
        type: 'trade-summary',
        title: '📊 Market Settlement Summary',
        message: `Market "${data.marketQuestion}" settled. ${profit ? `You made ₹${data.netResult}!` : `You lost ₹${Math.abs(data.netResult)}.`}`,
        data: data,
        timestamp: new Date(),
        read: false
      };
      addNotification(notification);
    };

    const handleMarketOutcome = (data) => {
      const notification = {
        id: Date.now() + Math.random(),
        type: 'market-outcome',
        title: '🏁 Market Resolved',
        message: `"${data.marketQuestion}" resolved as ${data.result}. Actual: ${data.actualValue}°C, Threshold: ${data.threshold}°C`,
        data: data,
        timestamp: new Date(),
        read: false
      };
      addNotification(notification);
    };

    const handleTradeRefunded = (data) => {
      const notification = {
        id: Date.now() + Math.random(),
        type: 'trade-refunded',
        title: '💰 Trade Refunded',
        message: `Your ${data.trade.option.toUpperCase()} trade was refunded ₹${data.refundAmount}. Reason: ${data.reason}`,
        data: data,
        timestamp: new Date(),
        read: false
      };
      addNotification(notification);
    };

    // Set up WebSocket listeners
    webSocketService.on('user:tradeSettled', handleTradeSettled);
    webSocketService.on('user:tradeSummary', handleTradeSummary);
    webSocketService.on('market:outcome', handleMarketOutcome);
    webSocketService.on('user:tradeRefunded', handleTradeRefunded);

    return () => {
      webSocketService.off('user:tradeSettled');
      webSocketService.off('user:tradeSummary');
      webSocketService.off('market:outcome');
      webSocketService.off('user:tradeRefunded');
    };
  }, [user?.id]);

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 19)]); // Keep last 20
    setUnreadCount(prev => prev + 1);
  };

  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setUnreadCount(0);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'trade-settled': return '💰';
      case 'trade-summary': return '📊';
      case 'market-outcome': return '🏁';
      case 'trade-refunded': return '↩️';
      default: return '🔔';
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user?.isAuthenticated) return null;

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white hover:text-teal-400 transition-colors"
      >
        <span className="material-icons text-2xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-gray-800 rounded-lg shadow-xl z-50 border border-gray-700">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-teal-400 hover:text-teal-300"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No notifications yet
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-700 ${
                    !notification.read ? 'bg-gray-750' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className={`text-sm font-medium ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                          {notification.title}
                        </p>
                        <span className="text-xs text-gray-400">{formatTime(notification.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{notification.message}</p>
                      
                      {/* Additional details for trade summary */}
                      {notification.type === 'trade-summary' && notification.data && (
                        <div className="mt-2 text-xs text-gray-500">
                          <div>Invested: ₹{notification.data.totalInvested}</div>
                          <div>Payout: ₹{notification.data.totalPayout}</div>
                          <div className={notification.data.netResult >= 0 ? 'text-green-400' : 'text-red-400'}>
                            Net: {notification.data.netResult >= 0 ? '+' : ''}₹{notification.data.netResult}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-teal-500 rounded-full ml-auto mt-1"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
