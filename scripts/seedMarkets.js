import mongoose from "mongoose";
import { Market } from "../models/market.models.js";
import dotenv from "dotenv";

dotenv.config();

// Sample market data for testing
const sampleMarkets = [
  {
    question: "Will the temperature in Delhi be above 35°C on August 27, 2025 at 4:00 AM IST?",
    yesPrice: 3,
    noPrice: 7,
    expiry: new Date("2025-08-26T22:30:00Z"), // 4:00 AM IST = 22:30 UTC previous day
    threshold: 35,
    status: "active"
  },
  {
    question: "Will the temperature in Delhi be above 36°C before August 30, 2025?",
    yesPrice: 5,
    noPrice: 5,
    expiry: new Date("2025-08-30T18:29:59Z"), // 11:59 PM IST = 18:29 UTC
    threshold: 36,
    status: "active"
  },
  {
    question: "Will Mumbai receive rainfall on August 27, 2025 by 4:00 AM IST?",
    yesPrice: 6,
    noPrice: 4,
    expiry: new Date("2025-08-26T22:30:00Z"), // 4:00 AM IST = 22:30 UTC previous day
    threshold: 1, // 1mm rainfall threshold
    status: "active"
  }
];

async function seedMarkets() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing markets to update with new data
    await Market.deleteMany({});
    console.log("Cleared existing markets");

    // Insert sample markets
    const createdMarkets = await Market.insertMany(sampleMarkets);
    console.log(`✅ Successfully created ${createdMarkets.length} sample markets`);

    createdMarkets.forEach((market, index) => {
      console.log(`${index + 1}. ${market.question} (ID: ${market._id})`);
    });

  } catch (error) {
    console.error("❌ Error seeding markets:", error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

// Run the seed function
seedMarkets();
