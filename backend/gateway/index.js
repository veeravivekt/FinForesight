import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "../shared/swagger/swagger.config.js";
import { authenticate } from "../shared/middleware/auth.js";
import { createRateLimiter } from "../shared/middleware/rateLimiter.js";
import { requestIdMiddleware } from "../shared/middleware/requestId.js";
import { metricsMiddleware, getMetrics } from "../shared/utils/metrics.js";
import { initSentry } from "../shared/utils/sentry.js";
import healthRoutes from "../shared/routes/health.js";
import axios from "axios";
import { createServiceLogger } from "../shared/utils/logger.js";
import { sendError, sendInternalError } from "../shared/utils/errorHandler.js";
import multer from "multer";
import FormDataLib from "form-data";

// Initialize Sentry
initSentry();

dotenv.config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;
const serviceLogger = createServiceLogger("api-gateway");

// Service URLs
const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || "http://localhost:3008";
const TRANSACTION_SERVICE = process.env.TRANSACTION_SERVICE_URL || "http://localhost:3002";
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:3003";
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3004";
const ACCOUNT_SERVICE = process.env.ACCOUNT_SERVICE_URL || "http://localhost:3005";
const BUDGET_SERVICE = process.env.BUDGET_SERVICE_URL || "http://localhost:3006";
const GOAL_SERVICE = process.env.GOAL_SERVICE_URL || "http://localhost:3007";

// Middleware
app.use(requestIdMiddleware); // Add request ID for correlation
app.use(compression()); // Compress responses
// Only parse JSON for non-multipart requests
app.use((req, res, next) => {
  if (req.headers["content-type"] && req.headers["content-type"].includes("multipart/form-data")) {
    return next(); // Skip JSON parsing for multipart
  }
  express.json()(req, res, next);
});
// Enhanced security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Swagger UI
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(metricsMiddleware); // Track metrics
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true,
}));

// Rate limiter - very permissive for development
// Note: Auth routes bypass this via their own rate limiters
const gatewayLimiter = createRateLimiter(10000, 60); // 10000 requests per minute (effectively disabled for dev)
app.use(gatewayLimiter);

// Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "FinForesight API Documentation",
}));

