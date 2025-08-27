import React from "react";

export default function PredictionCardHeader({ prediction }) {
  return (
    <div
      className="relative h-36 w-full"
      style={{
        backgroundImage: `url(${prediction.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <span
        className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold text-white ${prediction.categoryColor}`}
      >
        {prediction.category}
      </span>
      {prediction.resolved && (
        <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold bg-teal-700 text-white">
          Resolved
        </span>
      )}
    </div>
  );
}