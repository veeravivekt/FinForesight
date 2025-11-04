import express from "express";
import Goal from "../../../shared/models/Goal.js";
import Transaction from "../../../shared/models/Transaction.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";

const router = express.Router();
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
    console.error("Get goals error:", error);
    res.status(500).json({ error: "Internal server error" });
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
      return res.status(404).json({ error: "Goal not found" });
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
    console.error("Get goal error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create goal
router.post("/", goalLimiter, async (req, res) => {
  try {
    const { name, description, targetAmount, targetDate, accountId, color } = req.body;

    if (!name || !targetAmount || !targetDate) {
      return res.status(400).json({ error: "Name, targetAmount, and targetDate are required" });
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
    console.error("Create goal error:", error);
    res.status(500).json({ error: "Internal server error" });
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
      return res.status(404).json({ error: "Goal not found" });
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
      { new: true, runValidators: true }
    );

    res.json(updatedGoal);
  } catch (error) {
    console.error("Update goal error:", error);
    res.status(500).json({ error: "Internal server error" });
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
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json({ message: "Goal deleted successfully" });
  } catch (error) {
    console.error("Delete goal error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add contribution to goal
router.post("/:id/contribute", goalLimiter, async (req, res) => {
  try {
    const { amount, transactionId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    if (goal.isCompleted) {
      return res.status(400).json({ error: "Goal is already completed" });
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
        { goalId: goal._id }
      );
    }

    const updatedGoal = await Goal.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updateData,
      { new: true }
    );

    res.json(updatedGoal);
  } catch (error) {
    console.error("Contribute to goal error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

