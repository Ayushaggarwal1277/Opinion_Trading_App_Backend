import React, { useState, useEffect } from "react";
import webSocketService from "../services/websocket";

export default function QuickStats({ marketId, market }) {
  const [currentMarket, setCurrentMarket] = useState(market);

  // Update local state when market prop changes
  useEffect(() => {
    setCurrentMarket(market);
  }, [market]);

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!marketId) return;

    const handleMarketUpdate = (updatedMarket) => {
      if (updatedMarket.marketId === marketId) {
        console.log('QuickStats received market update:', updatedMarket);
        setCurrentMarket(prevMarket => ({
          ...prevMarket,
          yesPrice: updatedMarket.yesPrice,
          noPrice: updatedMarket.noPrice,
          totalVolume: (updatedMarket.totalYesAmount || 0) + (updatedMarket.totalNoAmount || 0)
        }));
      }
    };

    const handleTradeUpdate = (tradeData) => {
      if (tradeData.marketId === marketId) {
        console.log('QuickStats received trade update:', tradeData);
        setCurrentMarket(prevMarket => ({
          ...prevMarket,
          totalVolume: tradeData.totalVolume,
          yesPrice: tradeData.yesPrice,
          noPrice: tradeData.noPrice,
        }));
      }
    };

    // Set up WebSocket listeners
    webSocketService.onMarketUpdate(handleMarketUpdate);
    webSocketService.onTradeUpdate(handleTradeUpdate);

    return () => {
      // Clean up listeners
      webSocketService.off('market:priceUpdate');
      webSocketService.off('market:newTrade');
    };
  }, [marketId]);

  // Helper function to format date
  const formatExpiryDate = (expiryDate) => {
    if (!expiryDate) return "N/A";
    return new Date(expiryDate).toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper function to calculate prices (assuming yes + no = 10)
  const calculatePrices = (market) => {
    if (!market) return { yesPrice: "N/A", noPrice: "N/A" };
    
    // If market has price data, use it; otherwise use defaults
    const yesPrice = market.yesPrice || 6;
    const noPrice = market.noPrice || (10 - yesPrice);
    
    return { yesPrice: yesPrice.toFixed(2), noPrice: noPrice.toFixed(2) };
  };

  // Helper function to calculate volume
  const calculateVolume = (market) => {
    if (!market) return "0";
    return (market.totalVolume || market.volume || 0).toFixed(2);
  };

  // Helper function to check if market is expired
  const isMarketExpired = (market) => {
    if (!market?.expiry) return false;
    return new Date(market.expiry) < new Date();
  };

  const { yesPrice, noPrice } = calculatePrices(currentMarket);
  const volume = calculateVolume(currentMarket);
  const expired = isMarketExpired(currentMarket);

  return (
    <div className="bg-[#181c24] rounded-lg p-4 mb-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-[#23283a]">
      <div className="font-semibold mb-2 text-white">Quick Stats</div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">Market ID</span>
        <span className="text-white">{marketId ? marketId.slice(-6) : "N/A"}</span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">Yes Price</span>
        <span className="bg-green-900 text-green-300 px-2 py-0.5 rounded-full">₹{yesPrice}</span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">No Price</span>
        <span className="bg-red-900 text-red-300 px-2 py-0.5 rounded-full">₹{noPrice}</span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">Volume</span>
        <span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">₹{volume}</span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">Expires</span>
        <span className={`px-2 py-0.5 rounded-full text-sm ${
          expired ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
        }`}>
          {expired ? 'Expired' : `Ends ${formatExpiryDate(currentMarket?.expiry)}`}
        </span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">Status</span>
        <span className={`px-2 py-0.5 rounded-full text-sm ${
          currentMarket?.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
        }`}>
          {currentMarket?.status || 'N/A'}
        </span>
      </div>
    </div>
  );
}