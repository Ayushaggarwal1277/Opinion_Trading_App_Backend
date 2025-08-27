import mongoose from "mongoose";
import { Market } from "../models/market.models.js";
import dotenv from "dotenv";

dotenv.config();

async function cleanupMarkets() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all current markets
    const allMarkets = await Market.find({});
    console.log("\n📊 Current Markets:");
    allMarkets.forEach((market, index) => {
      console.log(`${index + 1}. ${market.question} (ID: ${market._id})`);
    });

    // Delete all non-weather markets
    const deleteResult = await Market.deleteMany({
      question: { $not: /temperature|weather|Delhi/i }
    });
    
    console.log(`\n🗑️  Deleted ${deleteResult.deletedCount} non-weather markets`);

    // Check if weather market exists, if not create it
    const weatherMarket = await Market.findOne({
      question: /temperature.*Delhi/i
    });

    if (!weatherMarket) {
      console.log("\n🌡️  Creating weather market...");
      const newWeatherMarket = await Market.create({
        question: "Will the temperature in Delhi be above 36°C before August 30, 2025?",
        yesPrice: 60,
        noPrice: 40,
        expiry: new Date("2025-08-30T23:59:59Z"),
        threshold: 36,
        status: "active"
      });
      console.log(`✅ Created weather market: ${newWeatherMarket.question} (ID: ${newWeatherMarket._id})`);
    } else {
      console.log(`\n✅ Weather market already exists: ${weatherMarket.question} (ID: ${weatherMarket._id})`);
    }

    // Show final markets
    const finalMarkets = await Market.find({});
    console.log("\n📊 Final Markets:");
    finalMarkets.forEach((market, index) => {
      console.log(`${index + 1}. ${market.question} (ID: ${market._id})`);
    });

  } catch (error) {
    console.error("❌ Error cleaning up markets:", error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

// Run the cleanup function
cleanupMarkets();
