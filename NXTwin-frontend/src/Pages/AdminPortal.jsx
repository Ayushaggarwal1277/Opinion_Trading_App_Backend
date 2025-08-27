import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { marketAPI } from '../services/api';

const AdminPortal = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    question: '',
    expiry: '',
    threshold: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Store expiry as UTC - admin enters time in UTC
      const marketData = {
        question: formData.question,
        expiry: new Date(formData.expiry).toISOString(),
        threshold: parseFloat(formData.threshold)
      };

      console.log('Creating market with expiry (UTC):', marketData.expiry);

      const response = await marketAPI.createMarket(marketData);
      
      if (response.success) {
        setMessage('✅ Market created successfully!');
        setFormData({ question: '', expiry: '', threshold: '' });
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-600 text-white p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p>You don't have admin privileges to access this portal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Portal</h1>
          <p className="text-blue-100">Welcome, {user?.username}! Create and manage markets.</p>
        </div>

        {/* Market Creation Form */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Create New Market</h2>
          
          {message && (
            <div className={`p-4 rounded-lg mb-6 ${
              message.includes('✅') ? 'bg-green-600' : 'bg-red-600'
            } text-white`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Question */}
            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-300 mb-2">
                Market Question
              </label>
              <input
                type="text"
                id="question"
                name="question"
                value={formData.question}
                onChange={handleInputChange}
                placeholder="e.g., Will Bitcoin reach $100,000 by the end of 2024?"
                className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label htmlFor="expiry" className="block text-sm font-medium text-gray-300 mb-2">
                Expiry Date & Time (UTC)
              </label>
              <input
                type="datetime-local"
                id="expiry"
                name="expiry"
                value={formData.expiry}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter the time when you want the market to close in UTC
              </p>
            </div>

            {/* Threshold */}
            <div>
              <label htmlFor="threshold" className="block text-sm font-medium text-gray-300 mb-2">
                Threshold Value
              </label>
              <input
                type="number"
                step="0.01"
                id="threshold"
                name="threshold"
                value={formData.threshold}
                onChange={handleInputChange}
                placeholder="e.g., 100000 (for price thresholds)"
                className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Market...
                </div>
              ) : (
                'Create Market'
              )}
            </button>
          </form>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-2">Market Guidelines</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Questions should be clear and specific</li>
              <li>• Set realistic expiry dates</li>
              <li>• Threshold values should be meaningful</li>
            </ul>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-2">Market Types</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Price predictions (crypto, stocks)</li>
              <li>• Event outcomes (elections, sports)</li>
              <li>• Economic indicators</li>
            </ul>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-2">Best Practices</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Avoid ambiguous questions</li>
              <li>• Set appropriate time horizons</li>
              <li>• Consider market liquidity</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
