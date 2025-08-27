import React from "react";

export default function OrderTabs() {
  return (
    <div className="flex gap-4 mb-2">
      <button className="px-4 py-2 rounded-t bg-[#181c24] text-white font-semibold border-b-2 border-teal-500">Order Book</button>
      <button className="px-4 py-2 rounded-t bg-[#181c24] text-gray-400 font-semibold">Activity</button>
      <button className="px-4 py-2 rounded-t bg-[#181c24] text-gray-400 font-semibold">AI Analysis</button>
      <button className="px-4 py-2 rounded-t bg-[#181c24] text-gray-400 font-semibold">Discussion</button>
    </div>
  );
}