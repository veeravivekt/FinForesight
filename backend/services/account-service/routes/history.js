import express from "express";
import AccountBalanceHistory from "../../../shared/models/AccountBalanceHistory.js";
import Account from "../../../shared/models/Account.js";
import Transaction from "../../../shared/models/Transaction.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { sendError, sendNotFoundError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";

const router = express.Router();
const logger = createServiceLogger("account-service");
const historyLimiter = createRateLimiter(100, 60);

/**
 * Get account balance history
 * GET /accounts/:id/history
 */
router.get("/:id/history", historyLimiter, async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!account) {
      return sendNotFoundError(res, "Account");
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const limit = parseInt(req.query.limit) || 100;

    const query = {
      accountId: req.params.id,
      userId: req.userId,
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const history = await AccountBalanceHistory.find(query)
      .sort({ date: -1 })
      .limit(limit);

    res.json({ history });
  } catch (error) {
    logger.error("Get account history error:", error);
    sendInternalError(res);
  }
});

/**
 * Record account balance snapshot
 * POST /accounts/:id/history
 */
router.post("/:id/history", historyLimiter, async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!account) {
      return sendNotFoundError(res, "Account");
    }

    // Calculate current balance from transactions
    const transactions = await Transaction.find({ accountId: account._id });
    const balance = transactions.reduce((sum, t) => {
      if (t.type === "income") return sum + t.amount;
      if (t.type === "expense") return sum - t.amount;
      return sum;
    }, account.balance || 0);

    const historyEntry = new AccountBalanceHistory({
      accountId: req.params.id,
      userId: req.userId,
      balance,
      date: req.body.date || new Date(),
      note: req.body.note,
    });

    await historyEntry.save();

    res.status(201).json({
      message: "Balance history recorded",
      history: historyEntry,
    });
  } catch (error) {
    logger.error("Record account history error:", error);
    sendInternalError(res);
  }
});

/**
 * Get account balance trend (for charts)
 * GET /accounts/:id/trend
 */
router.get("/:id/trend", historyLimiter, async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!account) {
      return sendNotFoundError(res, "Account");
    }

    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get balance history
    const history = await AccountBalanceHistory.find({
      accountId: req.params.id,
      userId: req.userId,
      date: { $gte: startDate },
    })
      .sort({ date: 1 })
      .limit(1000);

    // If no history, calculate from transactions
    if (history.length === 0) {
      const transactions = await Transaction.find({
        accountId: req.params.id,
        date: { $gte: startDate },
      }).sort({ date: 1 });

      // Calculate running balance
      let runningBalance = account.balance || 0;
      const trend = transactions.map((t) => {
        if (t.type === "income") runningBalance += t.amount;
        if (t.type === "expense") runningBalance -= t.amount;
        return {
          date: t.date,
          balance: runningBalance,
        };
      });

      return res.json({ trend });
    }

    const trend = history.map((h) => ({
      date: h.date,
      balance: h.balance,
    }));

    res.json({ trend });
  } catch (error) {
    logger.error("Get account trend error:", error);
    sendInternalError(res);
  }
});

export default router;

