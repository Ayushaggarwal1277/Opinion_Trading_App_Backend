import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { register, error } = useAuth();

  // Get the page user was trying to access before registration
  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      alert("Passwords don't match!");
      return;
    }

    setIsLoading(true);

    try {
      // Send 'name' instead of 'username' to match backend schema
      const result = await register({ name, email, password });
      
      if (result.success) {
        // Redirect to the page user was trying to access, or home
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#10141c] text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-[#181c24] p-8 rounded-2xl w-96 shadow-[0_0_25px_#03DAC5]"
      >
        <h2 className="text-2xl font-bold mb-6">Register</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-300">
            {error}
          </div>
        )}

        {/* Name Field */}
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-[#10141c] outline-none"
          required
          disabled={isLoading}
        />

        {/* Email Field */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-[#10141c] outline-none"
          required
          disabled={isLoading}
        />

        {/* Password Field */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-[#10141c] outline-none"
          required
          disabled={isLoading}
        />

        {/* Confirm Password Field */}
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-[#10141c] outline-none"
          required
          disabled={isLoading}
        />

        <button
          type="submit"
          className="w-full bg-teal-500 py-2 rounded hover:bg-teal-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? "Creating Account..." : "Register"}
        </button>

        <p className="mt-4 text-sm text-gray-400">
          Already have an account?{" "}
          <Link to="/login" className="text-teal-400 hover:underline">
            Login here
          </Link>
        </p>
      </form>
    </div>
  );
}

