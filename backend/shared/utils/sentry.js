import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

/**
 * Initialize Sentry for error tracking
 * @param {Object} options - Sentry configuration options
 */
export const initSentry = (options = {}) => {
  const {
    dsn = process.env.SENTRY_DSN,
    environment = process.env.NODE_ENV || "development",
    release = process.env.SENTRY_RELEASE,
    tracesSampleRate = environment === "production" ? 0.1 : 1.0,
    profilesSampleRate = environment === "production" ? 0.1 : 1.0,
  } = options;

  if (!dsn) {
    console.warn("Sentry DSN not provided, Sentry will not be initialized");
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release,
    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration(),
      Sentry.expressIntegration({ app: undefined }), // Will be set when app is available
    ],
    tracesSampleRate,
    profilesSampleRate,
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });

  return Sentry;
};

/**
 * Set user context for Sentry
 * @param {Object} user - User object with id, email, etc.
 */
export const setUserContext = (user) => {
  Sentry.setUser({
    id: user.id || user._id?.toString(),
    email: user.email,
    username: user.name,
  });
};

/**
 * Clear user context
 */
export const clearUserContext = () => {
  Sentry.setUser(null);
};

/**
 * Capture exception
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 */
export const captureException = (error, context = {}) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

/**
 * Capture message
 * @param {string} message - Message to capture
 * @param {string} level - Severity level (info, warning, error)
 */
export const captureMessage = (message, level = "info") => {
  Sentry.captureMessage(message, level);
};

export default Sentry;

