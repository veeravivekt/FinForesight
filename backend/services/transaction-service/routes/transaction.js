import express from "express";
import mongoose from "mongoose";
import Transaction from "../../../shared/models/Transaction.js";
import Account from "../../../shared/models/Account.js";
import Goal from "../../../shared/models/Goal.js";
import Receipt from "../../../shared/models/Receipt.js";
import { validateTransaction } from "../../../shared/utils/validation.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { setCache, getCache, invalidatePattern } from "../../../shared/utils/redis.js";
import { sendError, sendNotFoundError, sendValidationError, sendInternalError, sendUserFriendlyError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";
import { checkBudgetAlerts } from "../../../shared/utils/budgetAlerts.js";
import { emitTransactionEvent } from "../../../shared/utils/websocket.js";
import axios from "axios";

const router = express.Router();
const logger = createServiceLogger("transaction-service");

// Rate limiter
const transactionLimiter = createRateLimiter(100, 60); // 100 requests per minute

// Get all transactions with pagination
router.get("/", transactionLimiter, async (req, res) => {
  try {
    // Validate userId is present
    if (!req.userId) {
      logger.error("Get transactions error: userId not found in request");
      return sendInternalError(res, "User authentication failed");
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      logger.error("MongoDB not connected. State:", mongoose.connection.readyState);
      return sendInternalError(res, "Database connection failed");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const {category} = req.query;
    const {type} = req.query;
    const {startDate} = req.query;
    const {endDate} = req.query;
    const {minAmount} = req.query;
    const {maxAmount} = req.query;
    const {search} = req.query; // Text search in description
    const {tags} = req.query; // Comma-separated tags
    const {merchant} = req.query;
    const {isRecurring} = req.query;

    // Build query - ensure userId is ObjectId
    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    const query = { userId };
    const {accountId} = req.query;
    if (accountId) {
      query.accountId = new mongoose.Types.ObjectId(accountId);
    }
    if (category) {query.category = category;}
    if (type) {query.type = type;}
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {query.date.$gte = new Date(startDate);}
      if (endDate) {query.date.$lte = new Date(endDate);}
    }
    if (minAmount !== undefined) {
      query.amount = query.amount || {};
      query.amount.$gte = parseFloat(minAmount);
    }
    if (maxAmount !== undefined) {
      query.amount = query.amount || {};
      query.amount.$lte = parseFloat(maxAmount);
    }
    if (search) {
      query.description = { $regex: search, $options: "i" };
    }
    if (tags) {
      const tagArray = tags.split(",").map((t) => t.trim());
      query.tags = { $in: tagArray };
    }
    if (merchant) {
      query["merchant.name"] = { $regex: merchant, $options: "i" };
    }
    if (isRecurring !== undefined) {
      query.isRecurring = isRecurring === "true";
    }

    // Check cache (wrap in try-catch to handle Redis errors gracefully)
    let cached = null;
    try {
      const cacheKey = `transactions:${req.userId}:${page}:${JSON.stringify(query)}`;
      cached = await getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    } catch (cacheError) {
      logger.warn("Cache read error (continuing without cache):", cacheError.message);
      // Continue without cache if Redis fails
    }

    // Query transactions with populate
    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate("accountId", "name type")
      .populate("toAccountId", "name")
      .populate("goalId", "name")
      .populate("receiptId");

    const total = await Transaction.countDocuments(query);

    const result = {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    // Cache for 1 minute (wrap in try-catch to handle Redis errors gracefully)
    try {
      const cacheKey = `transactions:${req.userId}:${page}:${JSON.stringify(query)}`;
      await setCache(cacheKey, result, 60);
    } catch (cacheError) {
      logger.warn("Cache write error (continuing without cache):", cacheError.message);
      // Continue without caching if Redis fails
    }

    res.json(result);
  } catch (error) {
    logger.error("Get transactions error:", error);
    logger.error("Error name:", error.name);
    logger.error("Error message:", error.message);
    logger.error("Error stack:", error.stack);
    logger.error("Request userId:", req.userId);
    logger.error("Request query:", req.query);

    // Send detailed error in development
    const errorMessage = process.env.NODE_ENV === "development"
      ? `${error.name}: ${error.message}`
      : "Internal server error";

    sendInternalError(res, errorMessage);
  }
});

// Get transaction by ID
router.get("/:id", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId,
    });

    if (!transaction) {
      return sendNotFoundError(res, "Transaction");
    }

    res.json(transaction);
  } catch (error) {
    logger.error("Get transaction error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Create transaction
router.post("/", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const validation = validateTransaction(req.body);
    if (!validation.isValid) {
      return sendValidationError(res, validation.errors);
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    // Verify account belongs to user
    const account = await Account.findOne({
      _id: req.body.accountId,
      userId,
    });

    if (!account) {
      return sendNotFoundError(res, "Account");
    }

    // Auto-categorize if category not provided
    let {category} = req.body;
    let autoCategorized = false;
    let categorizationConfidence = 0;

    if (!category && req.body.description) {
      const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:3003";
      const AUTO_CATEGORIZE_ENABLED = process.env.AUTO_CATEGORIZE_ENABLED !== "false";

      if (AUTO_CATEGORIZE_ENABLED) {
        try {
          const categorizeResponse = await axios.post(
            `${ML_SERVICE_URL}/categorize`,
            {
              description: req.body.description,
              amount: req.body.amount,
              merchant: req.body.merchant,
            },
            {
              headers: {
                Authorization: req.headers.authorization || "",
              },
              timeout: 3000,
            },
          );

          if (categorizeResponse.data.category) {
            category = categorizeResponse.data.category;
            autoCategorized = true;
            categorizationConfidence = categorizeResponse.data.confidence || 0;
          }
        } catch (error) {
          logger.warn("Auto-categorization failed, using default:", error.message);
          category = category || "Other";
        }
      } else {
        category = category || "Other";
      }
    }

    const transaction = new Transaction({
      ...req.body,
      category: category || req.body.category || "Other",
      userId,
      accountId: req.body.accountId,
      autoCategorized,
      categorizationConfidence,
    });

    await transaction.save();

    // Emit WebSocket event for transaction creation
    emitTransactionEvent(userId.toString(), "created", transaction).catch((error) => {
      logger.warn("Failed to emit transaction created event:", error);
    });

    // Update account balance if needed
    if (req.body.type === "income") {
      account.balance = (account.balance || 0) + req.body.amount;
    } else if (req.body.type === "expense") {
      account.balance = (account.balance || 0) - req.body.amount;
    }
    await account.save();

    // Check budget alerts (async, don't wait for completion)
    if (req.body.type === "expense" && req.body.category) {
      checkBudgetAlerts(
        userId.toString(),
        req.body.category,
        req.body.amount,
        req.body.date ? new Date(req.body.date) : new Date(),
      ).catch((error) => {
        logger.warn("Budget alert check failed:", error);
      });
    }


    // Invalidate cache for this user's transactions
    invalidatePattern(`transactions:${userId.toString()}:*`).catch((error) => {
      logger.warn("Cache invalidation failed:", error);
    });
    // Also invalidate stats cache
    invalidatePattern(`stats:${userId.toString()}:*`).catch((error) => {
      logger.warn("Stats cache invalidation failed:", error);
    });

    res.status(201).json(transaction);
  } catch (error) {
    logger.error("Create transaction error:", error);
    logger.error("Error details:", error.message);
    sendUserFriendlyError(res, error);
  }
});

// Update transaction
router.put("/:id", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true, runValidators: true },
    );

    if (!transaction) {
      return sendNotFoundError(res, "Transaction");
    }

    // Emit WebSocket event for transaction update
    emitTransactionEvent(userId.toString(), "updated", transaction).catch((error) => {
      logger.warn("Failed to emit transaction updated event:", error);
    });

    // Check budget alerts if transaction is an expense (async, don't wait for completion)
    if (transaction.type === "expense" && transaction.category) {
      checkBudgetAlerts(
        userId.toString(),
        transaction.category,
        transaction.amount,
        transaction.date || new Date(),
      ).catch((error) => {
        logger.warn("Budget alert check failed:", error);
      });
    }

    // Invalidate cache for this user's transactions
    invalidatePattern(`transactions:${userId.toString()}:*`).catch((error) => {
      logger.warn("Cache invalidation failed:", error);
    });
    // Also invalidate stats cache
    invalidatePattern(`stats:${userId.toString()}:*`).catch((error) => {
      logger.warn("Stats cache invalidation failed:", error);
    });

    res.json(transaction);
  } catch (error) {
    logger.error("Update transaction error:", error);
    logger.error("Error details:", error.message);
    sendUserFriendlyError(res, error);
  }
});

