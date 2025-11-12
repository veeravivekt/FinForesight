/**
 * Initial schema migration
 * This migration documents the initial database schema
 * Run this after setting up migrate-mongo to establish baseline
 */

export const up = async (db) => {
  // This migration is informational - schema is already created by Mongoose models
  // Indexes are created by createIndexes script
  console.log("Initial schema migration - schema already exists via Mongoose models");
  console.log("Run 'npm run create-indexes' to ensure all indexes are created");
};

export const down = async (db) => {
  // Rollback not applicable for initial schema
  console.log("Cannot rollback initial schema");
};

