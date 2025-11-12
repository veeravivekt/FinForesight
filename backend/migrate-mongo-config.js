import dotenv from "dotenv";

dotenv.config();

const config = {
  mongodb: {
    url: process.env.MONGO_URL || "mongodb://localhost:27017/finforesight",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  migrationFileExtension: ".js",
  useFileHash: false,
};

export default config;

