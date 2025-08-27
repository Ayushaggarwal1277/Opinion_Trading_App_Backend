import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import CategoryFilters from "./components/CategoryFilters";
import PredictionGrid from "./components/PredictionGrid";
import CallToAction from "./components/CallToAction";
import MarketDetails from "./Pages/MarketDetails";
import AdminPortal from "./Pages/AdminPortal";
import AdminMarkets from "./Pages/AdminMarkets";
import Login from "./components/Login";
import Register from "./components/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";

function AppContent() {
  const [activeCategory, setActiveCategory] = useState("Weather");
  const { user } = useAuth();

  // Test API connection on app start (development only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("🚀 NXTwin Frontend Connected to Backend!");
    }
  }, []);

  return (
    <Router basename={import.meta.env.DEV ? '/' : '/Opinion_Trading_App_Backend'}>
      <div className="min-h-screen bg-[#10141c]">
        <Navbar />
        <Routes>
          <Route
            path="/"
            element={
              // Redirect admins to admin portal automatically
              user?.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : (
                <>
                  <CategoryFilters
                    activeCategory={activeCategory}
                    setActiveCategory={setActiveCategory}
                  />
                  <CallToAction />
                  <PredictionGrid activeCategory={activeCategory} />
                </>
              )
            }
          />
          <Route 
            path="/market/:id" 
            element={<MarketDetails />} 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminPortal />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/markets" 
            element={
              <ProtectedRoute>
                <AdminMarkets />
              </ProtectedRoute>
            } 
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

