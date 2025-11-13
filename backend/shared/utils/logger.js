/**
 * Shared logger utility using Winston
 * Provides consistent logging across all services
 */

import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Define log format
const logFormat = printf(({ level, message, timestamp, stack, requestId, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  // Add request ID if present
  if (requestId) {
    log = `${timestamp} [${level}] [${requestId}]: ${message}`;
  }

  // Add stack trace for errors
  if (stack) {
    log += `\n${stack}`;
  }

  // Add metadata if present (avoid circular references)
  if (Object.keys(meta).length > 0 && meta.constructor === Object) {
    try {
      const seen = new WeakSet();
      const cleaned = JSON.stringify(meta, (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }
        return value;
      });
      log += `\n${cleaned}`;
    } catch (e) {
      log += `\n[Metadata serialization error: ${e.message}]`;
    }
  }

  return log;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat,
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || "finforesight" },
  transports: [
    // Console transport (always enabled)
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat,
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(
        timestamp(),
        logFormat,
      ),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: "logs/combined.log",
      format: combine(
        timestamp(),
        logFormat,
      ),
    }),
  ],
});

// In development, log to console with colors
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  );
}

/**
 * Create a logger instance for a specific service
 * @param {string} serviceName - Name of the service
 * @returns {winston.Logger} Logger instance
 */
export const createServiceLogger = (serviceName) => {
  return logger.child({ service: serviceName });
};

export default logger;

