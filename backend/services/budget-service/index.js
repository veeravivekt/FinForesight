import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import budgetRoutes from "./routes/budget.js";
import { authenticate } from "../../shared/middleware/auth.js";
import { connectDB } from "../../shared/utils/database.js";
import { createServiceLogger } from "../../shared/utils/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.BUDGET_SERVICE_PORT || 3006;
const serviceLogger = createServiceLogger("budget-service");

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
app.use("/budgets", authenticate, budgetRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "budget-service" });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      serviceLogger.info(`Budget Service running on port ${PORT}`);
    });
  } catch (error) {
    serviceLogger.error("Failed to start Budget Service:", error);
    process.exit(1);
  }
};

startServer();

export default app;

