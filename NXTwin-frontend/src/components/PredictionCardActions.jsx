import React from "react";
import { useAuth } from "../context/AuthContext";

export default function PredictionCardActions({ prediction }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="mt-2">
        <div className="text-center text-sm text-gray-400 mb-2">
          Login to start trading
        </div>
        <div className="flex gap-2">
          <div className="flex-1 py-2 rounded bg-green-900/50 text-green-300/70 font-semibold text-center">
            Yes <span className="ml-2 text-green-200/70">₹{prediction?.yesPrice?.toFixed(1) || '5.0'}</span>
          </div>
          <div className="flex-1 py-2 rounded bg-red-900/50 text-red-300/70 font-semibold text-center">
            No <span className="ml-2 text-red-200/70">₹{prediction?.noPrice?.toFixed(1) || '5.0'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mt-2">
      <button className="flex-1 py-2 rounded bg-green-900 text-green-300 font-semibold hover:bg-green-800 transition">
        Yes <span className="ml-2 text-green-200">₹{prediction?.yesPrice?.toFixed(1) || '5.0'}</span>
      </button>
      <button className="flex-1 py-2 rounded bg-red-900 text-red-300 font-semibold hover:bg-red-800 transition">
        No <span className="ml-2 text-red-200">₹{prediction?.noPrice?.toFixed(1) || '5.0'}</span>
      </button>
    </div>
  );
}