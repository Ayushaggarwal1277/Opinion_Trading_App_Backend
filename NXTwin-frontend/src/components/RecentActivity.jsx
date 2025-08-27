import React from "react";

export default function RecentActivity() {
  return (
    <div className="bg-[#181c24] rounded-xl p-4 mb-4 shadow-lg border border-[#23283a] min-w-[220px]">
      <div className="text-gray-200 font-semibold mb-2">Recent Activity</div>
      <div className="flex justify-between text-sm mb-1">
        <span>Market created</span>
        <span className="text-gray-400">8/24/2025</span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span>Last updated</span>
        <span className="text-gray-400">8/25/2025</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Current volume</span>
        <span className="bg-green-900 text-green-300 px-2 py-0.5 rounded-full">₹88</span>
      </div>
    </div>
  );
}