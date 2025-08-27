import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export default function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex justify-between items-center bg-[#181c24] px-6 py-4">
      <h1 className="text-xl font-bold">NxtWin</h1>

      {/* Right side */}
      <div className="relative">
        {!user ? (
          <div className="flex gap-3">
            <a href="/login" className="px-4 py-2 rounded bg-violet-600 text-white">Login</a>
            <a href="/register" className="px-4 py-2 rounded bg-gray-700 text-white">Register</a>
          </div>
        ) : (
          <>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full bg-pink-600 text-white font-bold"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {user.name[0].toUpperCase()}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-[#1f2430] shadow-lg rounded-lg border border-[#2b3245]">
                <a href="/profile" className="block px-4 py-2 text-sm text-white hover:bg-[#23283a]">Profile</a>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#23283a]"
                >
                  Logout
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
