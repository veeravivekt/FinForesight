import { checkRateLimit } from "../utils/redis.js";
import logger from "../utils/logger.js";

export const createRateLimiter = (limit = 100, window = 60) => {
  return async (req, res, next) => {
    // Skip rate limiting in development if DISABLE_RATE_LIMIT is set
    if (process.env.DISABLE_RATE_LIMIT === "true" || process.env.NODE_ENV === "development") {
      // Still log but don't block in development
      logger.debug(`Rate limiter bypassed in development mode`);
      return next();
    }

    try {
      const identifier = req.userId || req.ip || "anonymous";
      const key = `ratelimit:${identifier}`;

      const allowed = await checkRateLimit(key, limit, window);

      if (!allowed) {
        logger.warn(`Rate limit exceeded for ${identifier} (${limit} requests per ${window}s)`);
        return res.status(429).json({
          error: "Too many requests, please try again later",
          message: `Rate limit exceeded: ${limit} requests per ${window} seconds`,
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

