import mongoose from "mongoose";
import dotenv from "dotenv";
import Transaction from "../shared/models/Transaction.js";
import Account from "../shared/models/Account.js";
import Budget from "../shared/models/Budget.js";
import Goal from "../shared/models/Goal.js";
import User from "../shared/models/User.js";
import Receipt from "../shared/models/Receipt.js";
import RecurringTransaction from "../shared/models/RecurringTransaction.js";

dotenv.config();

const createIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27017/finforesight");
    console.log("Connected to MongoDB");

    console.log("Creating indexes...");

    // Transaction indexes
    await Transaction.collection.createIndex({ userId: 1, date: -1 });
    await Transaction.collection.createIndex({ userId: 1, category: 1 });
    await Transaction.collection.createIndex({ userId: 1, accountId: 1, date: -1 });
    await Transaction.collection.createIndex({ accountId: 1, date: -1 });
    await Transaction.collection.createIndex({ userId: 1, type: 1, date: -1 });
    await Transaction.collection.createIndex({ userId: 1, isRecurring: 1 });
    console.log("✓ Transaction indexes created");

    // Account indexes
    await Account.collection.createIndex({ userId: 1, isArchived: 1 });
    await Account.collection.createIndex({ userId: 1, type: 1 });
    console.log("✓ Account indexes created");

    // Budget indexes
    await Budget.collection.createIndex({ userId: 1, category: 1, isActive: 1 });
    await Budget.collection.createIndex({ userId: 1, startDate: 1, endDate: 1 });
    await Budget.collection.createIndex({ userId: 1, isActive: 1, period: 1 });
    console.log("✓ Budget indexes created");

    // Goal indexes
    await Goal.collection.createIndex({ userId: 1, isCompleted: 1 });
    await Goal.collection.createIndex({ userId: 1, targetDate: 1 });
    await Goal.collection.createIndex({ userId: 1, accountId: 1 });
    console.log("✓ Goal indexes created");

    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    console.log("✓ User indexes created");

    // Receipt indexes (if model exists)
    if (Receipt) {
      await Receipt.collection.createIndex({ userId: 1, createdAt: -1 });
      console.log("✓ Receipt indexes created");
    }

    // RecurringTransaction indexes (if model exists)
    if (RecurringTransaction) {
      await RecurringTransaction.collection.createIndex({ userId: 1, isActive: 1 });
      await RecurringTransaction.collection.createIndex({ userId: 1, nextDueDate: 1 });
      console.log("✓ RecurringTransaction indexes created");
    }

    console.log("\n✅ All indexes created successfully!");

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error creating indexes:", error);
    process.exit(1);
  }
};

createIndexes();

