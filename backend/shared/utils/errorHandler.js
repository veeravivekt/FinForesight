/**
 * Standardized error handler utility for consistent error responses across all services
 */

import logger from "./logger.js";

/**
 * Send a standardized error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} [code] - Optional error code for programmatic handling
 * @param {any} [details] - Optional additional error details
 */
export const sendError = (res, statusCode, message, code = null, details = null) => {
  const errorResponse = {
    error: message,
  };

  if (code) {
    errorResponse.code = code;
  }

  if (details) {
    errorResponse.details = details;
  }

  return res.status(statusCode).json(errorResponse);
};

/**
 * Send a validation error response
 * @param {Object} res - Express response object
 * @param {string|Array} errors - Validation error message(s)
 */
export const sendValidationError = (res, errors) => {
  // Convert array of errors to single message for consistency
  const message = Array.isArray(errors) 
    ? errors.join(", ") 
    : errors;
  
  return sendError(res, 400, message, "VALIDATION_ERROR");
};

/**
 * Send a not found error response
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name (e.g., "Account", "Transaction")
 */
export const sendNotFoundError = (res, resource = "Resource") => {
  return sendError(res, 404, `${resource} not found`, "NOT_FOUND");
};

/**
 * Send an unauthorized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export const sendUnauthorizedError = (res, message = "Unauthorized") => {
  return sendError(res, 401, message, "UNAUTHORIZED");
};

/**
 * Send a forbidden error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export const sendForbiddenError = (res, message = "Forbidden") => {
  return sendError(res, 403, message, "FORBIDDEN");
};

/**
 * Send an internal server error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (defaults to generic message)
 */
export const sendInternalError = (res, message = "Internal server error") => {
  // In development, include more details
  const errorMessage = process.env.NODE_ENV === "development" 
    ? message 
    : "Internal server error";
  return sendError(res, 500, errorMessage, "INTERNAL_ERROR");
};

/**
 * Async error handler wrapper for route handlers
 * Automatically catches errors and sends standardized error response
 * @param {Function} fn - Async route handler function
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Log error
      logger.error("Route handler error:", error);
      
      // Send standardized error response
      sendInternalError(res, "Internal server error");
    });
  };
};

