import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import accountRoutes from "./routes/account.js";
import historyRoutes from "./routes/history.js";
import { authenticate } from "../../shared/middleware/auth.js";
import { connectDB } from "../../shared/utils/database.js";
import { createServiceLogger } from "../../shared/utils/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.ACCOUNT_SERVICE_PORT || 3005;
const serviceLogger = createServiceLogger("account-service");

// Middleware
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true,
}));

// Routes
app.use("/accounts", authenticate, accountRoutes);
app.use("/accounts", authenticate, historyRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "account-service" });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      serviceLogger.info(`Account Service running on port ${PORT}`);
    });
  } catch (error) {
    serviceLogger.error("Failed to start Account Service:", error);
    process.exit(1);
  }
};

startServer();

export default app;

