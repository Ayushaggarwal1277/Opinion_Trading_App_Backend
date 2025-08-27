import React from "react";
import { useAuth } from "../context/AuthContext";

export default function MarketInfo({ market, marketId }) {
  const { user, isAuthenticated } = useAuth();

  if (!market) {
    return (
      <div className="flex justify-between items-center bg-gradient-to-br from-[#181c24] to-[#1f2430] rounded-2xl p-8 mb-6 shadow-lg border border-[#23283a]">
        <div className="text-gray-400">Loading market information...</div>
      </div>
    );
  }

  // Format expiry date
  const expiryDate = market.expiry ? new Date(market.expiry).toLocaleDateString() : "TBD";

  return (
    <div className="flex justify-between items-center bg-gradient-to-br from-[#181c24] to-[#1f2430] rounded-2xl p-8 mb-6 shadow-lg border border-[#23283a] transition hover:shadow-xl">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-violet-600/80 px-3 py-1 rounded-full text-xs font-semibold">
            {market.question?.toLowerCase().includes('temperature') ? 'Weather' : 'General'}
          </span>
          <span className="bg-gray-700/70 px-3 py-1 rounded-full text-xs">🔴 Live • Active Market</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3 leading-snug text-white">
          {market.question || "Market Question"}
        </h2>
        <div className="text-sm text-gray-400 mb-3">⏳ Ends {expiryDate}</div>
        <p className="text-base text-gray-300">Make the correct prediction and win big!</p>
        
        {/* Market Prices */}
        <div className="flex gap-4 mt-4">
          <div className="bg-green-600/20 border border-green-500/40 rounded-lg px-4 py-2">
            <div className="text-green-300 text-sm">YES Price</div>
            <div className="text-green-200 font-bold text-lg">₹{(market.yesPrice || 5).toFixed(1)}</div>
          </div>
          <div className="bg-red-600/20 border border-red-500/40 rounded-lg px-4 py-2">
            <div className="text-red-300 text-sm">NO Price</div>
            <div className="text-red-200 font-bold text-lg">₹{(market.noPrice || 5).toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* User Balance Section */}
      {isAuthenticated && user ? (
        <div className="bg-[#1c212d] rounded-xl p-6 shadow-inner border border-[#2b3245] flex flex-col items-center min-w-[200px]">
          <div className="text-gray-400 text-sm mb-1">Hi, {user.username || user.name}</div>
          <div className="text-3xl font-extrabold mb-2 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            ₹{(user.balance || 0).toFixed(2)}
          </div>
          <div className="text-xs text-gray-400">Remaining balance</div>
        </div>
      ) : (
        <div className="bg-[#1c212d] rounded-xl p-6 shadow-inner border border-[#2b3245] flex flex-col items-center min-w-[200px]">
          <div className="text-gray-400 text-sm mb-1">Guest User</div>
          <div className="text-xl font-bold mb-2 text-gray-300">
            Login to Trade
          </div>
          <div className="text-xs text-gray-400">Sign in to get started</div>
        </div>
      )}
    </div>
  );
}



