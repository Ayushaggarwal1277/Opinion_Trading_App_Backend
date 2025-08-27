import React, { useState, useEffect } from "react";
import { marketAPI } from "../services/api";

export default function OrderBook({ marketId }) {
  const [yesOrders, setYesOrders] = useState([]);
  const [noOrders, setNoOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch order book data
  useEffect(() => {
    const fetchOrderBook = async () => {
      if (!marketId) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await marketAPI.getOrderBook(marketId);
        
        if (response.success) {
          setYesOrders(response.data.yesOrders || []);
          setNoOrders(response.data.noOrders || []);
        }
      } catch (error) {
        console.error('Error fetching order book:', error);
        setError('Failed to load order book');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderBook();
  }, [marketId]);

  // Find max quantity for slider width calculation
  const maxYes = Math.max(...yesOrders.map(o => o.quantity), 1);
  const maxNo = Math.max(...noOrders.map(o => o.quantity), 1);

  if (loading) {
    return (
      <div className="bg-[#181c24] rounded-xl p-4 mb-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[#23283a]">
        <div className="text-center py-8">
          <div className="text-gray-400">Loading order book...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#181c24] rounded-xl p-4 mb-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[#23283a]">
        <div className="text-center py-8">
          <div className="text-red-400">{error}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-[#181c24] rounded-xl p-4 mb-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[#23283a]">
      <div className="flex gap-8">
        {/* YES Orders */}
        <div className="flex-1">
          <div className="text-green-300 font-semibold mb-2">PRICE</div>
          <div className="text-xs text-gray-400 mb-1">Available YES Orders</div>
          <div>
            {yesOrders.length > 0 ? (
              yesOrders.map((order, idx) => (
                <div key={idx} className="flex items-center mb-2">
                  <span className="text-green-300 w-16">{`₹${order.price.toFixed(2)}`}</span>
                  <div className="flex-1 mx-2 h-4 bg-green-900 rounded relative">
                    <div
                      className="absolute left-0 top-0 h-4 bg-green-500 rounded"
                      style={{
                        width: `${(order.quantity / maxYes) * 100}%`,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span className="text-green-300 font-bold w-6 text-right">{order.quantity}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm">
                No YES orders available
              </div>
            )}
          </div>
        </div>
        {/* NO Orders */}
        <div className="flex-1">
          <div className="text-red-300 font-semibold mb-2">PRICE</div>
          <div className="text-xs text-gray-400 mb-1">Available NO Orders</div>
          <div>
            {noOrders.length > 0 ? (
              noOrders.map((order, idx) => (
                <div key={idx} className="flex items-center mb-2">
                  <span className="text-red-300 w-16">{`₹${order.price.toFixed(2)}`}</span>
                  <div className="flex-1 mx-2 h-4 bg-red-900 rounded relative">
                    <div
                      className="absolute left-0 top-0 h-4 bg-red-500 rounded"
                      style={{
                        width: `${(order.quantity / maxNo) * 100}%`,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span className="text-red-300 font-bold w-6 text-right">{order.quantity}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm">
                No NO orders available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}