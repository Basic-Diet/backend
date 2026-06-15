process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-public-policy-secret";

const assert = require("assert");
const request = require("supertest");

const { createApp } = require("../src/app");

const app = createApp();
const api = request(app);
const results = { passed: 0, failed: 0 };

async function test(name, fn) {
  try {
    await fn();
    results.passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    results.failed += 1;
    console.error(`FAIL ${name}`);
    console.error(err && err.stack ? err.stack : err);
  }
}

async function run() {
  await test("privacy policy remains public HTML", async () => {
    const res = await api.get("/privacy-policy");

    assert.strictEqual(res.status, 200, res.text);
    assert.match(res.headers["content-type"], /html/);
    assert.match(res.text, /Privacy Policy/);
  });

  await test("refund policy is public HTML with required content", async () => {
    const res = await api.get("/refund-policy");

    assert.strictEqual(res.status, 200, res.text);
    assert.match(res.headers["content-type"], /html/);
    assert.match(res.text, /basicdite Refund, Return &amp; Cancellation Policy/);
    assert.match(res.text, /No Cash Refund Policy/);
    assert.match(res.text, /Freeze, Skip &amp; Grace Days/);
    assert.match(res.text, /Duplicate Payments or Incorrect Charges/);
    assert.match(res.text, /basicdite@gmail\.com/);
  });

  if (results.failed > 0) {
    console.error(`${results.failed} public policy page tests failed`);
    process.exit(1);
  }

  console.log(`All public policy page tests passed (${results.passed})`);
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