// Delete transaction
router.delete("/:id", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId,
    });

    if (!transaction) {
      return sendNotFoundError(res, "Transaction");
    }

    // Emit WebSocket event for transaction deletion
    emitTransactionEvent(userId.toString(), "deleted", transaction).catch((error) => {
      logger.warn("Failed to emit transaction deleted event:", error);
    });

    // Invalidate cache for this user's transactions
    invalidatePattern(`transactions:${userId.toString()}:*`).catch((error) => {
      logger.warn("Cache invalidation failed:", error);
    });
    // Also invalidate stats cache
    invalidatePattern(`stats:${userId.toString()}:*`).catch((error) => {
      logger.warn("Stats cache invalidation failed:", error);
    });

    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    logger.error("Delete transaction error:", error);
    logger.error("Error details:", error.message);
    sendUserFriendlyError(res, error);
  }
});

// Get statistics
router.get("/stats/summary", transactionLimiter, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const cacheKey = `stats:${req.userId}:${startDate}:${endDate}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
          transactionCount: { $sum: 1 },
          avgTransactionAmount: { $avg: "$amount" },
        },
      },
    ]);

    const categoryStats = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          date: { $gte: startDate, $lte: endDate },
          type: "expense",
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const result = {
      summary: stats[0] || {
        totalIncome: 0,
        totalExpense: 0,
        transactionCount: 0,
        avgTransactionAmount: 0,
      },
      categoryStats,
      period: { startDate, endDate },
    };

    // Cache for 5 minutes
    await setCache(cacheKey, result, 300);

    res.json(result);
  } catch (error) {
    logger.error("Get stats error:", error);
    sendInternalError(res);
  }
});

// Export transactions as JSON
router.get("/export/json", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const {category} = req.query;
    const {type} = req.query;

    // Build query
    const query = { userId };
    if (category) {query.category = category;}
    if (type) {query.type = type;}
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {query.date.$gte = startDate;}
      if (endDate) {query.date.$lte = endDate;}
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .populate("accountId", "name type")
      .populate("toAccountId", "name")
      .lean();

    // Format transactions for export
    const exportData = {
      exportedAt: new Date().toISOString(),
      dateRange: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
      },
      filters: {
        category: category || null,
        type: type || null,
      },
      totalTransactions: transactions.length,
      transactions: transactions.map((t) => ({
        id: t._id.toString(),
        date: t.date,
        type: t.type,
        description: t.description,
        category: t.category,
        amount: t.amount,
        account: t.accountId?.name || "N/A",
        accountType: t.accountId?.type || null,
        toAccount: t.toAccountId?.name || null,
        merchant: t.merchant || null,
        tags: t.tags || [],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    logger.error("Export JSON error:", error);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Export transactions as CSV
router.get("/export/csv", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const {category} = req.query;
    const {type} = req.query;

    // Build query
    const query = { userId };
    if (category) {query.category = category;}
    if (type) {query.type = type;}
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {query.date.$gte = startDate;}
      if (endDate) {query.date.$lte = endDate;}
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .populate("accountId", "name type")
      .populate("toAccountId", "name")
      .limit(10000); // Limit to prevent memory issues

    // Build CSV
    const headers = ["Date", "Type", "Description", "Category", "Amount", "Account", "To Account"];
    const rows = transactions.map((t) => {
      const date = new Date(t.date).toLocaleDateString();
      const accountName = t.accountId?.name || "N/A";
      const toAccountName = t.toAccountId?.name || "";
      return [
        date,
        t.type,
        t.description || "",
        t.category || "",
        t.amount.toFixed(2),
        accountName,
        toAccountName,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    logger.error("Export CSV error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

export default router;

