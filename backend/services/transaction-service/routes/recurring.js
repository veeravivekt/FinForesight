import express from "express";
import RecurringTransaction from "../../../shared/models/RecurringTransaction.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { sendNotFoundError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";

const router = express.Router();
const logger = createServiceLogger("transaction-service");
const recurringLimiter = createRateLimiter(100, 60);

// Get all recurring transactions
router.get("/", recurringLimiter, async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = { userId: req.userId };

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const recurringTransactions = await RecurringTransaction.find(query)
      .populate("accountId", "name type")
      .sort({ nextDueDate: 1 });

    res.json({ recurringTransactions });
  } catch (error) {
    logger.error("Get recurring transactions error:", error);
    sendInternalError(res);
  }
});

// Get recurring transaction by ID
router.get("/:id", recurringLimiter, async (req, res) => {
  try {
    const recurringTransaction = await RecurringTransaction.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).populate("accountId", "name type");

    if (!recurringTransaction) {
      return sendNotFoundError(res, "Recurring transaction");
    }

    res.json(recurringTransaction);
  } catch (error) {
    logger.error("Get recurring transaction error:", error);
    sendInternalError(res);
  }
});

// Create recurring transaction
router.post("/", recurringLimiter, async (req, res) => {
  try {
    const {
      accountId,
      description,
      amount,
      category,
      type,
      frequency,
      dayOfMonth,
      dayOfWeek,
      nextDueDate,
      reminderDays,
      autoCreate,
    } = req.body;

    if (!accountId || !description || !amount || !category || !type || !nextDueDate) {
      return sendValidationError(res, "Required fields are missing");
    }

    // Verify account belongs to user
    const Account = (await import("../../../shared/models/Account.js")).default;
    const account = await Account.findOne({
      _id: accountId,
      userId: req.userId,
    });

    if (!account) {
      return sendNotFoundError(res, "Account");
    }

    const recurringTransaction = new RecurringTransaction({
      userId: req.userId,
      accountId,
      description,
      amount,
      category,
      type,
      frequency: frequency || "monthly",
      dayOfMonth,
      dayOfWeek,
      nextDueDate: new Date(nextDueDate),
      reminderDays: reminderDays || 3,
      autoCreate: autoCreate !== undefined ? autoCreate : true,
      isActive: true,
    });

    await recurringTransaction.save();

    res.status(201).json(recurringTransaction);
  } catch (error) {
    logger.error("Create recurring transaction error:", error);
    sendInternalError(res);
  }
});

// Update recurring transaction
router.put("/:id", recurringLimiter, async (req, res) => {
  try {
    const recurringTransaction = await RecurringTransaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true },
    );

    if (!recurringTransaction) {
      return sendNotFoundError(res, "Recurring transaction");
    }

    res.json(recurringTransaction);
  } catch (error) {
    logger.error("Update recurring transaction error:", error);
    sendInternalError(res);
  }
});

// Delete recurring transaction
router.delete("/:id", recurringLimiter, async (req, res) => {
  try {
    const recurringTransaction = await RecurringTransaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!recurringTransaction) {
      return sendNotFoundError(res, "Recurring transaction");
    }

    res.json({ message: "Recurring transaction deleted successfully" });
  } catch (error) {
    logger.error("Delete recurring transaction error:", error);
    sendInternalError(res);
  }
});

export default router;

