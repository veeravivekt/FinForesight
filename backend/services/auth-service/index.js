import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.js";
import { connectDB } from "../../shared/utils/database.js";
import logger, { createServiceLogger } from "../../shared/utils/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;
const serviceLogger = createServiceLogger("auth-service");

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
app.use("/auth", authRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "auth-service" });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      serviceLogger.info(`Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    serviceLogger.error("Failed to start Auth Service:", error);
    process.exit(1);
  }
};

startServer();

export default app;

