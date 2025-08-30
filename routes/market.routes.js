import { Router } from "express";
import { addMarketData, getActiveMarkets, getMarketById, getMarketStatus, checkThreshold } from "../controllers/market.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createTrade, getOrderBook, getUserOrders, getAllUserOrders } from "../controllers/trade.controller.js";

const marketRouter = Router();

// Public routes (no authentication required)
marketRouter.route("/active").get(getActiveMarkets);
marketRouter.route("/:marketId").get(getMarketById);
marketRouter.route("/:marketId/status").get(getMarketStatus); // NEW: Enhanced market status
marketRouter.route("/:marketId/orderbook").get(getOrderBook);

// Protected routes (authentication required)
marketRouter.route("/question").post(verifyJWT,addMarketData);
marketRouter.route("/:marketId/trades").post(verifyJWT,createTrade);
marketRouter.route("/:marketId/user-orders").get(verifyJWT, getUserOrders);
marketRouter.route("/:marketId/check-threshold").post(verifyJWT, checkThreshold); // NEW: Manual threshold check


export default marketRouter;