import React from "react";
import PredictionCardHeader from "./PredictionCardHeader";
import PredictionCardBody from "./PredictionCardBody";

export default function PredictionCard({ prediction }) {
  return (
    <div className="rounded-xl bg-[#181c24] border border-[#23283a] shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transition hover:scale-[1.03] hover:shadow-2xl duration-200">
      <PredictionCardHeader prediction={prediction} />
      <PredictionCardBody prediction={prediction} />
    </div>
  );
}