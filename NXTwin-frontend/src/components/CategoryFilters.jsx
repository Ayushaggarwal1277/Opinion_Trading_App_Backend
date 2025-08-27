import React from "react";

const categories = ["All", "Weather", "General"];

export default function CategoryFilters({ activeCategory, setActiveCategory }) {
  return (
    <div className="flex gap-4 px-8 py-6 bg-[#181c24] shadow-[0_0_25px_#03DAC5]">
      {categories.map((cat) => (
        <button
          key={cat}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            activeCategory === cat
              ? "bg-teal-700 text-white"
              : "bg-[#10141c] text-gray-300 hover:bg-teal-900"
          }`}
          onClick={() => setActiveCategory(cat)}
        >
          {cat === "Weather" ? "🌡️ Weather" : cat}
        </button>
      ))}
    </div>
  );
}