import React, { useState, useEffect } from "react";
import { marketAPI } from "../services/api";
import webSocketService from "../services/websocket";

export default function LiveOrders({ marketId }) {
  const [recentTrades, setRecentTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrderBook = async () => {
      if (!marketId) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await marketAPI.getOrderBook(marketId);
        
        if (response.success) {
          // Show pending orders as "live orders"
          const allOrders = [
            ...response.data.yesOrders.map(order => ({ ...order, option: 'YES', side: 'BUY' })),
            ...response.data.noOrders.map(order => ({ ...order, option: 'NO', side: 'BUY' }))
          ].sort((a, b) => b.price - a.price); // Sort by price descending
          
          setRecentTrades(allOrders.slice(0, 10)); // Show top 10 orders
        }
      } catch (error) {
        console.error('Error fetching live orders:', error);
        setError('Failed to load live orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderBook();

    // Listen for new trades
    if (marketId) {
      const handleNewTrade = (data) => {
        if (data.marketId === marketId) {
          // Refresh the order book when new trades come in
          fetchOrderBook();
        }
      };

      webSocketService.onTradeUpdate(handleNewTrade);

      return () => {
        webSocketService.off('market:newTrade', handleNewTrade);
      };
    }
  }, [marketId]);

  if (loading) {
    return (
      <div className="bg-[#181c24] rounded-xl p-4 mb-4 shadow-lg border border-[#23283a] h-90">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold">Live Orders</span>
          <span className="bg-gray-700 px-2 py-1 rounded-full text-xs">Real time</span>
        </div>
        <div className="text-xs text-gray-400 mb-4">Latest betting activity on this market</div>
        <div className="flex flex-col items-center justify-center h-32">
          <div className="text-gray-400">Loading live orders...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#181c24] rounded-xl p-4 mb-4 shadow-lg border border-[#23283a] h-90">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold">Live Orders</span>
          <span className="bg-gray-700 px-2 py-1 rounded-full text-xs">Real time</span>
        </div>
        <div className="text-xs text-gray-400 mb-4">Latest betting activity on this market</div>
        <div className="flex flex-col items-center justify-center h-32">
          <div className="text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#181c24] rounded-xl p-4 mb-4 shadow-lg border border-[#23283a] h-90">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold">Live Orders</span>
        <span className="bg-gray-700 px-2 py-1 rounded-full text-xs">Real time</span>
      </div>
      <div className="text-xs text-gray-400 mb-4">Latest betting activity on this market</div>
      
      {recentTrades.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32">
          <span className="text-3xl text-gray-500 mb-2">👥</span>
          <div className="font-semibold text-gray-300">No orders yet</div>
          <div className="text-xs text-gray-400">Be the first to place an order on this market!</div>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {recentTrades.map((trade, idx) => (
            <div key={trade.id || idx} className="flex justify-between items-center p-2 bg-[#1f2430] rounded border border-[#2a3441]">
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm ${trade.option === 'YES' ? 'text-green-400' : 'text-red-400'}`}>
                  {trade.option}
                </span>
                <span className="text-gray-400 text-xs">{trade.side}</span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-white text-sm">₹{trade.price.toFixed(1)}</div>
                  <div className="text-gray-400 text-xs">{trade.quantity} shares</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}