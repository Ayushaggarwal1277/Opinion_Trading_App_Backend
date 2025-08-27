import React, { useState, useEffect } from "react";
import { marketAPI } from "../services/api";

export default function YourOrders({ marketId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserOrders = async () => {
      if (!marketId) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await marketAPI.getUserOrders(marketId);
        
        if (response.success) {
          setOrders(response.data.orders || []);
        }
      } catch (error) {
        console.error('Error fetching user orders:', error);
        setError('Failed to load your orders');
      } finally {
        setLoading(false);
      }
    };

    fetchUserOrders();
  }, [marketId]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-400';
      case 'EXECUTED': return 'text-green-400';
      case 'CANCELLED': return 'text-red-400';
      case 'SETTLED': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING': return '⏳';
      case 'EXECUTED': return '✅';
      case 'CANCELLED': return '❌';
      case 'SETTLED': return '🏆';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="bg-[#181c24] rounded-xl p-4 shadow-lg border border-[#23283a]">
        <span className="font-semibold">Your Orders</span>
        <div className="flex flex-col items-center justify-center h-32">
          <div className="text-gray-400">Loading your orders...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#181c24] rounded-xl p-4 shadow-lg border border-[#23283a]">
        <span className="font-semibold">Your Orders</span>
        <div className="flex flex-col items-center justify-center h-32">
          <div className="text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#181c24] rounded-xl p-4 shadow-lg border border-[#23283a]">
      <span className="font-semibold mb-4 block">Your Orders ({orders.length})</span>
      
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32">
          <span className="text-3xl text-gray-500 mb-2">⏳</span>
          <div className="font-semibold text-gray-300">No orders yet</div>
          <div className="text-xs text-gray-400">Your order history will appear here</div>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {orders.map((order) => (
            <div key={order._id} className="bg-[#1f2430] rounded-lg p-3 border border-[#2a3441]">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${order.option === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                    {order.option.toUpperCase()}
                  </span>
                  <span className="text-gray-300 text-sm">{order.side.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={getStatusColor(order.status)}>{getStatusIcon(order.status)}</span>
                  <span className={`text-xs ${getStatusColor(order.status)}`}>{order.status}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-white ml-1">{order.amount} shares</span>
                </div>
                <div>
                  <span className="text-gray-400">Price:</span>
                  <span className="text-white ml-1">₹{order.price}</span>
                </div>
                
                {order.status === 'EXECUTED' && order.executePrice && (
                  <>
                    <div>
                      <span className="text-gray-400">Executed:</span>
                      <span className="text-green-400 ml-1">{order.executedAmount || order.amount} shares</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Exec Price:</span>
                      <span className="text-green-400 ml-1">₹{order.executePrice}</span>
                    </div>
                  </>
                )}
              </div>
              
              <div className="mt-2 text-xs text-gray-500">
                {new Date(order.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}