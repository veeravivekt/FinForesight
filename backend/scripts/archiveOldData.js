import mongoose from "mongoose";
import dotenv from "dotenv";
import Transaction from "../shared/models/Transaction.js";
import logger from "../shared/utils/logger.js";

dotenv.config();

const ARCHIVE_AGE_DAYS = parseInt(process.env.ARCHIVE_AGE_DAYS || "365", 10); // Default: 1 year
const ARCHIVE_BATCH_SIZE = 1000;

/**
 * Archive old transactions to a separate collection
 */
const archiveOldTransactions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27017/finforesight");
    logger.info("Connected to MongoDB");

    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - ARCHIVE_AGE_DAYS);

    logger.info(`Archiving transactions older than ${ARCHIVE_AGE_DAYS} days (before ${archiveDate.toISOString()})`);

    // Find old transactions
    const oldTransactions = await Transaction.find({
      date: { $lt: archiveDate },
      archived: { $ne: true },
    }).limit(ARCHIVE_BATCH_SIZE);

    if (oldTransactions.length === 0) {
      logger.info("No transactions to archive");
      await mongoose.connection.close();
      return;
    }

    // Create archive collection if it doesn't exist
    const archiveCollection = mongoose.connection.db.collection("transactions_archive");

    // Move to archive collection
    for (const transaction of oldTransactions) {
      await archiveCollection.insertOne(transaction.toObject());
      transaction.archived = true;
      await transaction.save();
    }

    logger.info(`Archived ${oldTransactions.length} transactions`);

    await mongoose.connection.close();
  } catch (error) {
    logger.error("Error archiving old data:", error);
    throw error;
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  archiveOldTransactions()
    .then(() => {
      logger.info("Archive completed");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Archive failed:", error);
      process.exit(1);
    });
}

export { archiveOldTransactions };

