import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import { authenticate } from "../../shared/middleware/auth.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  },
});

const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3004;

// Middleware
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true,
}));

// WebSocket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error"));
  }
  // Token verification would go here
  // For now, we'll accept the token
  socket.userId = socket.handshake.auth.userId;
  next();
});

// WebSocket connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Join user's personal room
  socket.join(`user:${socket.userId}`);

  // Handle transaction events
  socket.on("transaction:create", (data) => {
    // Broadcast to user's room
    io.to(`user:${socket.userId}`).emit("transaction:created", data);
  });

  // Handle fraud alerts
  socket.on("fraud:alert", (data) => {
    io.to(`user:${socket.userId}`).emit("fraud:detected", data);
  });

  // Handle budget warnings
  socket.on("budget:warning", (data) => {
    io.to(`user:${socket.userId}`).emit("budget:threshold", data);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

// REST endpoint to emit notifications
app.post("/notify", authenticate, (req, res) => {
  const { userId, event, data } = req.body;

  if (!userId || !event) {
    return res.status(400).json({ error: "userId and event are required" });
  }

  io.to(`user:${userId}`).emit(event, data);
  res.json({ success: true });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "notification-service" });
});

server.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
});

export default app;

