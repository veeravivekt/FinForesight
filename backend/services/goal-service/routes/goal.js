import express from "express";
import Goal from "../../../shared/models/Goal.js";
import Transaction from "../../../shared/models/Transaction.js";
import Account from "../../../shared/models/Account.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { sendError, sendNotFoundError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";
import { emitGoalEvent } from "../../../shared/utils/websocket.js";

const router = express.Router();
const logger = createServiceLogger("goal-service");
const goalLimiter = createRateLimiter(100, 60);

// Get all goals
router.get("/", goalLimiter, async (req, res) => {
  try {
    const { isCompleted } = req.query;
    const query = { userId: req.userId };

    if (isCompleted !== undefined) {
      query.isCompleted = isCompleted === "true";
    }

    const goals = await Goal.find(query)
      .sort({ createdAt: -1 })
      .populate("accountId", "name");

    const goalsWithProgress = goals.map((goal) => {
      const progress = goal.getProgress();
      const daysRemaining = goal.getDaysRemaining();

      return {
        ...goal.toObject(),
        progress: Math.round(progress * 100) / 100,
        daysRemaining,
      };
    });

    res.json({ goals: goalsWithProgress });
  } catch (error) {
    logger.error("Get goals error:", error);
    sendInternalError(res);
  }
});

// Get goal by ID
router.get("/:id", goalLimiter, async (req, res) => {
  try {
    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).populate("accountId", "name");

    if (!goal) {
      return sendNotFoundError(res, "Goal");
    }

    // Get related transactions
    const transactions = await Transaction.find({
      goalId: goal._id,
    }).sort({ date: -1 }).limit(10);

    const progress = goal.getProgress();
    const daysRemaining = goal.getDaysRemaining();

    res.json({
      ...goal.toObject(),
      progress: Math.round(progress * 100) / 100,
      daysRemaining,
      recentTransactions: transactions,
    });
  } catch (error) {
    logger.error("Get goal error:", error);
    sendInternalError(res);
  }
});

// Create goal
router.post("/", goalLimiter, async (req, res) => {
  try {
    const { name, description, targetAmount, targetDate, accountId, color } = req.body;

    if (!name || !targetAmount || !targetDate) {
      return sendValidationError(res, "Name, targetAmount, and targetDate are required");
    }

    const goal = new Goal({
      userId: req.userId,
      name,
      description,
      targetAmount,
      targetDate: new Date(targetDate),
      accountId,
      currentAmount: 0,
      color: color || "#10b981",
    });

    await goal.save();

    res.status(201).json(goal);
  } catch (error) {
    logger.error("Create goal error:", error);
    sendInternalError(res);
  }
});

// Update goal
router.put("/:id", goalLimiter, async (req, res) => {
  try {
    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!goal) {
      return sendNotFoundError(res, "Goal");
    }

    // Check if goal should be marked as completed
    if (req.body.currentAmount !== undefined) {
      const newAmount = req.body.currentAmount;
      if (newAmount >= goal.targetAmount && !goal.isCompleted) {
        req.body.isCompleted = true;
        req.body.completedAt = new Date();
      }
    }

    const updatedGoal = await Goal.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true },
    );

    // Emit WebSocket event if goal was completed
    if (updatedGoal.isCompleted && !goal.isCompleted) {
      const progress = updatedGoal.getProgress() / 100; // Convert percentage to decimal
      emitGoalEvent(req.userId.toString(), "completed", {
        ...updatedGoal.toObject(),
        progress,
      }).catch((error) => {
        logger.warn("Failed to emit goal completed event:", error);
      });
    } else {
      const progress = updatedGoal.getProgress() / 100; // Convert percentage to decimal
      emitGoalEvent(req.userId.toString(), "updated", {
        ...updatedGoal.toObject(),
        progress,
      }).catch((error) => {
        logger.warn("Failed to emit goal updated event:", error);
      });
    }

    res.json(updatedGoal);
  } catch (error) {
    logger.error("Update goal error:", error);
    sendInternalError(res);
  }
});

// Delete goal
router.delete("/:id", goalLimiter, async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!goal) {
      return sendNotFoundError(res, "Goal");
    }

    res.json({ message: "Goal deleted successfully" });
  } catch (error) {
    logger.error("Delete goal error:", error);
    sendInternalError(res);
  }
});

// Add contribution to goal
router.post("/:id/contribute", goalLimiter, async (req, res) => {
  try {
    const { amount, transactionId } = req.body;

    if (!amount || amount <= 0) {
      return sendValidationError(res, "Valid amount is required");
    }

    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!goal) {
      return sendNotFoundError(res, "Goal");
    }

    if (goal.isCompleted) {
      return sendError(res, 400, "Goal is already completed", "VALIDATION_ERROR");
    }

    const newAmount = goal.currentAmount + amount;
    const updateData = { currentAmount: newAmount };

    if (newAmount >= goal.targetAmount) {
      updateData.isCompleted = true;
      updateData.completedAt = new Date();
    }

    // Link transaction to goal if provided
    if (transactionId) {
      await Transaction.findOneAndUpdate(
        { _id: transactionId, userId: req.userId },
        { goalId: goal._id },
      );
    }

    const updatedGoal = await Goal.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updateData,
      { new: true },
    );

    // Emit WebSocket event for goal completion
    if (updatedGoal.isCompleted && !goal.isCompleted) {
      const newProgress = updatedGoal.getProgress() / 100; // Convert percentage to decimal
      emitGoalEvent(req.userId.toString(), "completed", {
        ...updatedGoal.toObject(),
        progress: newProgress,
      }).catch((error) => {
        logger.warn("Failed to emit goal completed event:", error);
      });
    }

    res.json(updatedGoal);
  } catch (error) {
    logger.error("Contribute to goal error:", error);
    sendInternalError(res);
  }
});

export default router;

