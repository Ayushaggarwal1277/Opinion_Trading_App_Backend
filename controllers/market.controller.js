import asyncHandler from "../utils/asyncHandler.js";
import { Market } from "../models/market.models.js";
import { checkMarketThreshold } from "../jobs/marketScheduler.js";

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

// **NEW: Get market status with threshold analysis**
const getMarketStatus = asyncHandler(async (req, res) => {
    const { marketId } = req.params;
    
    const market = await Market.findById(marketId);
    
    if (!market) {
        return res.status(404).json({
            success: false,
            message: "Market not found"
        });
    }

    // Calculate threshold proximity
    const thresholdDistance = market.threshold - market.yesPrice;
    const thresholdPercentage = (market.yesPrice / market.threshold) * 100;
    
    return res.status(200).json({
        success: true,
        market: {
            _id: market._id,
            question: market.question,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            threshold: market.threshold,
            status: market.status,
            expiry: market.expiry,
            result: market.result,
            totalYesAmount: market.totalYesAmount,
            totalNoAmount: market.totalNoAmount
        },
        thresholdAnalysis: {
            distanceToThreshold: thresholdDistance,
            percentageOfThreshold: Math.round(thresholdPercentage * 100) / 100,
            willAutoSettle: market.yesPrice >= market.threshold,
            timeToExpiry: market.expiry > new Date() ? 
                Math.ceil((market.expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0, // days
            status: market.yesPrice >= market.threshold ? "THRESHOLD_REACHED" : 
                   market.status === "expired" ? "EXPIRED" : "ACTIVE"
        }
    });
});

// **NEW: Manually trigger threshold check**
const checkThreshold = asyncHandler(async (req, res) => {
    const { marketId } = req.params;
    
    const market = await Market.findById(marketId);
    
    if (!market) {
        return res.status(404).json({
            success: false,
            message: "Market not found"
        });
    }

    if (market.status !== "active") {
        return res.status(400).json({
            success: false,
            message: "Market is not active"
        });
    }

    const wasTriggered = await checkMarketThreshold(marketId);
    
    return res.status(200).json({
        success: true,
        message: wasTriggered ? "Threshold reached - market auto-settled!" : "Threshold not reached",
        thresholdTriggered: wasTriggered,
        currentPrice: market.yesPrice,
        threshold: market.threshold
    });
});

export { 
    addMarketData,
    getActiveMarkets,
    getMarketById,
    getMarketStatus,
    checkThreshold
 };