// Serve OpenAPI JSON spec
app.get("/api-docs/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});


// Proxy function for API requests (JSON responses and file uploads)
const proxyRequest = async (serviceUrl, req, res, servicePathPrefix = "") => {
  try {
    // Express middleware strips the matched prefix from req.path
    // So /api/transactions becomes / in req.path when using app.use
    // We need to construct the correct path
    let targetPath = servicePathPrefix;

    // If req.path is not just "/", append it
    if (req.path && req.path !== "/") {
      targetPath = servicePathPrefix + req.path;
    } else if (req.path === "/" && servicePathPrefix) {
      // If path is "/" and we have a prefix, use just the prefix
      targetPath = servicePathPrefix;
    }

    // Ensure path starts with /
    if (!targetPath.startsWith("/")) {
      targetPath = `/${  targetPath}`;
    }

    // Build query string if needed
    const queryString = req.query && Object.keys(req.query).length > 0
      ? `?${  new URLSearchParams(req.query).toString()}`
      : "";

    const fullUrl = `${serviceUrl}${targetPath}${queryString}`;

    serviceLogger.info(`Proxying ${req.method} ${req.originalUrl} -> ${fullUrl}`);

    // Prepare headers
    const headers = {
      "Authorization": req.headers.authorization || "", // Forward auth header
    };

    // Check if files were already parsed by multer (for receipt uploads)
    const contentType = req.headers["content-type"] || "";
    // Only treat as multipart if files actually exist (not just based on content-type header)
    const hasFiles = req.files && req.files.length > 0;
    const isMultipart = hasFiles;

    const requestData = req.body;

    // For multipart/form-data that was parsed by multer, reconstruct FormData
    if (isMultipart && hasFiles) {
      const formData = new FormDataLib();

      // Add files
      for (const file of req.files) {
        formData.append(file.fieldname || "image", file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });
      }

      // Add other form fields
      if (req.body && typeof req.body === "object") {
        for (const key in req.body) {
          if (req.body[key] !== undefined && req.body[key] !== null) {
            formData.append(key, req.body[key]);
          }
        }
      }

      // Forward headers (form-data will set Content-Type with boundary)
      const formHeaders = formData.getHeaders();
      const forwardHeaders = {
        ...headers,
        ...formHeaders,
      };

      const response = await axios({
        method: req.method,
        url: fullUrl,
        data: formData,
        headers: forwardHeaders,
        validateStatus: () => true,
        timeout: 120000, // 2 minutes for file uploads
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      return res.status(response.status).json(response.data);
    }

    // For non-multipart requests (including multipart content-type without files)
    // Always use application/json when sending JSON data to avoid header/body mismatch
    headers["Content-Type"] = "application/json";

    const response = await axios({
      method: req.method,
      url: fullUrl,
      data: requestData,
      headers,
      validateStatus: () => true, // Accept all status codes
      timeout: 30000, // 30 second timeout for regular requests
    });

    // Forward the response status and data
    return res.status(response.status).json(response.data);
  } catch (error) {
    serviceLogger.error("Proxy error:", error);
    serviceLogger.error("Error details:", error.message);
    if (error.response) {
      serviceLogger.error("Response status:", error.response.status);
      serviceLogger.error("Response data:", error.response.data);
    }
    return sendInternalError(res);
  }
};

// Proxy function for static files (binary responses)
const proxyStaticFile = async (serviceUrl, req, res, servicePathPrefix = "", pathOverride = null) => {
  try {
    // Express middleware strips the matched prefix from req.path when using app.use()
    // But when using app.get(), req.path contains the full path
    // We need to construct the correct path similar to proxyRequest
    // Use pathOverride if provided (for cases where req.path needs to be modified)
    const pathToUse = pathOverride !== null ? pathOverride : req.path;
    let targetPath = servicePathPrefix;

    // If pathToUse is not just "/", append it
    if (pathToUse && pathToUse !== "/") {
      targetPath = servicePathPrefix + pathToUse;
    } else if (pathToUse === "/" && servicePathPrefix) {
      // If path is "/" and we have a prefix, use just the prefix
      targetPath = servicePathPrefix;
    }

    // Ensure path starts with /
    if (!targetPath.startsWith("/")) {
      targetPath = `/${  targetPath}`;
    }

    // Build query string if needed
    const queryString = req.query && Object.keys(req.query).length > 0
      ? `?${  new URLSearchParams(req.query).toString()}`
      : "";

    const fullUrl = `${serviceUrl}${targetPath}${queryString}`;

    serviceLogger.debug(`Proxying static file ${req.method} ${req.originalUrl} -> ${fullUrl}`);

    const response = await axios({
      method: req.method,
      url: fullUrl,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        "Authorization": req.headers.authorization || "", // Forward auth header
      },
      responseType: "arraybuffer", // Handle binary data
      validateStatus: () => true,
    });

    // Set appropriate headers for file serving
    res.set({
      "Content-Type": response.headers["content-type"] || "application/octet-stream",
      "Content-Length": response.headers["content-length"],
    });

    res.status(response.status).send(Buffer.from(response.data));
  } catch (error) {
    serviceLogger.error("Static file proxy error:", error);
    serviceLogger.error("Error details:", error.message);
    if (error.response) {
      serviceLogger.error("Response status:", error.response.status);
      serviceLogger.error("Response data:", error.response.data);
    }
    sendInternalError(res);
  }
};

// API Versioning - Support both /api and /api/v1
const apiVersion = process.env.API_VERSION || "v1";
const apiPrefix = `/api/${apiVersion}`;

// Health and metrics routes (no versioning)
app.use("/health", healthRoutes);
app.get("/metrics", async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.setHeader("Content-Type", "text/plain");
    res.send(metrics);
  } catch (error) {
    serviceLogger.error("Error generating metrics:", error);
    sendInternalError(res);
  }
});

// Auth routes (no authentication required)
app.use(`${apiPrefix}/auth`, async (req, res, next) => {
  try {
    await proxyRequest(AUTH_SERVICE, req, res, "/auth");
  } catch (error) {
    serviceLogger.error("Auth route error:", error);
    next(error);
  }
});

// Legacy /api/auth support (redirect to v1)
app.use("/api/auth", async (req, res, next) => {
  try {
    await proxyRequest(AUTH_SERVICE, req, res, "/auth");
  } catch (error) {
    serviceLogger.error("Auth route error:", error);
    next(error);
  }
});

// Export routes (authentication required, returns files)
// Must be before /api/transactions to match first
// Support both /api and /api/v1 prefixes

