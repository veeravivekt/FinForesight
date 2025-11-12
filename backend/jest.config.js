export default {
  // Use ES modules
  preset: undefined,
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".js"],
  moduleFileExtensions: ["js", "json"],
  transform: {},
  transformIgnorePatterns: [],

  // Test file patterns
  testMatch: ["**/__tests__/**/*.test.js", "**/?(*.)+(spec|test).js"],

  // Coverage configuration
  collectCoverageFrom: [
    "services/**/*.js",
    "shared/**/*.js",
    "gateway/**/*.js",
    "!**/node_modules/**",
    "!**/__tests__/**",
    "!**/*.test.js",
    "!**/*.config.js",
  ],

  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // Module resolution
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // Setup files
  setupFilesAfterEnv: [],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Reset modules between tests
  resetMocks: true,

  // Restore mocks between tests
  restoreMocks: true,
};

