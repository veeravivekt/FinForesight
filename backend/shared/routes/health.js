import express from "express";
import mongoose from "mongoose";
import redisClient from "../utils/redis.js";
import { isDBConnected } from "../utils/database.js";

const router = express.Router();

/**
 * Health check endpoint
 * Returns service health status including database and Redis connectivity
 */
router.get("/", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME || "unknown",
    checks: {
      database: "unknown",
      redis: "unknown",
    },
  };

  // Check database connection
  try {
    if (isDBConnected() && mongoose.connection.readyState === 1) {
      health.checks.database = "connected";

      // Test database query
      await mongoose.connection.db.admin().ping();
      health.checks.database = "healthy";
    } else {
      health.checks.database = "disconnected";
      health.status = "degraded";
    }
  } catch (error) {
    health.checks.database = "error";
    health.status = "unhealthy";
  }

  // Check Redis connection
  try {
    if (redisClient.isOpen || redisClient.isReady) {
      await redisClient.ping();
      health.checks.redis = "healthy";
    } else {
      health.checks.redis = "disconnected";
      if (health.status === "ok") {
        health.status = "degraded";
      }
    }
  } catch (error) {
    health.checks.redis = "error";
    health.status = "unhealthy";
  }

  const statusCode = health.status === "ok" ? 200 : health.status === "degraded" ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Liveness probe - simple check if service is running
 */
router.get("/liveness", (req, res) => {
  res.json({ status: "alive" });
});

/**
 * Readiness probe - check if service is ready to accept traffic
 */
router.get("/readiness", async (req, res) => {
  const checks = {
    database: false,
    redis: false,
  };

  try {
    // Check database
    if (isDBConnected() && mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      checks.database = true;
    }

    // Check Redis
    if (redisClient.isOpen || redisClient.isReady) {
      await redisClient.ping();
      checks.redis = true;
    }
  } catch (error) {
    // Checks remain false
  }

  const isReady = checks.database && checks.redis;
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    checks,
  });
});

export default router;

