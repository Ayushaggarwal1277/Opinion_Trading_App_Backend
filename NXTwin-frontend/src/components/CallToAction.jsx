import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function CallToAction() {
  const { isAuthenticated } = useAuth();

  // Don't show CTA if user is already logged in
  if (isAuthenticated) return null;

  return (
    <div className="mx-8 mb-8 bg-gradient-to-r from-teal-600 to-violet-600 rounded-2xl p-6 text-white text-center">
      <h3 className="text-xl font-bold mb-2">Start Trading Weather Predictions!</h3>
      <p className="text-teal-100 mb-4">
        Join thousands of traders making predictions on weather events. 
        Get ₹1000 bonus when you sign up today!
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          to="/register"
          className="px-6 py-3 bg-white text-teal-600 font-bold rounded-lg hover:bg-gray-100 transition"
        >
          🚀 Sign Up & Get ₹1000
        </Link>
        <Link
          to="/login"
          className="px-6 py-3 bg-transparent border-2 border-white text-white font-bold rounded-lg hover:bg-white hover:text-teal-600 transition"
        >
          Login
        </Link>
      </div>
    </div>
  );
}
