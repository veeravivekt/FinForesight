/**
 * Shared database connection utility
 * Eliminates code duplication across services
 */

import mongoose from "mongoose";
import logger from "./logger.js";

let isConnected = false;

/**
 * Connect to MongoDB
 * @param {string} mongoUrl - MongoDB connection URL
 * @returns {Promise<void>}
 */
export const connectDB = async (mongoUrl = null) => {
  if (isConnected && mongoose.connection.readyState === 1) {
    logger.debug("MongoDB already connected");
    return;
  }

  const url = mongoUrl || process.env.MONGO_URL;

  if (!url) {
    const error = new Error("MONGO_URL environment variable is required");
    logger.error("Database connection error:", error);
    throw error;
  }

  try {
    await mongoose.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = true;
    logger.info("MongoDB connected successfully");

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      isConnected = true;
      logger.info("MongoDB reconnected");
    });
  } catch (error) {
    isConnected = false;
    logger.error("MongoDB connection error:", error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info("MongoDB disconnected");
  }
};

/**
 * Get connection status
 * @returns {boolean}
 */
export const isDBConnected = () => {
  return isConnected && mongoose.connection.readyState === 1;
};

export default { connectDB, disconnectDB, isDBConnected };

