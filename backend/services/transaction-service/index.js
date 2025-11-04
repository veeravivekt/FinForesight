import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import transactionRoutes from "./routes/transaction.js";
import recurringRoutes from "./routes/recurring.js";
import receiptRoutes from "./routes/receipt.js";
import reportsRoutes from "./routes/reports.js";
import { authenticate } from "../../shared/middleware/auth.js";
import { connectDB } from "../../shared/utils/database.js";
import { createServiceLogger } from "../../shared/utils/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.TRANSACTION_SERVICE_PORT || 3002;
const serviceLogger = createServiceLogger("transaction-service");

// Middleware
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true,
}));

// Serve uploaded receipt files
app.use("/uploads/receipts", express.static(path.join(process.cwd(), "uploads", "receipts")));

// Routes
app.use("/transactions", authenticate, transactionRoutes);
app.use("/recurring", authenticate, recurringRoutes);
app.use("/receipts", authenticate, receiptRoutes);
app.use("/reports", authenticate, reportsRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "transaction-service" });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      serviceLogger.info(`Transaction Service running on port ${PORT}`);
    });
  } catch (error) {
    serviceLogger.error("Failed to start Transaction Service:", error);
    process.exit(1);
  }
};

startServer();

export default app;

