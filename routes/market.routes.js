import { Router } from "express";
import { addMarketData, getActiveMarkets, getMarketById } from "../controllers/market.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createTrade } from "../controllers/trade.controller.js";

const marketRouter = Router();

// Public routes (no authentication required)
marketRouter.route("/active").get(getActiveMarkets);
marketRouter.route("/:marketId").get(getMarketById);

// Protected routes (authentication required)
marketRouter.route("/question").post(verifyJWT,addMarketData);
marketRouter.route("/:marketId/trades").post(verifyJWT,createTrade);


export default marketRouter;