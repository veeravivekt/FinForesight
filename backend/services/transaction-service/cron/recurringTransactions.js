import cron from "node-cron";
import RecurringTransaction from "../../../shared/models/RecurringTransaction.js";
import Transaction from "../../../shared/models/Transaction.js";
import Account from "../../../shared/models/Account.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";
import { connectDB } from "../../../shared/utils/database.js";

const logger = createServiceLogger("transaction-service-cron");

/**
 * Calculate the next due date based on frequency
 */
function calculateNextDueDate(currentDate, frequency, dayOfMonth, dayOfWeek) {
  const nextDate = new Date(currentDate);

  switch (frequency) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + 1);
      break;

    case "weekly":
      nextDate.setDate(nextDate.getDate() + 7);
      if (dayOfWeek !== undefined) {
        // Adjust to the specified day of week
        const currentDay = nextDate.getDay();
        const daysToAdd = (dayOfWeek - currentDay + 7) % 7 || 7;
        nextDate.setDate(nextDate.getDate() + daysToAdd);
      }
      break;

    case "biweekly":
      nextDate.setDate(nextDate.getDate() + 14);
      break;

    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1);
      if (dayOfMonth !== undefined) {
        // Handle month-end edge cases
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(dayOfMonth, lastDayOfMonth));
      }
      break;

    case "yearly":
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      if (dayOfMonth !== undefined) {
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(dayOfMonth, lastDayOfMonth));
      }
      break;

    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate;
}

/**
 * Check if a recurring transaction is due today
 */
function isDueToday(nextDueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(nextDueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  return dueDate.getTime() === today.getTime();
}

/**
 * Process recurring transactions and create transactions for due ones
 */
async function processRecurringTransactions() {
  try {
    logger.info("Starting recurring transactions processing...");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find all active recurring transactions that are due today
    const dueRecurringTransactions = await RecurringTransaction.find({
      isActive: true,
      autoCreate: true,
      nextDueDate: {
        $gte: today,
        $lt: tomorrow,
      },
    }).populate("accountId");

    logger.info(`Found ${dueRecurringTransactions.length} recurring transactions due today`);

    let createdCount = 0;
    let errorCount = 0;

    for (const recurring of dueRecurringTransactions) {
      try {
        // Verify account still exists and belongs to user
        const account = await Account.findOne({
          _id: recurring.accountId._id,
          userId: recurring.userId,
          isArchived: false,
        });

        if (!account) {
          logger.warn(`Account ${recurring.accountId._id} not found or archived for recurring transaction ${recurring._id}`);
          continue;
        }

        // Check if transaction already created for this due date
        const existingTransaction = await Transaction.findOne({
          userId: recurring.userId,
          recurringTransactionId: recurring._id,
          date: {
            $gte: today,
            $lt: tomorrow,
          },
        });

        if (existingTransaction) {
          logger.info(`Transaction already exists for recurring ${recurring._id} on ${today.toISOString()}`);
          // Still update nextDueDate even if transaction exists
          const nextDueDate = calculateNextDueDate(
            recurring.nextDueDate,
            recurring.frequency,
            recurring.dayOfMonth,
            recurring.dayOfWeek
          );
          await RecurringTransaction.findByIdAndUpdate(recurring._id, {
            nextDueDate,
            lastCreated: new Date(),
          });
          continue;
        }

        // Create transaction
        const transaction = new Transaction({
          userId: recurring.userId,
          accountId: recurring.accountId._id,
          amount: recurring.amount,
          description: recurring.description,
          category: recurring.category,
          type: recurring.type,
          date: new Date(), // Use current date/time
          isRecurring: true,
          recurringTransactionId: recurring._id,
        });

        await transaction.save();

        // Update account balance
        if (recurring.type === "income") {
          account.balance = (account.balance || 0) + recurring.amount;
        } else if (recurring.type === "expense") {
          account.balance = (account.balance || 0) - recurring.amount;
        }
        await account.save();

        // Calculate and update next due date
        const nextDueDate = calculateNextDueDate(
          recurring.nextDueDate,
          recurring.frequency,
          recurring.dayOfMonth,
          recurring.dayOfWeek
        );

        await RecurringTransaction.findByIdAndUpdate(recurring._id, {
          nextDueDate,
          lastCreated: new Date(),
        });

        createdCount++;
        logger.info(`Created transaction ${transaction._id} from recurring ${recurring._id}`);
      } catch (error) {
        errorCount++;
        logger.error(`Error processing recurring transaction ${recurring._id}:`, error);
      }
    }

    logger.info(`Recurring transactions processing completed. Created: ${createdCount}, Errors: ${errorCount}`);
  } catch (error) {
    logger.error("Error in processRecurringTransactions:", error);
  }
}

/**
 * Initialize and start the cron job
 */
export function startRecurringTransactionsCron() {
  // Run daily at 2 AM (configurable via env)
  const cronSchedule = process.env.RECURRING_TRANSACTIONS_CRON_SCHEDULE || "0 2 * * *";
  
  logger.info(`Setting up recurring transactions cron job with schedule: ${cronSchedule}`);

  // Ensure database is connected before starting cron
  connectDB()
    .then(() => {
      // Run immediately on startup (for testing/debugging)
      if (process.env.RUN_RECURRING_ON_STARTUP === "true") {
        logger.info("Running recurring transactions on startup...");
        processRecurringTransactions();
      }

      // Schedule daily job
      cron.schedule(cronSchedule, async () => {
        await processRecurringTransactions();
      });

      logger.info("Recurring transactions cron job started successfully");
    })
    .catch((error) => {
      logger.error("Failed to connect to database for cron job:", error);
    });
}

export default {
  startRecurringTransactionsCron,
  processRecurringTransactions,
};

