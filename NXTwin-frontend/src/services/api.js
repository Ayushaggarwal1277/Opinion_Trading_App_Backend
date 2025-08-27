// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Utility to clear authentication cookies and localStorage
const clearAuthData = () => {
  localStorage.removeItem('user');
  // Clear cookies by setting them to expire
  document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  console.log('🧹 Cleared authentication data');
};

// API utility function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for authentication
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    console.log(`🌐 API Request: ${config.method || 'GET'} ${url}`);
    const response = await fetch(url, config);
    
    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error ${response.status}:`, errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || `HTTP ${response.status}`);
      } catch (parseError) {
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    }

    const data = await response.json();
    console.log(`✅ API Success: ${config.method || 'GET'} ${url}`);
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    
    // Add more specific error information
    if (error.message.includes('jwt malformed')) {
      console.error('🔑 JWT Token issue detected - clearing potentially corrupted tokens');
      clearAuthData();
    }
    
    throw error;
  }
};

// Auth API calls
export const authAPI = {
  register: (userData) =>
    apiRequest('/users/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  login: (credentials) =>
    apiRequest('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    apiRequest('/users/logout', {
      method: 'POST',
    }),

  refreshToken: () =>
    apiRequest('/users/refresh', {
      method: 'POST',
    }),

  getCurrentUser: () =>
    apiRequest('/users/me', {
      method: 'GET',
    }),
};

// Market API calls
export const marketAPI = {
  getActiveMarkets: () =>
    apiRequest('/market/active'),

  getMarketById: (marketId) =>
    apiRequest(`/market/${marketId}`),

  createMarket: (marketData) =>
    apiRequest('/market/question', {
      method: 'POST',
      body: JSON.stringify(marketData),
    }),

  createTrade: (marketId, tradeData) =>
    apiRequest(`/market/${marketId}/trades`, {
      method: 'POST',
      body: JSON.stringify(tradeData),
    }),

  getOrderBook: (marketId) =>
    apiRequest(`/market/${marketId}/orderbook`),

  getUserOrders: (marketId) =>
    apiRequest(`/market/${marketId}/user-orders`),
};

export const userAPI = {
  getAllUserOrders: () => apiRequest('/users/orders'),
};

// Weather API calls
export const weatherAPI = {
  getCurrentWeather: () => apiRequest('/weather/current'),
};

export default {
  authAPI,
  marketAPI,
  userAPI,
  weatherAPI,
};
