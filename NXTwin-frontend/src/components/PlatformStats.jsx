import React from "react";

export default function PlatformStats() {
  return (
    <div className="bg-[#181c24] rounded-xl p-4 shadow-lg border border-[#23283a]">
      <div className="font-semibold mb-2">Platform Stats</div>
      <div className="flex justify-between text-sm mb-1">
        <span>Money Collected</span>
        <span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">₹0.00</span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span>Max Liability</span>
        <span className="bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full">₹0.00</span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span>Platform Profit</span>
        <span className="bg-green-900 text-green-300 px-2 py-0.5 rounded-full">₹0.00</span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span>Status</span>
        <span className="bg-gray-700 text-white px-2 py-0.5 rounded-full">At Risk</span>
      </div>
    </div>
  );
}