import redis from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

const clearRateLimits = async () => {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");

    // Get all rate limit keys
    const keys = await redisClient.keys("ratelimit:*");

    if (keys.length === 0) {
      console.log("No rate limit keys found.");
      await redisClient.quit();
      return;
    }

    console.log(`Found ${keys.length} rate limit key(s)`);

    // Delete all rate limit keys
    for (const key of keys) {
      await redisClient.del(key);
      console.log(`Cleared: ${key}`);
    }

    console.log("\n✅ All rate limits cleared!");
    await redisClient.quit();
  } catch (error) {
    console.error("Error clearing rate limits:", error);
    process.exit(1);
  }
};

clearRateLimits();






