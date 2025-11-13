module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    // Error prevention
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    "no-debugger": "error",
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "no-undef": "error",

    // Code quality
    "eqeqeq": ["error", "always"],
    "curly": ["error", "all"],
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-return-await": "error",
    "require-await": "warn",

    // Best practices
    "no-var": "error",
    "prefer-const": "error",
    "prefer-arrow-callback": "warn",
    "prefer-template": "warn",
    "object-shorthand": "warn",
    "prefer-destructuring": [
      "warn",
      {
        array: false,
        object: true,
      },
    ],

    // Style (can be auto-fixed by Prettier, but good to have)
    "semi": ["error", "always"],
    "quotes": ["error", "double", { avoidEscape: true }],
    "comma-dangle": ["error", {
      "arrays": "always-multiline",
      "objects": "always-multiline",
      "imports": "always-multiline",
      "exports": "always-multiline",
      "functions": "always-multiline"
    }],
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"],
  },
  ignorePatterns: ["node_modules/", "dist/", "build/", "*.config.js"],
  overrides: [
    {
      files: ["**/__tests__/**/*.js", "**/*.test.js", "**/test-helpers.js"],
      env: {
        jest: true,
      },
    },
    {
      files: ["**/scripts/**/*.js", "**/migrations/**/*.js"],
      rules: {
        "no-console": "off",
        "no-unused-vars": ["warn", {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        }],
      },
    },
  ],
};

