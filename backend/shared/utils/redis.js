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

