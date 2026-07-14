"use strict";

const assert = require("assert");
const {
  classifySource,
  commandFor,
} = require("../scripts/test-runner-dispatcher");

function run() {
  const mocha = classifySource(
    ["describe", "('suite', function() { before", "(function() {}); ", "it", "('case', function() {}); });"].join(""),
    "tests/sampleMocha.test.js"
  );
  assert.strictEqual(mocha.runner, "mocha");
  assert.match(commandFor(mocha), /mocha/);

  const jestCase = classifySource(
    ["jest", ".mock('../module'); before", "All(() => {}); test('case', () => ", "expect", "(1).toBe(1));"].join(""),
    "tests/sampleJest.test.js"
  );
  assert.strictEqual(jestCase.runner, "jest");
  assert.match(commandFor(jestCase), /jest/);

  const plain = classifySource(
    "const assert = require('assert'); async function runTests() { assert.strictEqual(1, 1); } runTests();",
    "tests/samplePlain.test.js"
  );
  assert.strictEqual(plain.runner, "node");
  assert.match(commandFor(plain), /^node /);

  const wrapper = classifySource(
    "const { spawn } = require('child_process'); spawn('npm', ['run', 'test:orders']);",
    "tests/sampleWrapper.test.js"
  );
  assert.strictEqual(wrapper.runner, "wrapper");
  assert.strictEqual(wrapper.suiteWrapper, true);
  assert.strictEqual(commandFor(wrapper), "");

  assert.throws(
    () => classifySource("module.exports = { ok: true };", "tests/unclassified.test.js"),
    /Unclassified test file/
  );

  console.log("testRunnerDispatcher.test.js passed");
}

run();
