import mongoose from "mongoose";
import { exec } from "child_process";
import { promisify } from "util";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/finforesight";
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "../backups");
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || "7", 10);

/**
 * Create database backup
 */
const backupDatabase = async () => {
  try {
    // Parse MongoDB URL
    const url = new URL(MONGO_URL.replace("mongodb://", "http://"));
    const host = url.hostname;
    const port = url.port || 27017;
    const database = url.pathname.replace("/", "") || "finforesight";

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.gz`);

    // Create backup using mongodump
    const command = `mongodump --host ${host} --port ${port} --db ${database} --archive=${backupFile} --gzip`;

    console.log(`Creating backup: ${backupFile}`);
    await execAsync(command);

    console.log(`✅ Backup created successfully: ${backupFile}`);

    // Clean up old backups
    await cleanupOldBackups();

    return backupFile;
  } catch (error) {
    console.error("❌ Backup failed:", error);
    throw error;
  }
};

/**
 * Clean up backups older than retention period
 */
const cleanupOldBackups = async () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith("backup-") && file.endsWith(".gz")) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > retentionMs) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old backup: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning up backups:", error);
  }
};

/**
 * Restore database from backup
 * @param {string} backupFile - Path to backup file
 */
const restoreDatabase = async (backupFile) => {
  try {
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    const url = new URL(MONGO_URL.replace("mongodb://", "http://"));
    const host = url.hostname;
    const port = url.port || 27017;
    const database = url.pathname.replace("/", "") || "finforesight";

    const command = `mongorestore --host ${host} --port ${port} --db ${database} --archive=${backupFile} --gzip --drop`;

    console.log(`Restoring from backup: ${backupFile}`);
    await execAsync(command);

    console.log(`✅ Database restored successfully from ${backupFile}`);
  } catch (error) {
    console.error("❌ Restore failed:", error);
    throw error;
  }
};

// Run backup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backupDatabase()
    .then(() => {
      console.log("Backup completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Backup failed:", error);
      process.exit(1);
    });
}

export { backupDatabase, restoreDatabase, cleanupOldBackups };

