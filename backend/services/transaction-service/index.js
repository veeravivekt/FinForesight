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
import bulkRoutes from "./routes/bulk.js";
import templateRoutes from "./routes/templates.js";
import { authenticate } from "../../shared/middleware/auth.js";
import { connectDB } from "../../shared/utils/database.js";
import { createServiceLogger } from "../../shared/utils/logger.js";
import { startRecurringTransactionsCron } from "./cron/recurringTransactions.js";

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

// Serve uploaded receipt files with authentication
app.use("/uploads/receipts", authenticate, async (req, res, next) => {
  // Verify user owns the receipt before serving
  try {
    const Receipt = (await import("../../shared/models/Receipt.js")).default;
    const filename = req.path.split("/").pop();
    
    if (!filename) {
      return res.status(404).json({ error: "File not found" });
    }

    // Find receipt by imageKey
    const receipt = await Receipt.findOne({
      imageKey: filename,
      userId: req.userId,
    });

    if (!receipt) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Serve the file
    const filePath = path.join(process.cwd(), "uploads", "receipts", filename);
    res.sendFile(filePath, (err) => {
      if (err) {
        serviceLogger.error("Error serving receipt file:", err);
        if (!res.headersSent) {
          res.status(404).json({ error: "File not found" });
        }
      }
    });
  } catch (error) {
    serviceLogger.error("Error in receipt file serving:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Routes
app.use("/transactions", authenticate, transactionRoutes);
app.use("/transactions/bulk", authenticate, bulkRoutes);
app.use("/transactions/templates", authenticate, templateRoutes);
app.use("/recurring", authenticate, recurringRoutes);
app.use("/receipts", authenticate, receiptRoutes);
app.use("/reports", authenticate, reportsRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "transaction-service" });
});

// Error handling middleware
app.use((error, req, res, next) => {
  serviceLogger.error("Unhandled error:", error);
  serviceLogger.error("Error stack:", error.stack);
  
  const statusCode = error.statusCode || 500;
  const message = process.env.NODE_ENV === "development"
    ? error.message || "Internal server error"
    : "Internal server error";
  
  res.status(statusCode).json({
    error: message,
    code: "INTERNAL_ERROR",
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      serviceLogger.info(`Transaction Service running on port ${PORT}`);
      
      // Start recurring transactions cron job
      startRecurringTransactionsCron();
    });
  } catch (error) {
    serviceLogger.error("Failed to start Transaction Service:", error);
    process.exit(1);
  }
};

startServer();

export default app;

