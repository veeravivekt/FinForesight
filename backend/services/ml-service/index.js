import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import Transaction from "../../shared/models/Transaction.js";
import { authenticate } from "../../shared/middleware/auth.js";
import { createRateLimiter } from "../../shared/middleware/rateLimiter.js";
import { connectDB } from "../../shared/utils/database.js";
import { createServiceLogger } from "../../shared/utils/logger.js";
import { sendError, sendInternalError } from "../../shared/utils/errorHandler.js";
import aiAssistantRoutes, { prePopulateCacheForAllUsers } from "./routes/ai-assistant.js";
import cashflowRoutes from "./routes/cashflow.js";

dotenv.config();

const app = express();
const PORT = process.env.ML_SERVICE_PORT || 3003;
const serviceLogger = createServiceLogger("ml-service");


// Middleware
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true,
}));

// Rate limiters
const mlLimiter = createRateLimiter(50, 60); // 50 requests per minute
const aiLimiter = createRateLimiter(20, 60); // 20 requests per minute for AI endpoints
const cashflowLimiter = createRateLimiter(10, 60); // 10 requests per minute for cash flow


// Categorize transaction endpoint
app.post("/categorize", authenticate, mlLimiter, async (req, res) => {
  try {
    const { description, amount, merchant } = req.body;

    if (!description) {
      return sendError(res, 400, "Description is required", "VALIDATION_ERROR");
    }

    // Get user's transaction history for context
    const userTransactions = await Transaction.find({
      userId: req.userId,
    }).sort({ date: -1 }).limit(100);

    // Use pattern-based categorization (can be enhanced with ML model)
    const categoryPatterns = {
      Food: ["restaurant", "cafe", "food", "grocery", "supermarket", "mcdonald", "starbucks", "pizza", "dining", "eat"],
      Transport: ["uber", "lyft", "taxi", "gas", "fuel", "parking", "metro", "bus", "transit", "ride"],
      Shopping: ["amazon", "target", "walmart", "store", "shop", "retail", "mall", "purchase"],
      Bills: ["electric", "water", "internet", "phone", "utility", "bill", "payment", "service"],
      Entertainment: ["movie", "cinema", "netflix", "spotify", "theater", "concert", "ticket", "game"],
      Healthcare: ["pharmacy", "drug", "hospital", "doctor", "medical", "clinic", "cvs", "walgreens", "health"],
      Education: ["school", "university", "course", "tuition", "bookstore", "education", "learning"],
      Travel: ["hotel", "flight", "airline", "airbnb", "travel", "booking", "trip", "vacation"],
    };

    let suggestedCategory = "Other";
    let confidence = 0;

    const lowerDescription = description.toLowerCase();
    const lowerMerchant = merchant ? merchant.toLowerCase() : "";

    // Pattern matching
    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      for (const pattern of patterns) {
        if (lowerDescription.includes(pattern) || lowerMerchant.includes(pattern)) {
          suggestedCategory = category;
          confidence = 0.8;
          break;
        }
      }
      if (confidence > 0) {break;}
    }

    // If no pattern match, check user's history
    if (confidence === 0 && userTransactions.length > 0) {
      const similarTransactions = userTransactions.filter(
        (t) => {
          const tDesc = t.description.toLowerCase();
          const firstWord = lowerDescription.split(" ")[0];
          return tDesc.includes(firstWord) || firstWord.length > 3 && tDesc.includes(firstWord.substring(0, 3));
        },
      );

      if (similarTransactions.length > 0) {
        const categoryCounts = {};
        similarTransactions.forEach((t) => {
          categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        });

        const mostCommonCategory = Object.keys(categoryCounts).reduce((a, b) =>
          categoryCounts[a] > categoryCounts[b] ? a : b,
        );

        suggestedCategory = mostCommonCategory;
        confidence = Math.min(categoryCounts[mostCommonCategory] / similarTransactions.length, 0.9);
      }
    }

    // Amount-based heuristics (optional)
    if (confidence < 0.5 && amount) {
      if (amount > 1000 && suggestedCategory === "Other") {
        // Large amounts might be bills or travel
        suggestedCategory = amount > 5000 ? "Travel" : "Bills";
        confidence = 0.6;
      }
    }

    res.json({
      category: suggestedCategory,
      confidence: Math.round(confidence * 100) / 100,
      method: confidence > 0.7 ? "pattern_match" : confidence > 0.4 ? "history_based" : "heuristic",
    });
  } catch (error) {
    serviceLogger.error("Categorization error:", error);
    sendInternalError(res);
  }
});


// AI Assistant routes
app.use("/ai", authenticate, aiLimiter, aiAssistantRoutes);

// Cash Flow routes
app.use("/cashflow", authenticate, cashflowLimiter, cashflowRoutes);


// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "ml-service" });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();

    // Pre-populate cache with default answers for all users (non-blocking)
    prePopulateCacheForAllUsers().catch(err => {
      serviceLogger.warn("Cache pre-population failed (non-critical):", err.message);
    });

    app.listen(PORT, () => {
      serviceLogger.info(`ML Service running on port ${PORT}`);
    });
  } catch (error) {
    serviceLogger.error("Failed to start ML Service:", error);
    process.exit(1);
  }
};

startServer();

export default app;

