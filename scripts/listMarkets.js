import mongoose from "mongoose";
import { Market } from "../models/market.models.js";
import dotenv from "dotenv";

dotenv.config();

async function listMarkets() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const markets = await Market.find({});
    console.log(`\n📊 Found ${markets.length} markets:`);
    
    markets.forEach((market, index) => {
      console.log(`${index + 1}. "${market.question}" (ID: ${market._id})`);
    });

    if (markets.length > 1) {
      console.log("\n🗑️  Removing non-weather markets...");
      
      // Keep only the weather market
      const deleteResult = await Market.deleteMany({
        question: { $not: /temperature.*Delhi|weather.*Delhi/i }
      });
      
      console.log(`✅ Deleted ${deleteResult.deletedCount} markets`);
      
      const remainingMarkets = await Market.find({});
      console.log(`\n📊 Remaining markets: ${remainingMarkets.length}`);
      remainingMarkets.forEach((market, index) => {
        console.log(`${index + 1}. "${market.question}"`);
      });
    } else {
      console.log("\n✅ Database already has only the weather market!");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

listMarkets();
