import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import router from "./routes/user.routes.js";
import marketRouter from "./routes/market.routes.js";
import weatherRouter from "./routes/weather.routes.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check route for Railway
app.get("/", (req, res) => {
  res.json({ 
    message: "Opinion Trading App Backend is running!", 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// Routes
app.use("/users",router);

// Add market
app.use("/market", marketRouter);

// Add weather
app.use("/weather", weatherRouter);

export default app;
