import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { marketAPI } from "../services/api";

export default function PlaceBid({ marketId, market, quantity, setQuantity }) {
  const [selectedOption, setSelectedOption] = useState("yes");
  const [price, setPrice] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { user, isAuthenticated } = useAuth();

  // Initialize price based on market data when component loads
  useEffect(() => {
    if (market && price === 0) {
      // Only set initial price if it hasn't been set yet
      setPrice(selectedOption === "yes" ? market.yesPrice || 5 : market.noPrice || 5);
    }
  }, [market]); // Remove selectedOption dependency to prevent reset on option change

  const handleTrade = async () => {
    if (!isAuthenticated) {
      alert("Please login to place a trade");
      return;
    }

    if (!market || !marketId) {
      setError("Market data not available");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const tradeData = {
        option: selectedOption, // "yes" or "no"
        amount: parseInt(quantity),
        price: parseFloat(price), // Keep price as is (0-10 scale)
        side: "buy" // or "sell"
      };

      console.log('Submitting trade:', tradeData);
      console.log('Market ID:', marketId);
      console.log('User authenticated:', isAuthenticated);
      console.log('User balance:', user?.balance);

      const response = await marketAPI.createTrade(marketId, tradeData);

      console.log('Trade response:', response);

      if (response.success) {
        alert("Trade placed successfully!");
        // Reset form
        setQuantity(1);
      } else {
        setError(response.message || "Trade failed");
      }
    } catch (error) {
      console.error("Trade error:", error);
      console.error("Trade error details:", error.response?.data);
      setError(error.response?.data?.message || error.message || "Failed to place trade");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCost = price * quantity;
  const potentialReturn = quantity * 10; // Maximum return is 10 per share
  const profit = potentialReturn - totalCost;

  return (
    <div className="bg-gradient-to-br from-[#181c24] to-[#1f2430] rounded-2xl p-6 shadow-lg border border-[#23283a]">
      <h3 className="font-semibold text-white mb-4 text-lg">Place Your Bid</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {!isAuthenticated && (
        <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500 rounded text-yellow-300 text-sm">
          Please login to place trades
        </div>
      )}
      
      {/* YES/NO Buttons */}
      <div className="flex gap-3 mb-4">
        <button 
          onClick={() => setSelectedOption("yes")}
          className={`flex-1 py-2.5 rounded-lg border font-semibold transition ${
            selectedOption === "yes"
              ? "bg-green-600/40 border-green-500 text-green-200"
              : "bg-green-600/20 border-green-500/40 text-green-300 hover:bg-green-600/30"
          }`}
        >
          ✅ YES <span className="ml-2">₹{(market?.yesPrice || 5).toFixed(1)}</span>
        </button>
        <button 
          onClick={() => setSelectedOption("no")}
          className={`flex-1 py-2.5 rounded-lg border font-semibold transition ${
            selectedOption === "no"
              ? "bg-red-600/40 border-red-500 text-red-200"
              : "bg-red-600/20 border-red-500/40 text-red-300 hover:bg-red-600/30"
          }`}
        >
          ❌ NO <span className="ml-2">₹{(market?.noPrice || 5).toFixed(1)}</span>
        </button>
      </div>

      {/* Price */}
      <div className="mb-3">
        <label className="text-xs text-gray-400">Price per share (0-10 scale)</label>
        <input
          type="number"
          min="0.5"
          max="9.5"
          step="0.1"
          value={price}
          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-md bg-[#23283a] text-white mt-1 border border-gray-600 focus:border-violet-500 focus:outline-none"
          placeholder="Enter price (₹0.5 - ₹9.5)"
          disabled={isSubmitting || !isAuthenticated}
        />
        <div className="text-xs text-gray-400 mt-1">
          Market: YES ₹{(market?.yesPrice || 5).toFixed(1)} • NO ₹{(market?.noPrice || 5).toFixed(1)}
        </div>
      </div>

      {/* Quantity Selector */}
      <div className="mb-4 flex items-center justify-between">
        <label className="text-xs text-gray-400">Quantity</label>
        <div className="flex items-center gap-2">
          <button 
            className="px-3 py-1.5 rounded bg-gray-700 text-white hover:bg-gray-600 transition disabled:opacity-50" 
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={isSubmitting || !isAuthenticated}
          >
            -
          </button>
          <span className="px-4 font-semibold">{quantity}</span>
          <button 
            className="px-3 py-1.5 rounded bg-gray-700 text-white hover:bg-gray-600 transition disabled:opacity-50" 
            onClick={() => setQuantity(quantity + 1)}
            disabled={isSubmitting || !isAuthenticated}
          >
            +
          </button>
        </div>
      </div>

      {/* User Balance */}
      {isAuthenticated && user?.balance !== undefined && (
        <div className="mb-4 text-sm text-gray-400">
          Available Balance: <span className="text-white font-semibold">₹{user.balance?.toLocaleString()}</span>
        </div>
      )}

      {/* Stats */}
      <div className="space-y-1 text-sm">
        <div className="text-green-300">⚡ Instant fill: {quantity} share{quantity > 1 ? 's' : ''}</div>
        <div className="text-gray-400">
          You pay: <span className="text-white font-semibold">₹{totalCost.toFixed(2)}</span>
        </div>
        <div className="text-gray-400">
          Potential return: <span className="text-green-300 font-semibold">₹{potentialReturn.toFixed(2)}</span>
        </div>
        <div className="text-gray-400">
          Potential profit: <span className={`font-semibold ${profit > 0 ? 'text-green-300' : 'text-red-300'}`}>
            ₹{profit.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Buy Button */}
      <button 
        onClick={handleTrade}
        disabled={isSubmitting || !isAuthenticated || (isAuthenticated && user?.balance < totalCost)}
        className="w-full py-2.5 rounded-lg bg-violet-500 text-white font-bold mt-4 hover:bg-violet-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting 
          ? "Placing Trade..." 
          : isAuthenticated
            ? user?.balance < totalCost
              ? "Insufficient Balance"
              : `🚀 Buy ${selectedOption.toUpperCase()} @ ₹${price.toFixed(1)}`
            : "Login to Trade"
        }
      </button>
    </div>
  );
}