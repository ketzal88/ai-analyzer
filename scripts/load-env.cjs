// Pre-loads .env.local before any ES module imports.
// Usage: npx tsx --require ./scripts/load-env.cjs scripts/test-alert-engine.ts
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
