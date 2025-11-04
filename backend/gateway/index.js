import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import { authenticate } from "../shared/middleware/auth.js";
import { createRateLimiter } from "../shared/middleware/rateLimiter.js";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

// Service URLs
const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || "http://localhost:3001";
const TRANSACTION_SERVICE = process.env.TRANSACTION_SERVICE_URL || "http://localhost:3002";
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:3003";
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3004";
const ACCOUNT_SERVICE = process.env.ACCOUNT_SERVICE_URL || "http://localhost:3005";
const BUDGET_SERVICE = process.env.BUDGET_SERVICE_URL || "http://localhost:3006";
const GOAL_SERVICE = process.env.GOAL_SERVICE_URL || "http://localhost:3007";

// Middleware
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true,
}));

// Rate limiter
const gatewayLimiter = createRateLimiter(200, 60); // 200 requests per minute per IP
app.use(gatewayLimiter);

// Proxy function for API requests (JSON responses)
const proxyRequest = async (serviceUrl, req, res, servicePathPrefix = "") => {
  try {
    // Express middleware strips the matched prefix from req.path
    // So /api/auth/login becomes /login in req.path
    // We need to prepend the service-specific prefix
    const targetPath = servicePathPrefix + req.path;
    
    console.log(`Proxying ${req.method} ${req.originalUrl} -> ${serviceUrl}${targetPath}`);
    
    const response = await axios({
      method: req.method,
      url: `${serviceUrl}${targetPath}`,
      data: req.body,
      headers: {
        ...req.headers,
        host: undefined,
        authorization: req.headers.authorization, // Forward auth header
      },
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Proxy error:", error.message);
    res.status(500).json({ error: "Service unavailable" });
  }
};

// Proxy function for static files (binary responses)
const proxyStaticFile = async (serviceUrl, req, res, servicePathPrefix = "") => {
  try {
    const targetPath = servicePathPrefix + req.path;
    
    console.log(`Proxying static file ${req.method} ${req.originalUrl} -> ${serviceUrl}${targetPath}`);
    
    const response = await axios({
      method: req.method,
      url: `${serviceUrl}${targetPath}`,
      headers: {
        ...req.headers,
        host: undefined,
        authorization: req.headers.authorization, // Forward auth header
      },
      responseType: 'arraybuffer', // Handle binary data
      validateStatus: () => true,
    });

    // Set appropriate headers for file serving
    res.set({
      'Content-Type': response.headers['content-type'] || 'application/octet-stream',
      'Content-Length': response.headers['content-length'],
    });
    
    res.status(response.status).send(Buffer.from(response.data));
  } catch (error) {
    console.error("Static file proxy error:", error.message);
    res.status(500).json({ error: "Service unavailable" });
  }
};

// Auth routes (no authentication required)
app.use("/api/auth", (req, res) => {
  proxyRequest(AUTH_SERVICE, req, res, "/auth");
});

// Transaction routes (authentication required)
app.use("/api/transactions", authenticate, (req, res) => {
  proxyRequest(TRANSACTION_SERVICE, req, res, "/transactions");
});

// Recurring transactions routes (authentication required)
app.use("/api/recurring", authenticate, (req, res) => {
  proxyRequest(TRANSACTION_SERVICE, req, res, "/recurring");
});

// Receipt routes (authentication required)
app.use("/api/receipts", authenticate, (req, res) => {
  proxyRequest(TRANSACTION_SERVICE, req, res, "/receipts");
});

// Static file routes for receipts (authentication required)
app.use("/uploads", authenticate, (req, res) => {
  proxyStaticFile(TRANSACTION_SERVICE, req, res, "/uploads");
});

// ML routes (authentication required)
app.use("/api/ml", authenticate, (req, res) => {
  proxyRequest(ML_SERVICE, req, res, "");
});

// Account routes (authentication required)
app.use("/api/accounts", authenticate, (req, res) => {
  proxyRequest(ACCOUNT_SERVICE, req, res, "/accounts");
});

// Budget routes (authentication required)
app.use("/api/budgets", authenticate, (req, res) => {
  proxyRequest(BUDGET_SERVICE, req, res, "/budgets");
});

// Goal routes (authentication required)
app.use("/api/goals", authenticate, (req, res) => {
  proxyRequest(GOAL_SERVICE, req, res, "/goals");
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

export default app;

