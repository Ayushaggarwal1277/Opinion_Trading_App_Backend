import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PredictionCard from "./PredictionCard.jsx";
import { marketAPI } from "../services/api";
import webSocketService from "../services/websocket";

// Dummy images (replace with your actual imports)
import indiaGateImage from "../assets/india-gate.jpg";
import claudeTechImage from "../assets/claude-tech.jpg";
import bezosBusinessImage from "../assets/bezos-business.jpg";
import ethereumCryptoImage from "../assets/ethereum-crypto.jpg";

// Fallback images for categories
const categoryImages = {
  'Weather': indiaGateImage,
  'General': indiaGateImage,
  'Tech': claudeTechImage,
  'Finance': bezosBusinessImage,
  'Crypto': ethereumCryptoImage,
  'Politics': indiaGateImage,
  'Sports': indiaGateImage,
  'Entertainment': claudeTechImage,
};

const categoryColors = {
  'Weather': 'bg-orange-500',
  'General': 'bg-violet-500',
  'Tech': 'bg-orange-500',
  'Finance': 'bg-blue-500',
  'Crypto': 'bg-yellow-500',
  'Politics': 'bg-red-500',
  'Sports': 'bg-green-500',
  'Entertainment': 'bg-pink-500',
};

export default function PredictionGrid({ activeCategory }) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch markets from API
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await marketAPI.getActiveMarkets();
        console.log('API Response:', response);
        
        if (response.success) {
          console.log('Markets received:', response.markets);
          // Transform API data to match component expectations
          const transformedMarkets = response.markets.map(market => {
            // Categorize weather markets
            let category = 'General';
            if (market.question.toLowerCase().includes('temperature') || 
                market.question.toLowerCase().includes('weather') ||
                market.question.toLowerCase().includes('°c')) {
              category = 'Weather';
            }

            return {
              id: market._id,
              category: category,
              question: market.question,
              volume: `₹${market.totalVolume || 0}`,
              backgroundImage: categoryImages[category] || indiaGateImage,
              categoryColor: categoryColors[category] || 'bg-gray-500',
              resolved: market.status === 'resolved',
              winner: market.winner || null,
              yesPrice: market.yesPrice || 5,
              noPrice: market.noPrice || 5,
              expiryDate: market.expiryDate,
              description: market.description,
            };
          });
          
          console.log('Transformed markets:', transformedMarkets);
          setMarkets(transformedMarkets);
        }
      } catch (error) {
        console.error('Error fetching markets:', error);
        console.error('Error details:', error.response?.data || error.message);
        console.error('Full error object:', error);
        setError('Failed to load markets. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    const socket = webSocketService.connect();

    if (socket) {
      // Listen for market updates
      webSocketService.onMarketUpdate((updatedMarket) => {
        setMarkets(prevMarkets => 
          prevMarkets.map(market => 
            market.id === updatedMarket._id 
              ? {
                  ...market,
                  volume: `₹${updatedMarket.totalVolume || 0}`,
                  yesPrice: updatedMarket.yesPrice || market.yesPrice,
                  noPrice: updatedMarket.noPrice || market.noPrice,
                  resolved: updatedMarket.status === 'resolved',
                  winner: updatedMarket.winner || null,
                }
              : market
          )
        );
      });

      // Listen for price updates
      webSocketService.onPriceUpdate((priceData) => {
        setMarkets(prevMarkets =>
          prevMarkets.map(market =>
            market.id === priceData.marketId
              ? {
                  ...market,
                  yesPrice: priceData.yesPrice,
                  noPrice: priceData.noPrice,
                }
              : market
          )
        );
      });
    }

    return () => {
      // Clean up listeners
      webSocketService.off('market-update');
      webSocketService.off('price-update');
    };
  }, []);

  // Filter markets based on active category
  const filtered = activeCategory === "All"
    ? markets
    : markets.filter((market) => market.category === activeCategory);

  if (loading) {
    return (
      <div className="px-8 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-white text-lg">Loading markets...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-red-400 text-lg">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-4 text-gray-400 text-sm">
        {filtered.length} market{filtered.length !== 1 ? "s" : ""}
      </div>
      {filtered.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-400 text-lg">
            {activeCategory === "All" 
              ? "No markets available" 
              : `No markets found in ${activeCategory} category`
            }
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {filtered.map((prediction) => (
            <Link
              key={prediction.id}
              to={`/market/${prediction.id}`}
              style={{ textDecoration: "none" }}
            >
              <PredictionCard prediction={prediction} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
