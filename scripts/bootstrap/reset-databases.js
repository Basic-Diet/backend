#!/usr/bin/env node

require("dotenv").config();
const mongoose = require("mongoose");
const { getDbNameFromUri } = require("../../src/utils/mongoUriResolver");

const SYSTEM_DATABASES = ["admin", "local", "config"];

function isTruthy(value) {
  return ["1", "true", "yes", "y"].includes(String(value || "").trim().toLowerCase());
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    dryRun: argv.includes("--dry-run"),
    confirmed: isTruthy(process.env.RESET_DB_CONFIRM),
    targetEnv: argv.includes("--test-only") ? "test" : argv.includes("--main-only") ? "main" : "all",
  };
}

function getEnvironmentName() {
  return process.env.NODE_ENV || "development";
}

function getTargetDatabases() {
  const targets = [];
  const mainDbName = process.env.MONGO_DB || getDbNameFromUri(process.env.MONGO_URI || process.env.MONGODB_URI);
  const testDbName = process.env.MONGO_DB_TEST || getDbNameFromUri(process.env.MONGO_URI_TEST);

  if (mainDbName) targets.push({ type: "main", dbName: mainDbName, uri: process.env.MONGO_URI || process.env.MONGODB_URI });
  if (testDbName) targets.push({ type: "test", dbName: testDbName, uri: process.env.MONGO_URI_TEST });

  return targets;
}

function isAllowedDatabase(dbName) {
  if (!dbName || typeof dbName !== "string") return false;
  const lower = dbName.toLowerCase();
  if (SYSTEM_DATABASES.includes(lower)) return false;

  // Strict allowlist checks
  return lower.includes("basicdiet145") || lower.includes("test") || lower.includes("local") || lower.includes("dev") || lower.includes("ci");
}

async function resetDatabases(options = {}) {
  const args = { ...parseArgs(options.argv), ...options };
  const envName = getEnvironmentName();

  console.log(`[reset-databases] Environment: ${envName}`);

  if (envName === "production") {
    throw new Error("Refusing to reset databases in production environment.");
  }

  if (!args.dryRun && !args.confirmed) {
    throw new Error("Refusing to reset databases without explicit confirmation. Set RESET_DB_CONFIRM=true or use --dry-run.");
  }

  const allTargets = getTargetDatabases();
  const filteredTargets = allTargets.filter((target) => {
    if (args.targetEnv === "test" && target.type !== "test") return false;
    if (args.targetEnv === "main" && target.type !== "main") return false;
    return true;
  });

  if (filteredTargets.length === 0) {
    console.log("[reset-databases] No valid database targets configured in environment variables.");
    return { targets: [], dryRun: args.dryRun };
  }

  console.log(`[reset-databases] Mode: ${args.dryRun ? "dry-run" : "confirmed-reset"}`);

  for (const target of filteredTargets) {
    if (!isAllowedDatabase(target.dbName)) {
      console.warn(`[reset-databases:skip] Database "${target.dbName}" (${target.type}) is not allowed for reset by safety allowlist.`);
      continue;
    }

    if (args.dryRun) {
      console.log(`[reset-databases:dry-run] Would connect to and DROP database "${target.dbName}" (${target.type}).`);
      continue;
    }

    if (!target.uri) {
      console.warn(`[reset-databases:error] Missing connection URI for database "${target.dbName}" (${target.type}).`);
      continue;
    }

    console.log(`[reset-databases:exec] Connecting to drop database "${target.dbName}" (${target.type})...`);
    const conn = await mongoose.createConnection(target.uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
    try {
      await conn.dropDatabase();
      console.log(`[reset-databases:success] Successfully dropped database "${target.dbName}" (${target.type}).`);
    } finally {
      await conn.close();
    }
  }

  return { targets: filteredTargets, dryRun: args.dryRun };
}

async function main() {
  try {
    await resetDatabases();
    process.exitCode = 0;
  } catch (err) {
    console.error(`[reset-databases:error] ${err.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  SYSTEM_DATABASES,
  getTargetDatabases,
  isAllowedDatabase,
  main,
  parseArgs,
  resetDatabases,
};
