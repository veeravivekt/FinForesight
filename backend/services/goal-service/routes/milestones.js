import express from "express";
import Goal from "../../../shared/models/Goal.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { sendError, sendNotFoundError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";
import { emitGoalEvent } from "../../../shared/utils/websocket.js";

const router = express.Router();
const logger = createServiceLogger("goal-service");
const milestoneLimiter = createRateLimiter(100, 60);

/**
 * Add milestone to goal
 * POST /goals/:id/milestones
 */
router.post("/:id/milestones", milestoneLimiter, async (req, res) => {
  try {
    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!goal) {
      return sendNotFoundError(res, "Goal");
    }

    const { percentage, amount, note } = req.body;

    if (percentage === undefined || amount === undefined) {
      return sendValidationError(res, "Percentage and amount are required");
    }

    if (percentage < 0 || percentage > 100) {
      return sendValidationError(res, "Percentage must be between 0 and 100");
    }

    // Check if milestone already exists
    const existingMilestone = goal.milestones?.find((m) => m.percentage === percentage);
    if (existingMilestone) {
      return sendError(res, 400, "Milestone with this percentage already exists", "VALIDATION_ERROR");
    }

    const milestones = goal.milestones || [];
    milestones.push({
      percentage,
      amount,
      note: note || "",
    });

    // Sort milestones by percentage
    milestones.sort((a, b) => a.percentage - b.percentage);

    goal.milestones = milestones;
    goal.checkMilestones(); // Check if any milestones should be marked as achieved
    await goal.save();

    res.status(201).json({
      message: "Milestone added successfully",
      goal,
    });
  } catch (error) {
    logger.error("Add milestone error:", error);
    sendInternalError(res);
  }
});

/**
 * Update milestone
 * PUT /goals/:id/milestones/:milestoneId
 */
router.put("/:id/milestones/:milestoneId", milestoneLimiter, async (req, res) => {
  try {
    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!goal) {
      return sendNotFoundError(res, "Goal");
    }

    const milestoneIndex = goal.milestones?.findIndex(
      (m) => m._id?.toString() === req.params.milestoneId
    );

    if (milestoneIndex === -1 || milestoneIndex === undefined) {
      return sendNotFoundError(res, "Milestone");
    }

    // Preserve achievedAt if milestone was already achieved
    const existingMilestone = goal.milestones[milestoneIndex];
    const achievedAt = existingMilestone.achievedAt;

    Object.assign(goal.milestones[milestoneIndex], req.body);
    
    // Restore achievedAt if it was set
    if (achievedAt && !req.body.achievedAt) {
      goal.milestones[milestoneIndex].achievedAt = achievedAt;
    }

    goal.checkMilestones();
    await goal.save();

    res.json({
      message: "Milestone updated successfully",
      goal,
    });
  } catch (error) {
    logger.error("Update milestone error:", error);
    sendInternalError(res);
  }
});

/**
 * Delete milestone
 * DELETE /goals/:id/milestones/:milestoneId
 */
router.delete("/:id/milestones/:milestoneId", milestoneLimiter, async (req, res) => {
  try {
    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!goal) {
      return sendNotFoundError(res, "Goal");
    }

    goal.milestones = goal.milestones?.filter(
      (m) => m._id?.toString() !== req.params.milestoneId
    ) || [];

    await goal.save();

    res.json({
      message: "Milestone deleted successfully",
      goal,
    });
  } catch (error) {
    logger.error("Delete milestone error:", error);
    sendInternalError(res);
  }
});

export default router;

