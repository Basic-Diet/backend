const assert = require("assert");

const {
  REQUIRED_PHRASE,
  assertDatabaseNameSafe,
  assertExecutionConfirmed,
  parseArgs,
  summarizeCollections,
} = require("../scripts/reset-database-for-handover");

function expectThrow(fn, pattern) {
  assert.throws(fn, pattern);
}

function run() {
  assert.deepStrictEqual(parseArgs([]), { execute: false });
  assert.deepStrictEqual(parseArgs(["--execute"]), { execute: true });

  assert.strictEqual(assertDatabaseNameSafe("basicdiet145"), "basicdiet145");
  for (const protectedName of ["admin", "config", "local", "ADMIN"]) {
    expectThrow(() => assertDatabaseNameSafe(protectedName), /protected MongoDB database/);
  }
  expectThrow(() => assertDatabaseNameSafe(""), /database name is empty/);

  assert.doesNotThrow(() => assertExecutionConfirmed({
    execute: false,
    databaseName: "basicdiet145",
    env: {},
  }));

  expectThrow(() => assertExecutionConfirmed({
    execute: true,
    databaseName: "basicdiet145",
    env: {},
  }), /ALLOW_DATABASE_RESET=true/);

  expectThrow(() => assertExecutionConfirmed({
    execute: true,
    databaseName: "basicdiet145",
    env: {
      ALLOW_DATABASE_RESET: "true",
      BACKUP_CONFIRMED: "true",
      RESET_DATABASE_NAME: "wrong_database",
      RESET_CONFIRM_PHRASE: REQUIRED_PHRASE,
    },
  }), /RESET_DATABASE_NAME=basicdiet145/);

  assert.doesNotThrow(() => assertExecutionConfirmed({
    execute: true,
    databaseName: "basicdiet145",
    env: {
      ALLOW_DATABASE_RESET: "true",
      BACKUP_CONFIRMED: "true",
      RESET_DATABASE_NAME: "basicdiet145",
      RESET_CONFIRM_PHRASE: REQUIRED_PHRASE,
    },
  }));

  assert.deepStrictEqual(
    summarizeCollections([
      { name: "users", count: 3 },
      { name: "orders", count: 7 },
    ]),
    [
      { name: "orders", count: 7 },
      { name: "users", count: 3 },
    ]
  );

  console.log("database handover reset safety checks passed");
}

run();
