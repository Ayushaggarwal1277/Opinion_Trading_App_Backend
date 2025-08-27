import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error } = useAuth();

  // Get the page user was trying to access before login
  const from = location.state?.from?.pathname || "/";

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login({ email, password });
      
      if (result.success) {
        // Redirect to the page user was trying to access, or home
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#10141c] text-white">
      <form
        onSubmit={handleLogin}
        className="bg-[#181c24] p-8 rounded-2xl w-96 shadow-[0_0_25px_#03DAC5]"
      >
        <h2 className="text-2xl font-bold mb-6">Login</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-300">
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-[#10141c] outline-none"
          required
          disabled={isLoading}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-[#10141c] outline-none"
          required
          disabled={isLoading}
        />

        <button
          type="submit"
          className="w-full bg-teal-500 py-2 rounded hover:bg-teal-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>

        <p className="mt-4 text-center text-gray-400">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="text-teal-500 hover:underline"
          >
            Register here
          </button>
        </p>
      </form>
    </div>
  );
}