// Versioned export routes (/api/v1/transactions/export/*)
app.get(`${apiPrefix}/transactions/export/csv`, authenticate, async (req, res, next) => {
  try {
    // Extract export path from the route - we know it's /export/csv
    await proxyStaticFile(TRANSACTION_SERVICE, req, res, "/transactions", "/export/csv");
  } catch (error) {
    serviceLogger.error("Export CSV route error:", error);
    next(error);
  }
});

app.get(`${apiPrefix}/transactions/export/pdf`, authenticate, async (req, res, next) => {
  try {
    await proxyStaticFile(TRANSACTION_SERVICE, req, res, "/transactions", "/export/pdf");
  } catch (error) {
    serviceLogger.error("Export PDF route error:", error);
    next(error);
  }
});

app.get(`${apiPrefix}/transactions/export/excel`, authenticate, async (req, res, next) => {
  try {
    await proxyStaticFile(TRANSACTION_SERVICE, req, res, "/transactions", "/export/excel");
  } catch (error) {
    serviceLogger.error("Export Excel route error:", error);
    next(error);
  }
});

app.get(`${apiPrefix}/transactions/export/json`, authenticate, async (req, res, next) => {
  try {
    await proxyStaticFile(TRANSACTION_SERVICE, req, res, "/transactions", "/export/json");
  } catch (error) {
    serviceLogger.error("Export JSON route error:", error);
    next(error);
  }
});

// Legacy export routes (/api/transactions/export/*)
app.get("/api/transactions/export/csv", authenticate, async (req, res, next) => {
  try {
    await proxyStaticFile(TRANSACTION_SERVICE, req, res, "/transactions", "/export/csv");
  } catch (error) {
    serviceLogger.error("Export CSV route error:", error);
    next(error);
  }
});

app.get("/api/transactions/export/pdf", authenticate, async (req, res, next) => {
  try {
    await proxyStaticFile(TRANSACTION_SERVICE, req, res, "/transactions", "/export/pdf");
  } catch (error) {
    serviceLogger.error("Export PDF route error:", error);
    next(error);
  }
});

app.get("/api/transactions/export/excel", authenticate, async (req, res, next) => {
  try {
    await proxyStaticFile(TRANSACTION_SERVICE, req, res, "/transactions", "/export/excel");
  } catch (error) {
    serviceLogger.error("Export Excel route error:", error);
    next(error);
  }
});

app.get("/api/transactions/export/json", authenticate, async (req, res, next) => {
  try {
    await proxyStaticFile(TRANSACTION_SERVICE, req, res, "/transactions", "/export/json");
  } catch (error) {
    serviceLogger.error("Export JSON route error:", error);
    next(error);
  }
});

// Transaction routes (authentication required) - Support both /api and /api/v1
app.use(`${apiPrefix}/transactions`, authenticate, async (req, res, next) => {
  try {
    await proxyRequest(TRANSACTION_SERVICE, req, res, "/transactions");
  } catch (error) {
    serviceLogger.error("Transaction route error:", error);
    next(error);
  }
});
app.use("/api/transactions", authenticate, async (req, res, next) => {
  try {
    await proxyRequest(TRANSACTION_SERVICE, req, res, "/transactions");
  } catch (error) {
    serviceLogger.error("Transaction route error:", error);
    next(error);
  }
});

// Recurring transactions routes (authentication required)
app.use("/api/recurring", authenticate, async (req, res, next) => {
  try {
    await proxyRequest(TRANSACTION_SERVICE, req, res, "/recurring");
  } catch (error) {
    serviceLogger.error("Recurring route error:", error);
    next(error);
  }
});

// Receipt routes (authentication required) - Support both /api and /api/v1
// Need special handling for file uploads
const receiptUpload = multer({ storage: multer.memoryStorage() });

