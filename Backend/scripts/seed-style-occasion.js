import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { seedCostumeTaxonomy } from "../src/utils/seedDemoData.js";

try {
  await connectMongo();
  await seedCostumeTaxonomy();
  console.log("Default Style, Occasion, and Category classifications are ready.");
} catch (error) {
  console.error("Unable to seed Style and Occasion data:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
