import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import transactionRoutes from "./routes/transaction.js";
import recurringRoutes from "./routes/recurring.js";
import receiptRoutes from "./routes/receipt.js";
import { authenticate } from "../../shared/middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.TRANSACTION_SERVICE_PORT || 3002;

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

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "transaction-service" });
});

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Transaction Service: MongoDB connected");
  } catch (error) {
    console.error("Transaction Service: MongoDB connection error:", error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Transaction Service running on port ${PORT}`);
  });
};

startServer();

export default app;

