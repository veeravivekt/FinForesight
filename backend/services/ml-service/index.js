import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import axios from "axios";
import { authenticate } from "../../shared/middleware/auth.js";
import { createRateLimiter } from "../../shared/middleware/rateLimiter.js";
import Transaction from "../../shared/models/Transaction.js";
import { connectDB } from "../../shared/utils/database.js";
import { createServiceLogger } from "../../shared/utils/logger.js";
import { sendError, sendInternalError } from "../../shared/utils/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.ML_SERVICE_PORT || 3003;
const serviceLogger = createServiceLogger("ml-service");

// Python ML Service URL (if running separately)
const PYTHON_ML_SERVICE = process.env.PYTHON_ML_SERVICE_URL || "http://localhost:5000";

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
const mlLimiter = createRateLimiter(50, 60); // 50 requests per minute

// Fraud detection endpoint
app.post("/fraud/detect", authenticate, mlLimiter, async (req, res) => {
  try {
    const { transaction } = req.body;

    if (!transaction) {
      return sendError(res, 400, "Transaction data is required", "VALIDATION_ERROR");
    }

    // Get user's transaction history for context
    const userTransactions = await Transaction.find({
      userId: req.userId,
    }).sort({ date: -1 }).limit(100);

    // Calculate features for fraud detection
    const features = calculateFraudFeatures(transaction, userTransactions);

    // Call Python ML service or use inline model
    try {
      const response = await axios.post(`${PYTHON_ML_SERVICE}/predict/fraud`, {
        features,
      });

      const fraudScore = response.data.fraud_score || 0.5;
      const isFraudulent = response.data.is_fraudulent || fraudScore > 0.7;

      res.json({
        fraudScore: Math.round(fraudScore * 100) / 100,
        isFraudulent,
        confidence: Math.abs(fraudScore - 0.5) * 2,
        features: Object.keys(features),
      });
    } catch (error) {
      // Fallback to simple rule-based detection if ML service unavailable
      serviceLogger.warn("ML service error, using fallback:", error);
      const fraudScore = simpleFraudDetection(transaction, userTransactions);
      const isFraudulent = fraudScore > 0.7;

      res.json({
        fraudScore: Math.round(fraudScore * 100) / 100,
        isFraudulent,
        confidence: Math.abs(fraudScore - 0.5) * 2,
        method: "fallback",
      });
    }
  } catch (error) {
    serviceLogger.error("Fraud detection error:", error);
    sendInternalError(res);
  }
});

// Spend prediction endpoint
app.post("/predict/spend", authenticate, mlLimiter, async (req, res) => {
  try {
    const { months = 1 } = req.body;

    // Get user's transaction history
    const transactions = await Transaction.find({
      userId: req.userId,
      type: "expense",
    }).sort({ date: -1 }).limit(1000);

    if (transactions.length < 10) {
      return sendError(res, 400, "Insufficient transaction history", "VALIDATION_ERROR");
    }

    try {
      // Call Python ML service
      const response = await axios.post(`${PYTHON_ML_SERVICE}/predict/spend`, {
        transactions: transactions.map(t => ({
          amount: t.amount,
          category: t.category,
          date: t.date,
        })),
        months,
      });

      res.json({
        predictions: response.data.predictions || [],
        accuracy: response.data.accuracy || 0.85,
      });
    } catch (error) {
      // Fallback to simple average-based prediction
      serviceLogger.warn("ML service error, using fallback:", error);
      const predictions = simpleSpendPrediction(transactions, months);

      res.json({
        predictions,
        accuracy: 0.75,
        method: "fallback",
      });
    }
  } catch (error) {
    serviceLogger.error("Spend prediction error:", error);
    sendInternalError(res);
  }
});

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

// Train model endpoint
app.post("/train", authenticate, async (req, res) => {
  try {
    // This would typically be an admin-only endpoint
    const response = await axios.post(`${PYTHON_ML_SERVICE}/train`, req.body);
    res.json(response.data);
  } catch (error) {
    serviceLogger.error("Model training error:", error);
    sendError(res, 500, "Training service unavailable", "SERVICE_UNAVAILABLE");
  }
});

// Helper functions
function calculateFraudFeatures(transaction, userTransactions) {
  const avgAmount = userTransactions.length > 0
    ? userTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / userTransactions.length
    : transaction.amount;

  const recentTransactions = userTransactions.slice(0, 10);
  const recentAmounts = recentTransactions.map(t => Math.abs(t.amount));
  const avgRecentAmount = recentAmounts.length > 0
    ? recentAmounts.reduce((a, b) => a + b, 0) / recentAmounts.length
    : transaction.amount;

  const amountDeviation = Math.abs(transaction.amount - avgAmount) / (avgAmount || 1);
  const recentDeviation = Math.abs(transaction.amount - avgRecentAmount) / (avgRecentAmount || 1);

  const sameCategoryRecent = recentTransactions.filter(
    t => t.category === transaction.category,
  ).length;

  return {
    amount: transaction.amount,
    amount_deviation: amountDeviation,
    recent_deviation: recentDeviation,
    is_large_amount: transaction.amount > avgAmount * 3 ? 1 : 0,
    is_unusual_category: sameCategoryRecent < 2 ? 1 : 0,
    time_of_day: new Date(transaction.date).getHours(),
    day_of_week: new Date(transaction.date).getDay(),
  };
}

function simpleFraudDetection(transaction, userTransactions) {
  const avgAmount = userTransactions.length > 0
    ? userTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / userTransactions.length
    : transaction.amount;

  let score = 0.5;

  // Large amount deviation
  if (transaction.amount > avgAmount * 5) {
    score += 0.3;
  } else if (transaction.amount > avgAmount * 2) {
    score += 0.15;
  }

  // Unusual time (midnight to 4 AM)
  const hour = new Date(transaction.date).getHours();
  if (hour >= 0 && hour < 4) {
    score += 0.1;
  }

  // Unusual category
  const sameCategoryRecent = userTransactions.slice(0, 10).filter(
    t => t.category === transaction.category,
  ).length;
  if (sameCategoryRecent < 2) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

function simpleSpendPrediction(transactions, months) {
  const monthlyTotals = {};
  const categoryTotals = {};

  transactions.forEach(t => {
    const month = new Date(t.date).toISOString().slice(0, 7);
    monthlyTotals[month] = (monthlyTotals[month] || 0) + t.amount;
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const monthlyValues = Object.values(monthlyTotals);
  const avgMonthly = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;

  const predictions = [];
  for (let i = 1; i <= months; i++) {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + i);
    predictions.push({
      month: futureDate.toISOString().slice(0, 7),
      predictedAmount: avgMonthly,
      categoryBreakdown: Object.keys(categoryTotals).map(cat => ({
        category: cat,
        amount: categoryTotals[cat] / Object.keys(categoryTotals).length,
      })),
    });
  }

  return predictions;
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "ml-service" });
});

// Start server
const startServer = async () => {
  try {
  await connectDB();
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

