import React, { useState, useEffect } from 'react';
import { weatherAPI } from '../services/api';

const CurrentTemperature = ({ showDetails = false, className = "" }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await weatherAPI.getCurrentWeather();
      
      if (response.success) {
        setWeather(response.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      setError('Failed to fetch weather data');
      console.error('Weather fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    
    // Update weather every 5 minutes
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const getTemperatureColor = (temp) => {
    if (temp >= 40) return 'text-red-500';
    if (temp >= 35) return 'text-orange-500';
    if (temp >= 30) return 'text-yellow-500';
    if (temp >= 25) return 'text-green-500';
    return 'text-blue-500';
  };

  const getTemperatureIcon = (temp) => {
    if (temp >= 40) return '🔥';
    if (temp >= 35) return '🌡️';
    if (temp >= 30) return '☀️';
    if (temp >= 25) return '🌤️';
    return '❄️';
  };

  if (loading && !weather) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500"></div>
        <span className="text-gray-400 text-sm">Loading temp...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="text-red-400 text-sm">⚠️ Weather unavailable</span>
        <button 
          onClick={fetchWeather}
          className="text-xs text-teal-400 hover:text-teal-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className={`${className}`}>
      {showDetails ? (
        // Detailed view for market pages
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Current Weather</h3>
            <button 
              onClick={fetchWeather}
              className="text-teal-400 hover:text-teal-300 transition-colors"
              title="Refresh weather data"
            >
              🔄
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{getTemperatureIcon(weather.temperature)}</span>
              <div>
                <div className={`text-2xl font-bold ${getTemperatureColor(weather.temperature)}`}>
                  {weather.temperature}°C
                </div>
                <div className="text-sm text-gray-400">{weather.location}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Wind Speed:</span>
                <span className="text-white ml-2">{weather.windSpeed} km/h</span>
              </div>
              <div>
                <span className="text-gray-400">Updated:</span>
                <span className="text-white ml-2">
                  {lastUpdated ? formatTime(lastUpdated) : 'Just now'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Compact view for navbar or other places
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getTemperatureIcon(weather.temperature)}</span>
          <div className="flex flex-col">
            <span className={`font-semibold ${getTemperatureColor(weather.temperature)}`}>
              {weather.temperature}°C
            </span>
            <span className="text-xs text-gray-400">Delhi</span>
          </div>
          {loading && (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-teal-500"></div>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrentTemperature;
