import express from "express";
import { createServer } from "http";
import app from "./app.js";
import connectDB from "./utils/db.js";
import { initializeWebSocket } from "./utils/websocket.js";
import "./jobs/marketScheduler.js";

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket
const io = initializeWebSocket(server);

connectDB().then(() => {
  console.log("Database connected successfully");
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket server initialized and ready for connections`);
  });
}).catch((error) => {
  console.error("Database connection failed:", error);
  process.exit(1);
});

