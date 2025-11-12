import { randomUUID } from "crypto";

/**
 * Middleware to generate and attach request ID for correlation
 * Adds request ID to request object and response headers
 */
export const requestIdMiddleware = (req, res, next) => {
  // Get request ID from header or generate new one
  const requestId = req.headers["x-request-id"] || randomUUID();

  // Attach to request object
  req.requestId = requestId;

  // Add to response headers for client correlation
  res.setHeader("X-Request-ID", requestId);

  next();
};

/**
 * Get request ID from request object
 * @param {Object} req - Express request object
 * @returns {string} Request ID
 */
export const getRequestId = (req) => {
  return req.requestId || "unknown";
};

