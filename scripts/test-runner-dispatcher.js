#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const TEST_ROOT = path.join(__dirname, "..", "tests");

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function discoverTestFiles(rootDir = TEST_ROOT) {
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".test.js")) {
        files.push(normalizePath(path.relative(path.join(__dirname, ".."), fullPath)));
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

function hasLocalGlobal(source, name) {
  const pattern = new RegExp(`(^|\\n)\\s*(?:async\\s+)?function\\s+${name}\\b|(^|\\n)\\s*(?:const|let|var)\\s+${name}\\b`, "m");
  return pattern.test(source);
}

function classifySource(source, filePath = "unknown.test.js") {
  const normalized = normalizePath(filePath);
  const hasJestApi = /\bjest\s*\.|\bjest\s*\(|\bbeforeAll\s*\(|\bafterAll\s*\(|\bexpect\s*\(/.test(source);
  if (hasJestApi) {
    return {
      file: normalized,
      framework: "Jest",
      runner: "jest",
      mongoRequired: /\bmongoose\b|\bmongodb\b|MONGO_URI|MONGODB_URI/.test(source),
      replicaSetRequired: /MongoMemoryReplSet|startSession|withTransaction|USE_MONGODB_MEMORY_REPLSET/.test(source),
      safeToParallelize: false,
      suiteWrapper: false,
    };
  }

  if (/require\(["']node:test["']\)|from ["']node:test["']/.test(source)) {
    return {
      file: normalized,
      framework: "Node built-in test",
      runner: "node-test",
      mongoRequired: /\bmongoose\b|\bmongodb\b|MONGO_URI|MONGODB_URI/.test(source),
      replicaSetRequired: /MongoMemoryReplSet|startSession|withTransaction|USE_MONGODB_MEMORY_REPLSET/.test(source),
      safeToParallelize: false,
      suiteWrapper: false,
    };
  }

  const hasLocalDescribe = hasLocalGlobal(source, "describe");
  const hasLocalIt = hasLocalGlobal(source, "it");
  const hasMochaGlobals = /\bdescribe\s*\(/.test(source)
    && (/\bit\s*\(/.test(source) || /\bbefore\s*\(/.test(source) || /\bafter\s*\(/.test(source))
    && !(hasLocalDescribe && hasLocalIt);

  if (hasMochaGlobals) {
    return {
      file: normalized,
      framework: "Mocha",
      runner: "mocha",
      mongoRequired: /\bmongoose\b|\bmongodb\b|MONGO_URI|MONGODB_URI|MongoMemoryServer/.test(source),
      replicaSetRequired: /MongoMemoryReplSet|startSession|withTransaction|USE_MONGODB_MEMORY_REPLSET/.test(source),
      safeToParallelize: false,
      suiteWrapper: false,
    };
  }

  if (/require\(["']\.\/.+\.(?:test|integration\.test)(?:\.js)?["']\)\s*;?/.test(source)) {
    return {
      file: normalized,
      framework: "Suite wrapper",
      runner: "wrapper",
      mongoRequired: /\bmongoose\b|\bmongodb\b|MONGO_URI|MONGODB_URI/.test(source),
      replicaSetRequired: /MongoMemoryReplSet|startSession|withTransaction|USE_MONGODB_MEMORY_REPLSET/.test(source),
      safeToParallelize: false,
      suiteWrapper: true,
    };
  }

  const plainNodeSignals = [
    /require\(["']assert["']\)/,
    /\basync\s+function\s+(run|main|runTests)\b/,
    /\bfunction\s+(run|main|runTests|test|it)\b/,
    /\bprocess\.exitCode\b/,
    /\bprocess\.exit\s*\(/,
  ];

  if (plainNodeSignals.some((pattern) => pattern.test(source))) {
    return {
      file: normalized,
      framework: "Plain Node script",
      runner: "node",
      mongoRequired: /\bmongoose\b|\bmongodb\b|MONGO_URI|MONGODB_URI/.test(source),
      replicaSetRequired: /MongoMemoryReplSet|startSession|withTransaction|USE_MONGODB_MEMORY_REPLSET/.test(source),
      safeToParallelize: false,
      suiteWrapper: false,
    };
  }

  if (/npm\s+run\s+test:|spawn\(|execFile\(|child_process/.test(source)) {
    return {
      file: normalized,
      framework: "Suite wrapper",
      runner: "wrapper",
      mongoRequired: /\bmongoose\b|\bmongodb\b|MONGO_URI|MONGODB_URI/.test(source),
      replicaSetRequired: /MongoMemoryReplSet|startSession|withTransaction|USE_MONGODB_MEMORY_REPLSET/.test(source),
      safeToParallelize: false,
      suiteWrapper: true,
    };
  }

  const error = new Error(`Unclassified test file: ${normalized}. Add a runner classification before test:all can execute it.`);
  error.code = "UNCLASSIFIED_TEST_FILE";
  throw error;
}

function classifyTestFile(filePath) {
  const fullPath = path.resolve(filePath);
  const source = fs.readFileSync(fullPath, "utf8");
  return classifySource(source, normalizePath(path.relative(path.join(__dirname, ".."), fullPath)));
}

function commandFor(classification, timeoutMs = 180000) {
  const file = classification.file;
  switch (classification.runner) {
    case "node":
      return `node ${shellQuote(file)}`;
    case "node-test":
      return `node --test ${shellQuote(file)}`;
    case "mocha":
      return `./node_modules/.bin/mocha --timeout ${timeoutMs} ${shellQuote(file)}`;
    case "jest":
      return `./node_modules/.bin/jest --runInBand --testTimeout=${timeoutMs} ${shellQuote(file)}`;
    case "wrapper":
      return "";
    default:
      throw new Error(`Unsupported runner '${classification.runner}' for ${file}`);
  }
}

function runSelfTest() {
  const mocha = classifySource("describe('x', function() { before(function() {}); it('y', function() {}); });", "tests/mocha.test.js");
  assert.strictEqual(mocha.runner, "mocha");

  const jest = classifySource("jest.mock('../thing'); beforeAll(() => {}); test('x', () => expect(1).toBe(1));", "tests/jest.test.js");
  assert.strictEqual(jest.runner, "jest");

  const plain = classifySource("const assert = require('assert'); async function run() { assert.strictEqual(1, 1); } run();", "tests/plain.test.js");
  assert.strictEqual(plain.runner, "node");

  const wrapper = classifySource("const { spawn } = require('child_process'); spawn('npm', ['run', 'test:orders']);", "tests/wrapper.test.js");
  assert.strictEqual(wrapper.runner, "wrapper");
  assert.strictEqual(wrapper.suiteWrapper, true);

  assert.throws(
    () => classifySource("module.exports = {};", "tests/unclassified.test.js"),
    /Unclassified test file/
  );
}

function main(argv) {
  const command = argv[2] || "--help";

  if (command === "--self-test") {
    runSelfTest();
    console.log("test-runner-dispatcher self-test passed");
    return;
  }

  if (command === "--list-files") {
    for (const file of discoverTestFiles()) console.log(file);
    return;
  }

  if (command === "--manifest-tsv") {
    for (const file of discoverTestFiles()) {
      const classification = classifyTestFile(file);
      if (classification.suiteWrapper) continue;
      console.log([
        classification.file,
        classification.framework,
        classification.runner,
        classification.mongoRequired ? "yes" : "no",
        classification.replicaSetRequired ? "yes" : "no",
        classification.safeToParallelize ? "yes" : "no",
        commandFor(classification),
      ].join("\t"));
    }
    return;
  }

  if (command === "--classify") {
    const file = argv[3];
    const field = argv[4] || "json";
    if (!file) throw new Error("Usage: test-runner-dispatcher.js --classify <file> [field]");
    const classification = classifyTestFile(file);
    if (field === "json") {
      console.log(JSON.stringify({ ...classification, command: commandFor(classification) }));
      return;
    }
    if (field === "command") {
      console.log(commandFor(classification));
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(classification, field)) {
      throw new Error(`Unknown classification field '${field}'`);
    }
    console.log(classification[field]);
    return;
  }

  console.error("Usage:");
  console.error("  node scripts/test-runner-dispatcher.js --self-test");
  console.error("  node scripts/test-runner-dispatcher.js --list-files");
  console.error("  node scripts/test-runner-dispatcher.js --manifest-tsv");
  console.error("  node scripts/test-runner-dispatcher.js --classify <file> [field]");
  process.exitCode = 2;
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
}

module.exports = {
  classifySource,
  classifyTestFile,
  commandFor,
  discoverTestFiles,
};
