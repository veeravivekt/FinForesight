import express from "express";
import mongoose from "mongoose";
import Budget from "../../../shared/models/Budget.js";
import Transaction from "../../../shared/models/Transaction.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { setCache, getCache } from "../../../shared/utils/redis.js";
import { sendError, sendNotFoundError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";

const router = express.Router();
const logger = createServiceLogger("budget-service");
const budgetLimiter = createRateLimiter(100, 60);

// Get all budgets
router.get("/", budgetLimiter, async (req, res) => {
  try {
    // Validate userId is present
    if (!req.userId) {
      logger.error("Get budgets error: userId not found in request");
      return sendInternalError(res, "User authentication failed");
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      logger.error("MongoDB not connected. State:", mongoose.connection.readyState);
      return sendInternalError(res, "Database connection failed");
    }

    const { period, isActive } = req.query;
    
    // Convert userId to ObjectId
    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;
    
    const query = { userId };
    
    if (period) query.period = period;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const budgets = await Budget.find(query).sort({ createdAt: -1 });

    // Calculate actual spending for each budget
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        try {
          const startDate = new Date(budget.startDate);
          const endDate = budget.endDate || new Date();

          const expenses = await Transaction.find({
            userId: userId,
            category: budget.category,
            type: "expense",
            date: { $gte: startDate, $lte: endDate },
          });

          const actualSpending = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
          const remaining = budget.amount - actualSpending;
          const percentage = budget.amount > 0 ? (actualSpending / budget.amount) * 100 : 0;
          const isOverBudget = actualSpending > budget.amount;

          return {
            ...budget.toObject(),
            actualSpending,
            remaining,
            percentage: Math.round(percentage * 100) / 100,
            isOverBudget,
          };
        } catch (budgetError) {
          logger.error(`Error calculating spending for budget ${budget._id}:`, budgetError);
          // Return budget without spending calculation if there's an error
          return {
            ...budget.toObject(),
            actualSpending: 0,
            remaining: budget.amount,
            percentage: 0,
            isOverBudget: false,
          };
        }
      })
    );

    res.json({ budgets: budgetsWithSpending });
  } catch (error) {
    logger.error("Get budgets error:", error);
    logger.error("Error name:", error.name);
    logger.error("Error message:", error.message);
    logger.error("Error stack:", error.stack);
    logger.error("Request userId:", req.userId);
    
    // Send detailed error in development
    const errorMessage = process.env.NODE_ENV === "development"
      ? `${error.name}: ${error.message}`
      : "Internal server error";
    
    sendInternalError(res, errorMessage);
  }
});

// Get budget by ID
router.get("/:id", budgetLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const budget = await Budget.findOne({
      _id: req.params.id,
      userId: userId,
    });

    if (!budget) {
      return sendNotFoundError(res, "Budget");
    }

    // Calculate actual spending
    const startDate = new Date(budget.startDate);
    const endDate = budget.endDate || new Date();

    const expenses = await Transaction.find({
      userId: userId,
      category: budget.category,
      type: "expense",
      date: { $gte: startDate, $lte: endDate },
    });

    const actualSpending = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const remaining = budget.amount - actualSpending;
    const percentage = budget.amount > 0 ? (actualSpending / budget.amount) * 100 : 0;

    res.json({
      ...budget.toObject(),
      actualSpending,
      remaining,
      percentage: Math.round(percentage * 100) / 100,
      isOverBudget: actualSpending > budget.amount,
    });
  } catch (error) {
    logger.error("Get budget error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Create budget
router.post("/", budgetLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const { category, amount, period, startDate, endDate, alertThreshold } = req.body;

    if (!category || !amount || !startDate) {
      return sendValidationError(res, "Category, amount, and startDate are required");
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    // Check for existing active budget for this category
    const existingBudget = await Budget.findOne({
      userId: userId,
      category,
      isActive: true,
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null },
      ],
    });

    if (existingBudget) {
      return sendError(res, 400, "Active budget already exists for this category", "VALIDATION_ERROR");
    }

    const budget = new Budget({
      userId: userId,
      category,
      amount,
      period: period || "monthly",
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      alertThreshold: alertThreshold || 0.8,
    });

    await budget.save();

    res.status(201).json(budget);
  } catch (error) {
    logger.error("Create budget error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Update budget
router.put("/:id", budgetLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, userId: userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!budget) {
      return sendNotFoundError(res, "Budget");
    }

    res.json(budget);
  } catch (error) {
    logger.error("Update budget error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Delete budget
router.delete("/:id", budgetLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      userId: userId,
    });

    if (!budget) {
      return sendNotFoundError(res, "Budget");
    }

    res.json({ message: "Budget deleted successfully" });
  } catch (error) {
    logger.error("Delete budget error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Get budget summary
router.get("/summary/overview", budgetLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate) : new Date();

    const budgets = await Budget.find({
      userId: userId,
      isActive: true,
      startDate: { $lte: end },
      $or: [
        { endDate: { $gte: start } },
        { endDate: null },
      ],
    });

    const summary = await Promise.all(
      budgets.map(async (budget) => {
        const expenses = await Transaction.find({
          userId: userId,
          category: budget.category,
          type: "expense",
          date: { $gte: start, $lte: end },
        });

        const actualSpending = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const remaining = budget.amount - actualSpending;
        const percentage = budget.amount > 0 ? (actualSpending / budget.amount) * 100 : 0;

        return {
          category: budget.category,
          budgeted: budget.amount,
          spent: actualSpending,
          remaining,
          percentage: Math.round(percentage * 100) / 100,
          isOverBudget: actualSpending > budget.amount,
        };
      })
    );

    res.json({ summary });
  } catch (error) {
    logger.error("Get budget summary error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

export default router;

