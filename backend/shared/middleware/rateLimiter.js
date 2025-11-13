import { checkRateLimit } from "../utils/redis.js";
import redisClient from "../utils/redis.js";
import logger from "../utils/logger.js";

export const createRateLimiter = (limit = 100, window = 60) => {
  return async (req, res, next) => {
    // Skip rate limiting in development if DISABLE_RATE_LIMIT is set
    if (process.env.DISABLE_RATE_LIMIT === "true" || process.env.NODE_ENV === "development") {
      // Still log but don't block in development
      logger.debug("Rate limiter bypassed in development mode");
      return next();
    }

    try {
      const identifier = req.userId || req.ip || "anonymous";
      const key = `ratelimit:${identifier}`;

      const allowed = await checkRateLimit(key, limit, window);

      // Get current count for headers
      const currentCount = await redisClient.get(key) || 0;
      const remaining = Math.max(0, limit - parseInt(currentCount));
      const resetTime = Math.ceil(Date.now() / 1000) + window;

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", limit.toString());
      res.setHeader("X-RateLimit-Remaining", remaining.toString());
      res.setHeader("X-RateLimit-Reset", resetTime.toString());

      if (!allowed) {
        logger.warn(`Rate limit exceeded for ${identifier} (${limit} requests per ${window}s)`);
        return res.status(429).json({
          error: "Too many requests, please try again later",
          message: `Rate limit exceeded: ${limit} requests per ${window} seconds`,
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: window,
        });
      }

      next();
    } catch (error) {
      // If Redis fails, allow the request (fail open)
      logger.error("Rate limiter error:", error);
      next();
    }
  };
};

