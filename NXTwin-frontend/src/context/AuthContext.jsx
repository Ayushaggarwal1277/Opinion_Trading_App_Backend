import React, { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";
import webSocketService from "../services/websocket";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Set up automatic token refresh every 12 minutes (before 15-minute expiry)
  const setupTokenRefresh = () => {
    // Clear existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    // Set up new refresh interval (12 minutes = 720000 ms)
    const interval = setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing token...');
        await authAPI.refreshToken();
        
        // Get updated user data after refresh
        const userResponse = await authAPI.getCurrentUser();
        if (userResponse.success) {
          setUser(prevUser => ({
            ...prevUser,
            ...userResponse.data.user,
            username: userResponse.data.user.name,
            role: userResponse.data.user.role,
            isAuthenticated: true,
          }));
          console.log('✅ Token refreshed successfully');
        }
      } catch (error) {
        console.log('❌ Auto-refresh failed, logging out:', error.message);
        // Token refresh failed, user needs to login again
        logout();
      }
    }, 12 * 60 * 1000); // 12 minutes

    setRefreshInterval(interval);
  };

  // Join user notification room
  const joinUserNotificationRoom = (userId) => {
    const socket = webSocketService.connect();
    if (socket && userId) {
      socket.emit('join-user', userId);
      console.log('🔔 Joined notification room for user:', userId);
    }
  };

  // Clear token refresh interval
  const clearTokenRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  };

  // Initialize WebSocket connection when user is authenticated
  useEffect(() => {
    if (user) {
      webSocketService.connect();
      if (user.id) {
        webSocketService.joinUser(user.id);
      }
    } else {
      webSocketService.disconnect();
    }

    return () => {
      if (!user) {
        webSocketService.disconnect();
      }
    };
  }, [user]);

  // Check if user is already logged in on app start
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // First, check if we have any stored auth failures
        const authFailureCount = localStorage.getItem('authFailureCount') || '0';
        const lastAuthFailure = localStorage.getItem('lastAuthFailure');
        
        // If we've had recent auth failures, skip the refresh attempt and clear everything
        if (parseInt(authFailureCount) >= 2 && lastAuthFailure) {
          const lastFailureTime = new Date(lastAuthFailure);
          const timeSinceFailure = Date.now() - lastFailureTime.getTime();
          
          // If failure was within last 5 minutes, skip refresh and clear all data
          if (timeSinceFailure < 5 * 60 * 1000) {
            console.log('🚫 Skipping refresh due to recent auth failures - clearing all data');
            localStorage.removeItem('user');
            localStorage.removeItem('authFailureCount');
            localStorage.removeItem('lastAuthFailure');
            setUser(null);
            setLoading(false);
            return;
          }
        }

        // Check if we have stored user data from previous session
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            console.log('🔍 Found stored user data, attempting token refresh...');
          } catch (parseError) {
            console.log('❌ Invalid stored user data, clearing...');
            localStorage.removeItem('user');
          }
        }

        // Try to refresh token to check if user is logged in
        console.log('🔄 Attempting to refresh token...');
        await authAPI.refreshToken();
        console.log('✅ Token refresh successful');
        
        // Reset failure count on success
        localStorage.removeItem('authFailureCount');
        localStorage.removeItem('lastAuthFailure');
        
        // If successful, get current user data
        const userResponse = await authAPI.getCurrentUser();
        if (userResponse.success) {
          const userData = {
            id: userResponse.data.user._id,
            username: userResponse.data.user.name,
            email: userResponse.data.user.email,
            balance: userResponse.data.user.balance,
            role: userResponse.data.user.role,
            isAuthenticated: true,
          };
          
          setUser(userData);
          
          // Store user data in localStorage as backup
          localStorage.setItem('user', JSON.stringify(userData));
          
          // Start automatic token refresh for existing sessions
          setupTokenRefresh();
          
          // Join user notification room
          joinUserNotificationRoom(userData.id);
          
          console.log('✅ Authentication restored from server');
        }
      } catch (error) {
        console.log('❌ Token refresh failed:', error.message);
        
        // Track auth failures
        const currentFailureCount = parseInt(localStorage.getItem('authFailureCount') || '0') + 1;
        localStorage.setItem('authFailureCount', currentFailureCount.toString());
        localStorage.setItem('lastAuthFailure', new Date().toISOString());
        
        // Clear any potentially corrupted authentication data
        localStorage.removeItem('user');
        
        // For malformed JWT or 401 errors, completely reset authentication state
        if (error.message.includes('jwt malformed') || error.message.includes('401')) {
          console.log('🧹 Clearing corrupted authentication state due to JWT error');
          setUser(null);
          
          // If this is the 2nd+ failure, also clear the cookies more aggressively
          if (currentFailureCount >= 2) {
            console.log('🔧 Multiple failures detected - performing aggressive cleanup');
            // Clear cookies with different path/domain combinations
            const cookieOptions = [
              '; path=/',
              '; path=/; domain=localhost',
              '; path=/; domain=.localhost',
              ''
            ];
            
            cookieOptions.forEach(options => {
              document.cookie = `accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC${options}`;
              document.cookie = `refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC${options}`;
            });
          }
        } else {
          setUser(null);
          console.log('Authentication failed for other reason:', error.message);
        }
        
        clearTokenRefresh();
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (credentials) => {
    try {
      setError(null);
      setLoading(true);
      const response = await authAPI.login(credentials);
      
      if (response.success) {
        const userData = {
          id: response.data.user._id,
          username: response.data.user.name, // Backend uses 'name' field
          email: response.data.user.email,
          balance: response.data.user.balance,
          role: response.data.user.role,
          isAuthenticated: true,
        };
        
        setUser(userData);
        
        // Store user data in localStorage as backup
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Start automatic token refresh after successful login
        setupTokenRefresh();
        
        // Join user notification room
        joinUserNotificationRoom(userData.id);
        
        return { success: true };
      }
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      setLoading(true);
      const response = await authAPI.register(userData);
      
      if (response.success) {
        const userAuthData = {
          id: response.data.user._id,
          username: response.data.user.name, // Backend uses 'name' field
          email: response.data.user.email,
          balance: response.data.user.balance,
          role: response.data.user.role,
          isAuthenticated: true,
        };
        
        setUser(userAuthData);
        
        // Store user data in localStorage as backup
        localStorage.setItem('user', JSON.stringify(userAuthData));
        
        return { success: true };
      }
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Clear token refresh interval before logout
      clearTokenRefresh();
      
      await authAPI.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      localStorage.removeItem('user'); // Clear stored user data
      localStorage.removeItem('authFailureCount');
      localStorage.removeItem('lastAuthFailure');
      webSocketService.disconnect();
    }
  };

  // Manual function to completely reset authentication state
  const resetAuthState = () => {
    console.log('🔧 Manually resetting authentication state...');
    
    // Clear all localStorage auth data
    localStorage.removeItem('user');
    localStorage.removeItem('authFailureCount');
    localStorage.removeItem('lastAuthFailure');
    
    // Clear cookies with different path/domain combinations
    const cookieOptions = [
      '; path=/',
      '; path=/; domain=localhost',
      '; path=/; domain=.localhost',
      ''
    ];
    
    cookieOptions.forEach(options => {
      document.cookie = `accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC${options}`;
      document.cookie = `refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC${options}`;
    });
    
    // Reset component state
    setUser(null);
    clearTokenRefresh();
    webSocketService.disconnect();
    
    console.log('✅ Authentication state reset complete');
    
    // Reload the page to start fresh
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const value = {
    user,
    login,
    register,
    logout,
    resetAuthState,
    loading,
    error,
    isAuthenticated: !!user?.isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}