// Helper function to proxy receipt requests (handles both JSON and multipart)
const proxyReceiptRequest = async (req, res, next) => {
  try {
    serviceLogger.info(`[Receipt Route] ${req.method} ${req.originalUrl}, path: ${req.path}, hasFiles: ${!!(req.files && req.files.length > 0)}`);

    // Only treat as multipart if files actually exist (not just based on content-type header)
    const hasFiles = req.files && req.files.length > 0;
    const isMultipart = hasFiles;

    if (isMultipart && hasFiles) {
      // For multipart, multer should have already parsed it
      // Now forward to transaction service
      let targetPath = "/receipts";
      if (req.path && req.path !== "/") {
        targetPath = `/receipts${  req.path}`;
      }

      const fullUrl = `${TRANSACTION_SERVICE}${targetPath}`;
      serviceLogger.info(`[Receipt Upload] Proxying ${req.method} ${req.originalUrl} -> ${fullUrl}`);

      // Reconstruct FormData for forwarding
      const formData = new FormDataLib();

      // Add files
      for (const file of req.files) {
        formData.append(file.fieldname || "image", file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });
      }

      // Add other form fields
      if (req.body && typeof req.body === "object") {
        for (const key in req.body) {
          if (req.body[key] !== undefined && req.body[key] !== null) {
            formData.append(key, req.body[key]);
          }
        }
      }

      const formHeaders = formData.getHeaders();
      const response = await axios({
        method: req.method,
        url: fullUrl,
        data: formData,
        headers: {
          "Authorization": req.headers.authorization || "",
          ...formHeaders,
        },
        validateStatus: () => true,
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      return res.status(response.status).json(response.data);
    } else {
      // For non-multipart, use regular proxy
      await proxyRequest(TRANSACTION_SERVICE, req, res, "/receipts");
    }
  } catch (error) {
    serviceLogger.error("[Receipt Route Error]:", error);
    serviceLogger.error("Error details:", error.message);
    if (error.response) {
      serviceLogger.error("Response status:", error.response.status);
      serviceLogger.error("Response data:", error.response.data);
    }
    next(error);
  }
};

// Receipt routes with multer middleware for file uploads
app.use(`${apiPrefix}/receipts`, authenticate, receiptUpload.any(), proxyReceiptRequest);
app.use("/api/receipts", authenticate, receiptUpload.any(), proxyReceiptRequest);

// Reports routes (authentication required)
app.use("/api/reports", authenticate, async (req, res, next) => {
  try {
    await proxyRequest(TRANSACTION_SERVICE, req, res, "/reports");
  } catch (error) {
    serviceLogger.error("Report route error:", error);
    next(error);
  }
});

// Static file routes for receipts (authentication required)
app.use("/uploads", authenticate, async (req, res, next) => {
  try {
    await proxyStaticFile(TRANSACTION_SERVICE, req, res, "/uploads");
  } catch (error) {
    serviceLogger.error("Upload route error:", error);
    next(error);
  }
});

// ML routes (authentication required) - Support both /api/ml and /api/v1/ml
// Use a custom proxy function with extended timeout for ML routes
const proxyMLRequest = async (req, res, next) => {
  try {
    // Express strips the matched prefix from req.path
    // For /api/v1/ml/cashflow/forecast, after matching /api/v1/ml, req.path becomes /cashflow/forecast
    let targetPath = req.path;

    // Debug logging to help troubleshoot
    serviceLogger.info(`[ML Route] originalUrl: ${req.originalUrl}, path: ${req.path}, baseUrl: ${req.baseUrl}, url: ${req.url}`);

    // If path is empty or just "/", extract from originalUrl
    if (!targetPath || targetPath === "/") {
      // Extract the path after /api/v1/ml or /api/ml
      const match = req.originalUrl.match(/\/api\/(?:v\d+\/)?ml(\/.*)?$/);
      if (match && match[1]) {
        targetPath = match[1];
      } else {
        targetPath = "/";
      }
    }

    // Ensure path starts with /
    if (!targetPath.startsWith("/")) {
      targetPath = `/${  targetPath}`;
    }

    // Build query string if needed
    const queryString = req.query && Object.keys(req.query).length > 0
      ? `?${new URLSearchParams(req.query).toString()}`
      : "";

    const fullUrl = `${ML_SERVICE}${targetPath}${queryString}`;

    serviceLogger.info(`[ML Proxy] ${req.method} ${req.originalUrl} -> ${fullUrl} (req.path: ${req.path}, targetPath: ${targetPath})`);

    // Increase timeout for ML routes (especially cashflow forecast which can take longer)
    const timeout = req.originalUrl.includes("/cashflow/forecast") ? 120000 : 60000; // 2 minutes for forecast, 1 minute for other ML routes

    let response;
    try {
      response = await axios({
        method: req.method,
        url: fullUrl,
        data: req.body,
        headers: {
          "Content-Type": "application/json",
          "Authorization": req.headers.authorization || "",
        },
        validateStatus: () => true,
        timeout,
      });

      serviceLogger.info(`[ML Response] Status: ${response.status} for ${req.originalUrl}`);

      // Forward the response status and data
      if (!res.headersSent) {
        return res.status(response.status).json(response.data);
      }
    } catch (axiosError) {
      // Handle axios-specific errors
      if (axiosError.code === "ECONNREFUSED") {
        serviceLogger.error(`[ML Service] Connection refused to ${fullUrl}. Is the ML service running?`);
        if (!res.headersSent) {
          return sendError(res, 503, "ML service is unavailable. Please try again later.", "SERVICE_UNAVAILABLE");
        }
      } else if (axiosError.code === "ETIMEDOUT" || axiosError.message?.includes("timeout")) {
        serviceLogger.error(`[ML Service] Request timeout after ${timeout}ms for ${fullUrl}`);
        if (!res.headersSent) {
          return sendError(res, 504, "Request timeout. The ML service took too long to respond.", "TIMEOUT");
        }
      } else if (axiosError.response) {
        // Service responded with an error status
        serviceLogger.error(`[ML Service] Error response ${axiosError.response.status} from ${fullUrl}:`, axiosError.response.data);
        if (!res.headersSent) {
          return res.status(axiosError.response.status).json(axiosError.response.data);
        }
      } else {
        // Other axios errors
        serviceLogger.error(`[ML Service] Axios error for ${fullUrl}:`, {
          message: axiosError.message,
          code: axiosError.code,
          stack: axiosError.stack,
        });
        if (!res.headersSent) {
          return sendInternalError(res, `ML service error: ${axiosError.message}`);
        }
      }
      return;
    }
  } catch (error) {
    serviceLogger.error("[ML Route Error]:", error);
    serviceLogger.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    if (error.response) {
      serviceLogger.error("Response status:", error.response.status);
      serviceLogger.error("Response data:", error.response.data);
    }

    if (!res.headersSent) {
      return sendInternalError(res, error.message || "Internal server error");
    } else {
      serviceLogger.error("Cannot send error response - headers already sent");
    }
  }
};

// ML routes must be registered before the 404 handler
// Use explicit path matching to ensure routes are matched correctly
// Test route to verify matching works
app.use(`${apiPrefix}/ml`, (req, res, next) => {
  serviceLogger.info(`[ML Route Test] Matched ${apiPrefix}/ml for ${req.originalUrl}, path: ${req.path}`);
  next();
}, authenticate, proxyMLRequest);

app.use("/api/ml", (req, res, next) => {
  serviceLogger.info(`[ML Route Test] Matched /api/ml for ${req.originalUrl}, path: ${req.path}`);
  next();
}, authenticate, proxyMLRequest);

// Account routes (authentication required) - Support both /api and /api/v1
app.use(`${apiPrefix}/accounts`, authenticate, async (req, res, next) => {
  try {
    await proxyRequest(ACCOUNT_SERVICE, req, res, "/accounts");
  } catch (error) {
    serviceLogger.error("Account route error:", error);
    next(error);
  }
});
app.use("/api/accounts", authenticate, async (req, res, next) => {
  try {
    await proxyRequest(ACCOUNT_SERVICE, req, res, "/accounts");
  } catch (error) {
    serviceLogger.error("Account route error:", error);
    next(error);
  }
});

// Budget routes (authentication required) - Support both /api and /api/v1
app.use(`${apiPrefix}/budgets`, authenticate, async (req, res, next) => {
  try {
    await proxyRequest(BUDGET_SERVICE, req, res, "/budgets");
  } catch (error) {
    serviceLogger.error("Budget route error:", error);
    next(error);
  }
});
app.use("/api/budgets", authenticate, async (req, res, next) => {
  try {
    await proxyRequest(BUDGET_SERVICE, req, res, "/budgets");
  } catch (error) {
    serviceLogger.error("Budget route error:", error);
    next(error);
  }
});

// Goal routes (authentication required) - Support both /api and /api/v1
app.use(`${apiPrefix}/goals`, authenticate, async (req, res, next) => {
  try {
    await proxyRequest(GOAL_SERVICE, req, res, "/goals");
  } catch (error) {
    serviceLogger.error("Goal route error:", error);
    next(error);
  }
});
app.use("/api/goals", authenticate, async (req, res, next) => {
  try {
    await proxyRequest(GOAL_SERVICE, req, res, "/goals");
  } catch (error) {
    serviceLogger.error("Goal route error:", error);
    next(error);
  }
});

// 404 handler for unmatched routes
app.use((req, res) => {
  serviceLogger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found", path: req.originalUrl });
});

// Start server
app.listen(PORT, () => {
  serviceLogger.info(`API Gateway running on port ${PORT}`);
});

export default app;

