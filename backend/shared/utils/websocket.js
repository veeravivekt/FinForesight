import axios from "axios";
import { createServiceLogger } from "./logger.js";

const logger = createServiceLogger("websocket-utils");

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3004";

/**
 * Emit WebSocket event via notification service
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
export async function emitWebSocketEvent(userId, event, data) {
  try {
    await axios.post(
      `${NOTIFICATION_SERVICE_URL}/notify`,
      {
        userId: userId.toString(),
        event,
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
      },
      {
        timeout: 5000,
      },
    );
  } catch (error) {
    logger.warn(`Failed to emit WebSocket event ${event} for user ${userId}:`, error.message);
    // Don't throw - WebSocket failures shouldn't break main functionality
  }
}

/**
 * Emit transaction events
 */
export async function emitTransactionEvent(userId, eventType, transaction) {
  await emitWebSocketEvent(userId, `transaction:${eventType}`, {
    transactionId: transaction._id?.toString() || transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    category: transaction.category,
    description: transaction.description,
    accountId: transaction.accountId?.toString() || transaction.accountId,
  });
}

/**
 * Emit goal events
 */
export async function emitGoalEvent(userId, eventType, goal) {
  await emitWebSocketEvent(userId, `goal:${eventType}`, {
    goalId: goal._id?.toString() || goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    progress: goal.progress,
  });
}

/**
 * Emit budget alert events
 */
export async function emitBudgetEvent(userId, eventType, budget) {
  await emitWebSocketEvent(userId, `budget:${eventType}`, {
    budgetId: budget._id?.toString() || budget.id,
    category: budget.category,
    amount: budget.amount,
    actualSpending: budget.actualSpending,
    percentage: budget.percentage,
    isOverBudget: budget.isOverBudget,
  });
}



