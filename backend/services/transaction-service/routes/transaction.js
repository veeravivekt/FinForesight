import express from "express";
import mongoose from "mongoose";
import Transaction from "../../../shared/models/Transaction.js";
import { validateTransaction } from "../../../shared/utils/validation.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { setCache, getCache } from "../../../shared/utils/redis.js";

const router = express.Router();

// Rate limiter
const transactionLimiter = createRateLimiter(100, 60); // 100 requests per minute

// Get all transactions with pagination
router.get("/", transactionLimiter, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const type = req.query.type;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Build query
    const query = { userId: req.userId };
    const accountId = req.query.accountId;
    if (accountId) query.accountId = accountId;
    if (category) query.category = category;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Check cache
    const cacheKey = `transactions:${req.userId}:${page}:${JSON.stringify(query)}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

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

    // Cache for 1 minute
    await setCache(cacheKey, result, 60);

    res.json(result);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get transaction by ID
router.get("/:id", transactionLimiter, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(transaction);
  } catch (error) {
    console.error("Get transaction error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create transaction
router.post("/", transactionLimiter, async (req, res) => {
  try {
    const validation = validateTransaction(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ errors: validation.errors });
    }

    // Verify account belongs to user
    const Account = (await import("../../../shared/models/Account.js")).default;
    const account = await Account.findOne({
      _id: req.body.accountId,
      userId: req.userId,
    });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const transaction = new Transaction({
      ...req.body,
      userId: req.userId,
      accountId: req.body.accountId,
    });

    await transaction.save();

    // Update account balance if needed
    if (req.body.type === "income") {
      account.balance = (account.balance || 0) + req.body.amount;
    } else if (req.body.type === "expense") {
      account.balance = (account.balance || 0) - req.body.amount;
    }
    await account.save();

    // Invalidate cache
    // Note: Cache invalidation pattern matching not implemented in simple Redis
    // In production, use Redis KEYS or maintain a cache key list

    res.status(201).json(transaction);
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update transaction
router.put("/:id", transactionLimiter, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Invalidate cache
      // Note: Cache invalidation pattern matching not implemented in simple Redis
      // In production, use Redis KEYS or maintain a cache key list

    res.json(transaction);
  } catch (error) {
    console.error("Update transaction error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete transaction
router.delete("/:id", transactionLimiter, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Invalidate cache
      // Note: Cache invalidation pattern matching not implemented in simple Redis
      // In production, use Redis KEYS or maintain a cache key list

    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({ error: "Internal server error" });
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
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

