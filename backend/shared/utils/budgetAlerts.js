import Budget from "../models/Budget.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import axios from "axios";
import { createServiceLogger } from "./logger.js";

const logger = createServiceLogger("budget-alerts");

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3004";

/**
 * Check budgets and send alerts if thresholds are exceeded
 * @param {string} userId - User ID
 * @param {string} category - Transaction category
 * @param {number} amount - Transaction amount
 * @param {Date} transactionDate - Transaction date
 */
export async function checkBudgetAlerts(userId, category, amount, transactionDate) {
  try {
    // Only check budgets for expense transactions
    if (!category || !amount || amount <= 0) {
      return;
    }

    // Find active budgets for this category
    const budgets = await Budget.find({
      userId,
      category,
      isActive: true,
      startDate: { $lte: transactionDate },
      $or: [
        { endDate: { $gte: transactionDate } },
        { endDate: null },
      ],
    });

    if (budgets.length === 0) {
      return;
    }

    // Get user preferences
    const user = await User.findById(userId).select("preferences");
    if (!user) {
      return;
    }

    // Check each budget
    for (const budget of budgets) {
      try {
        const startDate = new Date(budget.startDate);
        const endDate = budget.endDate || new Date();

        // Calculate actual spending
        const expenses = await Transaction.find({
          userId,
          category: budget.category,
          type: "expense",
          date: { $gte: startDate, $lte: endDate },
        });

        const actualSpending = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const percentage = budget.amount > 0 ? (actualSpending / budget.amount) * 100 : 0;
        const isOverBudget = actualSpending > budget.amount;
        const thresholdPercentage = (budget.alertThreshold || 0.8) * 100;

        // Check if we should send an alert
        let shouldAlert = false;
        let alertType = null;

        if (isOverBudget && !budget.alertSent) {
          // Budget exceeded - send alert
          shouldAlert = true;
          alertType = "exceeded";
        } else if (percentage >= thresholdPercentage && percentage < 100 && !budget.alertSent) {
          // Threshold reached but not exceeded
          shouldAlert = true;
          alertType = "threshold";
        } else if (percentage >= 100 && !budget.alertSent) {
          // Just exceeded budget
          shouldAlert = true;
          alertType = "exceeded";
        }

        if (shouldAlert) {
          // Send notification via notification service
          await sendBudgetNotification(userId, {
            budgetId: budget._id.toString(),
            category: budget.category,
            budgetAmount: budget.amount,
            actualSpending,
            percentage: Math.round(percentage * 100) / 100,
            remaining: budget.amount - actualSpending,
            isOverBudget,
            alertType,
            message: getAlertMessage(alertType, budget.category, percentage, actualSpending, budget.amount),
          }, user.preferences);

          // Mark alert as sent
          await Budget.findByIdAndUpdate(budget._id, { alertSent: true });
        }
      } catch (budgetError) {
        logger.error(`Error checking budget ${budget._id}:`, budgetError);
      }
    }
  } catch (error) {
    logger.error("Error in checkBudgetAlerts:", error);
  }
}

/**
 * Send budget notification via notification service
 */
async function sendBudgetNotification(userId, budgetData, userPreferences) {
  try {
    // Check user notification preferences
    if (!userPreferences?.notifications?.push && !userPreferences?.notifications?.email) {
      logger.debug(`User ${userId} has notifications disabled, skipping alert`);
      return;
    }

    // Send via REST endpoint (notification service will handle WebSocket)
    const notificationData = {
      userId: userId.toString(),
      event: "budget:threshold",
      data: {
        type: "budget_alert",
        ...budgetData,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await axios.post(`${NOTIFICATION_SERVICE_URL}/notify`, notificationData, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 5000,
      });
      logger.info(`Budget alert sent for user ${userId}, budget ${budgetData.category}`);
    } catch (axiosError) {
      logger.warn(`Failed to send notification via service: ${axiosError.message}`);
      // Continue execution - notification failure shouldn't break transaction creation
    }
  } catch (error) {
    logger.error("Error sending budget notification:", error);
  }
}

/**
 * Generate alert message based on alert type
 */
function getAlertMessage(alertType, category, percentage, actualSpending, budgetAmount) {
  if (alertType === "exceeded") {
    return `Budget exceeded for ${category}! You've spent $${actualSpending.toFixed(2)} of your $${budgetAmount.toFixed(2)} budget (${percentage.toFixed(1)}%).`;
  } else {
    return `Budget alert for ${category}: You've used ${percentage.toFixed(1)}% of your budget ($${actualSpending.toFixed(2)} / $${budgetAmount.toFixed(2)}).`;
  }
}

/**
 * Reset alert sent flag when budget period changes
 * This should be called when a new budget period starts
 */
export async function resetBudgetAlerts(userId, budgetId) {
  try {
    await Budget.findByIdAndUpdate(budgetId, { alertSent: false });
  } catch (error) {
    logger.error(`Error resetting budget alert for ${budgetId}:`, error);
  }
}

