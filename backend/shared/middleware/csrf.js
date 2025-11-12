import { randomBytes } from "crypto";
import { setCache, getCache } from "../utils/redis.js";

const CSRF_TOKEN_EXPIRY = 3600; // 1 hour

/**
 * Generate CSRF token
 * @returns {string} CSRF token
 */
export const generateCsrfToken = () => {
  return randomBytes(32).toString("hex");
};

/**
 * CSRF protection middleware
 * Validates CSRF token from header or query parameter
 */
export const csrfProtection = async (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF in development if disabled
  if (process.env.DISABLE_CSRF === "true" || process.env.NODE_ENV === "development") {
    return next();
  }

  const token = req.headers["x-csrf-token"] || req.query.csrf_token;
  const sessionId = req.headers["x-session-id"] || req.userId;

  if (!token || !sessionId) {
    return res.status(403).json({
      error: "CSRF token missing",
      code: "CSRF_TOKEN_MISSING",
    });
  }

  // Verify token from Redis
  const storedToken = await getCache(`csrf:${sessionId}`);
  if (!storedToken || storedToken !== token) {
    return res.status(403).json({
      error: "Invalid CSRF token",
      code: "CSRF_TOKEN_INVALID",
    });
  }

  next();
};

/**
 * Middleware to generate and send CSRF token
 * Call this before routes that need CSRF protection
 */
export const csrfTokenGenerator = async (req, res, next) => {
  const sessionId = req.userId || req.ip;
  const token = generateCsrfToken();

  // Store token in Redis
  await setCache(`csrf:${sessionId}`, token, CSRF_TOKEN_EXPIRY);

  // Send token in response header
  res.setHeader("X-CSRF-Token", token);

  next();
};

