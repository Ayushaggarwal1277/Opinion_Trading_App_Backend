import React from "react";
import PredictionCardActions from "./PredictionCardActions";
import PredictionCardResolved from "./PredictionCardResolved";

export default function PredictionCardBody({ prediction }) {
  return (
    <div className="p-4 flex-1 flex flex-col justify-between">
      <div>
        <div className="font-semibold text-white text-base mb-2">
          {prediction.question}
        </div>
        <div className="text-xs text-gray-400 mb-2">Vol: {prediction.volume}</div>
      </div>
      {!prediction.resolved ? (
        <PredictionCardActions prediction={prediction} />
      ) : (
        <PredictionCardResolved winner={prediction.winner} />
      )}
    </div>
  );
}