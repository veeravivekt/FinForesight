import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import goalRoutes from "./routes/goal.js";
import { authenticate } from "../../shared/middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.GOAL_SERVICE_PORT || 3007;

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
app.use("/goals", authenticate, goalRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "goal-service" });
});

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Goal Service: MongoDB connected");
  } catch (error) {
    console.error("Goal Service: MongoDB connection error:", error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Goal Service running on port ${PORT}`);
  });
};

startServer();

export default app;

