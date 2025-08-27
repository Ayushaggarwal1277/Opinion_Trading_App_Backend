import { Router } from "express";
import { addMarketData, getActiveMarkets, getMarketById } from "../controllers/market.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createTrade, getOrderBook, getUserOrders, getAllUserOrders } from "../controllers/trade.controller.js";

const marketRouter = Router();

// Public routes (no authentication required)
marketRouter.route("/active").get(getActiveMarkets);
marketRouter.route("/:marketId").get(getMarketById);
marketRouter.route("/:marketId/orderbook").get(getOrderBook);

// Protected routes (authentication required)
marketRouter.route("/question").post(verifyJWT,addMarketData);
marketRouter.route("/:marketId/trades").post(verifyJWT,createTrade);
marketRouter.route("/:marketId/user-orders").get(verifyJWT, getUserOrders);


export default marketRouter;