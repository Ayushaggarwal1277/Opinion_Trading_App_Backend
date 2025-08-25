import asyncHandler from "../utils/asyncHandler.js";
import { Market } from "../models/market.models.js";

const addMarketData = asyncHandler(async (req, res) => {

    const user = req.user;
        if (user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: "Forbidden: Admins only"
        });
    }
    const { question, expiry, threshold } = req.body;
    if (!question || !expiry || !threshold) {
        return res.status(400).json({
            success: false,
            message: "Please provide question, expiry date and threshold"
        });
    }
    const existingMarket = await Market.findOne({ question });  
    if (existingMarket) {
        return res.status(400).json({
            success: false,
            message: "Market with this question already exists"
        });
    }
    const market = await Market.create({
        question,
        expiry,
        threshold
    });

    if (!market) {
        return res.status(500).json({
            success: false,
            message: "Failed to create market"
        });
    }
    return res.status(201).json({ market });
});

const getActiveMarkets = asyncHandler(async (req, res) => {
    const activeMarkets = await Market.find({
        status: "active",
        expiry: { $gt: new Date() }
    }).sort({ createdAt: -1 }).select("-yesVolume -noVolume");

    return res.status(200).json({
        success: true,
        markets: activeMarkets,
        count: activeMarkets.length
    });
});

const getMarketById = asyncHandler(async (req, res) => {
    const { marketId } = req.params;
    
    const market = await Market.findById(marketId);
    
    if (!market) {
        return res.status(404).json({
            success: false,
            message: "Market not found"
        });
    }

    const outputMarket = await Market.findById(marketId).select("-totalYesAmount -totalNoAmount");

    return res.status(200).json({
        success: true,
        market: outputMarket
    });
});

export { 
    addMarketData,
    getActiveMarkets,
    getMarketById
 };



