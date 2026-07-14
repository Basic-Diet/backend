#!/usr/bin/env node

const { spawn } = require("child_process");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

function safeDbName(value) {
  const raw = String(value || "").trim();
  if (/^[a-zA-Z0-9_-]+$/.test(raw) && /(test|local|ci)/i.test(raw)) return raw;
  return `basicdiet_memory_${process.pid}_test`;
}

function run(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });
    child.on("error", (error) => {
      console.error(error && error.stack ? error.stack : error);
      resolve(1);
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        console.error(`Command terminated by signal ${signal}`);
        resolve(1);
        return;
      }
      resolve(code || 0);
    });
  });
}

async function main() {
  const separator = process.argv.indexOf("--");
  const command = separator >= 0 ? process.argv[separator + 1] : process.argv[2];
  const args = separator >= 0 ? process.argv.slice(separator + 2) : process.argv.slice(3);
  if (!command) {
    console.error("Usage: node scripts/with-memory-replset.js -- <command> [args...]");
    process.exit(2);
  }

  const dbName = safeDbName(process.env.MONGODB_MEMORY_BASE_DB || "basicdiet_memory_test");
  const replSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  try {
    const uri = replSet.getUri(dbName);
    console.log(`Started isolated MongoMemory replica set for database: ${dbName}`);
    const exitCode = await run(command, args, {
      ...process.env,
      MONGO_URI: uri,
      MONGODB_URI: uri,
      MONGO_URI_TEST: uri,
      USE_MONGODB_MEMORY_REPLSET_STARTED: "true",
    });
    process.exitCode = exitCode;
  } finally {
    await replSet.stop();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
