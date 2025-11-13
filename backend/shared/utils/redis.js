import redis from "redis";
import logger from "./logger.js";

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  logger.error("Redis Client Error:", err);
});

redisClient.on("connect", () => {
  logger.info("Redis Client Connected");
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error("Redis connection error:", error);
  }
};

// Session management
export const setSession = async (userId, refreshToken, expiresIn = 7 * 24 * 60 * 60) => {
  // expiresIn in seconds (default 7 days)
  await redisClient.setEx(`session:${userId}`, expiresIn, refreshToken);
};

export const getSession = async (userId) => {
  return await redisClient.get(`session:${userId}`);
};

export const deleteSession = async (userId) => {
  await redisClient.del(`session:${userId}`);
};

// Cache management
export const setCache = async (key, value, expiresIn = 3600) => {
  await redisClient.setEx(key, expiresIn, JSON.stringify(value));
};

export const getCache = async (key) => {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

export const deleteCache = async (key) => {
  await redisClient.del(key);
};

// Pattern-based cache invalidation using SCAN
export const invalidatePattern = async (pattern) => {
  try {
    const keys = [];
    let cursor = 0;

    do {
      // Redis v4 SCAN API: scan(cursor, { MATCH, COUNT })
      const result = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      // Result format: { cursor: number, keys: string[] }
      cursor = typeof result === "object" && result.cursor !== undefined ? result.cursor : (Array.isArray(result) ? result[0] : 0);
      const foundKeys = typeof result === "object" && Array.isArray(result.keys) ? result.keys : (Array.isArray(result) && result.length > 1 ? result[1] : []);
      keys.push(...foundKeys);
    } while (cursor !== 0);

    if (keys.length > 0) {
      // Delete keys in batches to avoid blocking Redis
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        // del can take multiple keys as arguments or array
        if (batch.length === 1) {
          await redisClient.del(batch[0]);
        } else {
          await redisClient.del(batch);
        }
      }
      logger.debug(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
    }

    return keys.length;
  } catch (error) {
    logger.error(`Error invalidating cache pattern ${pattern}:`, error);
    // Fallback: try to handle gracefully
    return 0;
  }
};

// Rate limiting
export const checkRateLimit = async (key, limit = 100, window = 60) => {
  const current = await redisClient.incr(key);
  if (current === 1) {
    await redisClient.expire(key, window);
  }
  return current <= limit;
};

connectRedis();

export default redisClient;

