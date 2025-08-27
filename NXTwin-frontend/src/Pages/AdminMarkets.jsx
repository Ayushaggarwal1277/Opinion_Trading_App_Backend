import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { marketAPI } from '../services/api';

const AdminMarkets = () => {
  const { user } = useAuth();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      const response = await marketAPI.getActiveMarkets();
      if (response.success) {
        setMarkets(response.markets);
      }
    } catch (error) {
      setError('Failed to fetch markets: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getMarketStatus = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    return expiry > now ? 'Active' : 'Expired';
  };

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-600 text-white p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p>You don't have admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Market Management</h1>
            <p className="text-gray-300">View and manage all markets</p>
          </div>
          <Link
            to="/admin"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition duration-300"
          >
            ← Back to Admin Portal
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {/* Markets Count */}
            <div className="bg-gray-800 p-4 rounded-lg mb-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">
                  Total Markets: {markets.length}
                </h2>
                <button
                  onClick={fetchMarkets}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            {/* Markets Grid */}
            {markets.length === 0 ? (
              <div className="bg-gray-800 p-8 rounded-lg text-center">
                <h3 className="text-xl font-bold text-white mb-2">No Markets Found</h3>
                <p className="text-gray-400 mb-4">Create your first market to get started.</p>
                <Link
                  to="/admin"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition duration-300"
                >
                  Create Market
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {markets.map((market) => (
                  <div key={market._id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    {/* Market Status */}
                    <div className="flex justify-between items-start mb-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          getMarketStatus(market.expiry) === 'Active'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {getMarketStatus(market.expiry)}
                      </span>
                      <span className="text-gray-400 text-sm">
                        ID: {market._id.slice(-6)}
                      </span>
                    </div>

                    {/* Market Question */}
                    <h3 className="text-lg font-bold text-white mb-3 line-clamp-2">
                      {market.question}
                    </h3>

                    {/* Market Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Threshold:</span>
                        <span className="text-white font-medium">{market.threshold}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Created:</span>
                        <span className="text-white">{formatDate(market.createdAt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Expires:</span>
                        <span className="text-white">{formatDate(market.expiry)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Status:</span>
                        <span className="text-white">{market.status}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        to={`/market/${market._id}`}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg font-medium transition duration-300"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminMarkets;
