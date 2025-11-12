import Joi from "joi";
import { sendValidationError } from "../utils/errorHandler.js";

/**
 * Request validation middleware using Joi schemas
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Where to validate from: 'body', 'query', 'params' (default: 'body')
 * @returns {Function} Express middleware function
 */
export const validateRequest = (schema, source = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendValidationError(res, errors);
    }

    // Replace req[source] with validated and sanitized value
    req[source] = value;
    next();
  };
};

/**
 * Validate request body
 * @param {Object} schema - Joi schema
 */
export const validateBody = (schema) => validateRequest(schema, "body");

/**
 * Validate request query parameters
 * @param {Object} schema - Joi schema
 */
export const validateQuery = (schema) => validateRequest(schema, "query");

/**
 * Validate request URL parameters
 * @param {Object} schema - Joi schema
 */
export const validateParams = (schema) => validateRequest(schema, "params");

