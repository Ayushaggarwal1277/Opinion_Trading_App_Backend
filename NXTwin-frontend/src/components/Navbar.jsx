import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationPanel from "./NotificationPanel";
import CurrentTemperature from "./CurrentTemperature";
import Profile from "../assets/profile.svg";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-[#10141c] relative shadow-[0_0_25px_#03DAC5]">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold text-white">NxtWin</span>
        <ul className="flex gap-6 ml-8">
          <li>
            <Link to="/" className="text-white hover:text-teal-400 cursor-pointer">
              {user?.role === 'admin' ? 'Admin Portal' : 'Home'}
            </Link>
          </li>
          {user?.role !== 'admin' && (
            <>
              <li>
                <Link
                  to="/bids"
                  className="text-white hover:text-teal-400 cursor-pointer flex items-center gap-1"
                >
                  Bids{" "}
                  <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
                </Link>
              </li>
              <li>
                <Link to="/simulator" className="text-white hover:text-teal-400 cursor-pointer">
                  Simulator
                </Link>
              </li>
            </>
          )}
          {user?.role === 'admin' && (
            <li>
              <Link to="/admin/markets" className="text-white hover:text-teal-400 cursor-pointer">
                View Markets
              </Link>
            </li>
          )}
        </ul>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Current Temperature */}
        <CurrentTemperature />

        {/* Search Box */}
        <input
          type="text"
          placeholder="Search markets, assets, pairs..."
          className="px-4 py-2 rounded bg-[#181c24] text-white outline-none w-72"
        />

        {/* User Balance (if logged in) */}
        {isAuthenticated && user?.balance !== undefined && (
          <div className="text-white bg-[#181c24] px-3 py-1 rounded">
            ₹{user.balance?.toLocaleString() || '0'}
          </div>
        )}

        {/* Login/Register buttons for non-authenticated users */}
        {!isAuthenticated && (
          <div className="flex gap-2">
            <Link
              to="/login"
              className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 transition"
            >
              Register
            </Link>
          </div>
        )}

        {/* Notifications (only for authenticated users) */}
        {isAuthenticated && <NotificationPanel />}

        {/* Profile Image with Dropdown (only for authenticated users) */}
        {isAuthenticated && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#03DAC5] flex items-center justify-center"
            >
              {user?.username ? (
                <span className="text-white font-bold text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              ) : (
                <img src={Profile} alt="Profile" className="w-full h-full object-cover invert" />
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#181c24] rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 text-gray-300 border-b border-gray-600">
                  <div className="font-semibold">{user?.username}</div>
                  <div className="text-sm text-gray-400">{user?.email}</div>
                  {user?.role === 'admin' && (
                    <div className="text-xs text-green-400 font-semibold">ADMIN</div>
                  )}
                </div>
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-white hover:bg-teal-600 rounded"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                {user?.role !== 'admin' && (
                  <Link
                    to="/my-trades"
                    className="block px-4 py-2 text-white hover:bg-teal-600 rounded"
                    onClick={() => setMenuOpen(false)}
                  >
                    My Trades
                  </Link>
                )}
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="block px-4 py-2 text-white hover:bg-teal-600 rounded"
                    onClick={() => setMenuOpen(false)}
                  >
                    Admin Portal
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-white hover:bg-red-600 rounded"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

