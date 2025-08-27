import React from "react";

export default function PredictionCardResolved({ winner }) {
  return (
    <div className="mt-2 bg-green-900 text-green-300 rounded p-2 text-center text-sm font-semibold">
      Event Resolved
      <div className="text-xs text-white mt-1">Winner: {winner}</div>
    </div>
  );
}