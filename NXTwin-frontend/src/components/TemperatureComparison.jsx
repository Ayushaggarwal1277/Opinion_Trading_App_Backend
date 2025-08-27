import React, { useState, useEffect } from 'react';
import { weatherAPI } from '../services/api';

const TemperatureComparison = ({ market, className = "" }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const response = await weatherAPI.getCurrentWeather();
        if (response.success) {
          setWeather(response.data);
        }
      } catch (error) {
        console.error('Weather fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    
    // Update every 5 minutes
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!market || loading || !weather) return null;

  const currentTemp = weather.temperature;
  const threshold = market.threshold;
  const difference = currentTemp - threshold;
  const currentlyWinning = currentTemp >= threshold ? 'YES' : 'NO';

  const getProgressWidth = () => {
    // Show progress relative to threshold ±10 degrees
    const range = 20; // 10 degrees on each side
    const position = ((currentTemp - (threshold - 10)) / range) * 100;
    return Math.max(0, Math.min(100, position));
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Temperature vs Threshold</h3>
      
      <div className="space-y-4">
        {/* Current Status */}
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-400">Current Temperature</div>
            <div className="text-2xl font-bold text-white">{currentTemp}°C</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Threshold</div>
            <div className="text-2xl font-bold text-white">{threshold}°C</div>
          </div>
        </div>

        {/* Temperature Progress Bar */}
        <div className="relative">
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-red-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${getProgressWidth()}%` }}
            ></div>
          </div>
          
          {/* Threshold marker */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
            <div className="w-px h-4 bg-white"></div>
            <div className="text-xs text-white mt-1 transform -translate-x-1/2">
              {threshold}°C
            </div>
          </div>
        </div>

        {/* Difference Display */}
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-400">Difference</div>
            <div className={`text-lg font-semibold ${difference >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
              {difference >= 0 ? '+' : ''}{difference.toFixed(1)}°C
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Currently Winning</div>
            <div className={`text-lg font-bold px-3 py-1 rounded-full ${
              currentlyWinning === 'YES' 
                ? 'bg-green-900 text-green-300' 
                : 'bg-red-900 text-red-300'
            }`}>
              {currentlyWinning}
            </div>
          </div>
        </div>

        {/* Insight */}
        <div className="bg-gray-750 rounded-lg p-3">
          <div className="text-sm text-gray-300">
            {difference >= 0 ? (
              <>
                🔥 Temperature is <strong>{difference.toFixed(1)}°C above</strong> the threshold. 
                YES trades would win if the market closed now.
              </>
            ) : (
              <>
                ❄️ Temperature is <strong>{Math.abs(difference).toFixed(1)}°C below</strong> the threshold. 
                NO trades would win if the market closed now.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemperatureComparison;
