import { checkRateLimit } from "../utils/redis.js";
import logger from "../utils/logger.js";

export const createRateLimiter = (limit = 100, window = 60) => {
  return async (req, res, next) => {
    try {
      const identifier = req.userId || req.ip || "anonymous";
      const key = `ratelimit:${identifier}`;

      const allowed = await checkRateLimit(key, limit, window);

      if (!allowed) {
        return res.status(429).json({
          error: "Too many requests, please try again later",
        });
      }

      next();
    } catch (error) {
      // If Redis fails, allow the request
      logger.error("Rate limiter error:", error);
      next();
    }
  };
};

