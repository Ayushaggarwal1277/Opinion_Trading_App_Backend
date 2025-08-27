import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import MarketInfo from "../components/Marketinfo";
import OrderTabs from "../components/OrderTabs";
import OrderBook from "../components/OrderBook";
import YourOrders from "../components/YourOrders";
import PlaceBid from "../components/PlaceBid";
import QuickStats from "../components/QuickStats";
import PlatformStats from "../components/PlatformStats";
import LiveOrders from "../components/LiveOrders";
import CurrentTemperature from "../components/CurrentTemperature";
import TemperatureComparison from "../components/TemperatureComparison";
import { marketAPI } from "../services/api";
import webSocketService from "../services/websocket";

export default function MarketDetails() {
  const { id } = useParams();
  const [quantity, setQuantity] = useState(1);
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch market details
  useEffect(() => {
    const fetchMarketDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await marketAPI.getMarketById(id);
        
        if (response.success) {
          setMarket(response.market);
        }
      } catch (error) {
        console.error('Error fetching market details:', error);
        console.error('Error details:', error.response?.data || error.message);
        setError('Failed to load market details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchMarketDetails();
    }
  }, [id]);

  // Set up WebSocket for real-time updates
  useEffect(() => {
    if (id) {
      const socket = webSocketService.connect();
      
      if (socket) {
        // Join the market room for real-time updates
        webSocketService.joinMarket(id);

        // Listen for market updates
        webSocketService.onMarketUpdate((updatedMarket) => {
          console.log('Received market update:', updatedMarket);
          if (updatedMarket.marketId === id) {
            console.log('Updating market prices:', updatedMarket);
            setMarket(prevMarket => ({
              ...prevMarket,
              yesPrice: updatedMarket.yesPrice,
              noPrice: updatedMarket.noPrice,
              totalVolume: (updatedMarket.totalYesAmount || 0) + (updatedMarket.totalNoAmount || 0)
            }));
          }
        });

        // Listen for trade updates
        webSocketService.onTradeUpdate((tradeData) => {
          console.log('Received trade update:', tradeData);
          if (tradeData.marketId === id) {
            // Update market with new trade data
            setMarket(prevMarket => ({
              ...prevMarket,
              totalVolume: tradeData.totalVolume,
              yesPrice: tradeData.yesPrice,
              noPrice: tradeData.noPrice,
            }));
          }
        });

        // Listen for order book updates
        webSocketService.onOrderBookUpdate((orderBookData) => {
          if (orderBookData.marketId === id) {
            // Order book updates will be handled by individual components
            console.log('Order book updated:', orderBookData);
          }
        });
      }

      return () => {
        // Leave the market room when component unmounts
        webSocketService.leaveMarket(id);
        
        // Clean up listeners
        webSocketService.off('market:priceUpdate');
        webSocketService.off('market:newTrade');
        webSocketService.off('orderbook-update');
      };
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#10141c] text-white flex justify-center items-center">
        <div className="text-lg">Loading market details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#10141c] text-white flex justify-center items-center">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-[#10141c] text-white flex justify-center items-center">
        <div className="text-gray-400 text-lg">Market not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#10141c] text-white px-6 py-4">
      {/* Main Section (3/4 : 1/4 layout) */}
      <div className="flex gap-6">
        
        {/* LEFT SIDE (3/4) */}
        <div className="flex-[3] flex flex-col gap-4">
          <MarketInfo marketId={id} market={market} />
          <TemperatureComparison market={market} />
          <OrderTabs />
          <OrderBook marketId={id} />
          <YourOrders marketId={id} />
        </div>

        {/* RIGHT SIDE (1/4) */}
        <div className="flex-[1] flex flex-col gap-4">
          <PlaceBid 
            marketId={id} 
            market={market}
            quantity={quantity} 
            setQuantity={setQuantity} 
          />
          <QuickStats marketId={id} market={market} />
          <CurrentTemperature showDetails={true} className="mb-4" />
          <PlatformStats marketId={id} />
        </div>
      </div>

      {/* Footer - Live Orders Full Width */}
      <div className="mt-20 h-100"> 
        <LiveOrders marketId={id} />
      </div>
    </div>
  );
}





