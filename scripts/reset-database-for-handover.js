#!/usr/bin/env node

require("dotenv").config();

const mongoose = require("mongoose");
const { resolveMongoUri } = require("../src/utils/mongoUriResolver");

const REQUIRED_PHRASE = "DELETE_FAKE_DATA_AND_REBUILD";
const PROTECTED_DATABASES = new Set(["admin", "config", "local"]);

function isTruthy(value) {
  return ["1", "true", "yes", "y"].includes(String(value || "").trim().toLowerCase());
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    execute: argv.includes("--execute"),
  };
}

function assertDatabaseNameSafe(databaseName) {
  const normalized = String(databaseName || "").trim();
  if (!normalized) {
    throw new Error("Refusing database reset because the connected database name is empty.");
  }
  if (PROTECTED_DATABASES.has(normalized.toLowerCase())) {
    throw new Error(`Refusing database reset for protected MongoDB database \"${normalized}\".`);
  }
  return normalized;
}

function assertExecutionConfirmed({ execute, databaseName, env = process.env }) {
  if (!execute) return;

  const failures = [];
  if (!isTruthy(env.ALLOW_DATABASE_RESET)) {
    failures.push("ALLOW_DATABASE_RESET=true");
  }
  if (!isTruthy(env.BACKUP_CONFIRMED)) {
    failures.push("BACKUP_CONFIRMED=true");
  }
  if (String(env.RESET_DATABASE_NAME || "").trim() !== databaseName) {
    failures.push(`RESET_DATABASE_NAME=${databaseName}`);
  }
  if (String(env.RESET_CONFIRM_PHRASE || "").trim() !== REQUIRED_PHRASE) {
    failures.push(`RESET_CONFIRM_PHRASE=${REQUIRED_PHRASE}`);
  }

  if (failures.length) {
    throw new Error(
      `Refusing database reset. Missing or incorrect confirmations:\n- ${failures.join("\n- ")}`
    );
  }
}

function summarizeCollections(collections = []) {
  return collections
    .map((row) => ({ name: row.name, count: Number(row.count || 0) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadCollectionSummary(db) {
  const collectionInfos = await db.listCollections({}, { nameOnly: true }).toArray();
  const rows = [];
  for (const info of collectionInfos) {
    const count = await db.collection(info.name).estimatedDocumentCount();
    rows.push({ name: info.name, count });
  }
  return summarizeCollections(rows);
}

function printPlan({ databaseName, host, collections, execute }, log = console) {
  const totalDocuments = collections.reduce((sum, row) => sum + row.count, 0);
  log.log("\nDatabase handover reset plan");
  log.log(`- host: ${host || "unknown"}`);
  log.log(`- database: ${databaseName}`);
  log.log(`- collections: ${collections.length}`);
  log.log(`- estimated documents: ${totalDocuments}`);
  for (const row of collections) {
    log.log(`  - ${row.name}: ${row.count}`);
  }
  log.log(`- mode: ${execute ? "EXECUTE" : "DRY RUN"}`);
  if (!execute) {
    log.log("\nNo data was deleted. Use --execute only after backup and all confirmations are set.");
  }
}

async function run(options = {}) {
  const args = { ...parseArgs(options.argv), ...options };
  const uri = options.uri || resolveMongoUri();

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    const databaseName = assertDatabaseNameSafe(mongoose.connection.name);
    const host = mongoose.connection.host || "unknown";
    const collections = await loadCollectionSummary(mongoose.connection.db);

    printPlan({ databaseName, host, collections, execute: args.execute }, options.log || console);
    assertExecutionConfirmed({ execute: args.execute, databaseName, env: options.env || process.env });

    if (!args.execute) {
      return { executed: false, databaseName, host, collections };
    }

    const result = await mongoose.connection.db.dropDatabase();
    (options.log || console).log(`\nDatabase \"${databaseName}\" was dropped successfully.`);
    (options.log || console).log("Next: run npm run bootstrap:data:sync, npm run indexes:production, then create the real dashboard account.");
    return { executed: true, databaseName, host, collections, result };
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch(async (err) => {
    console.error(`[db:handover-reset] ${err.message}`);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  });
}

module.exports = {
  PROTECTED_DATABASES,
  REQUIRED_PHRASE,
  assertDatabaseNameSafe,
  assertExecutionConfirmed,
  isTruthy,
  parseArgs,
  run,
  summarizeCollections,
};
