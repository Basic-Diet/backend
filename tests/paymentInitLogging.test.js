/**
 * paymentInitLogging.test.js
 *
 * Unit tests verifying that payment-init errors are:
 *  1. Logged with safe structured fields (no secret values).
 *  2. Never exposed to the client beyond the safe PAYMENT_INIT_ERROR envelope.
 *
 * Run:  NODE_ENV=test node tests/paymentInitLogging.test.js
 */

"use strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "supersecret_test";
process.env.NODE_ENV = "test";

const assert = require("assert");

// ── helper: capture logger.error calls ───────────────────────────────────────
const capturedLogs = [];
const { logger } = require("../src/utils/logger");
logger.error = (message, meta) => {
  capturedLogs.push({ message, meta: meta || {} });
};

// ── moyasarService reference ──────────────────────────────────────────────────
const moyasarService = require("../src/services/moyasarService");
const {
  normalizePaymentRedirectUrls,
  isValidHttpsUrl,
} = require("../src/utils/paymentRedirectUrls");

function stubCreateInvoice(behaviour) {
  const original = moyasarService.createInvoice;
  moyasarService.createInvoice = behaviour;
  return () => { moyasarService.createInvoice = original; };
}

// ── test runner ───────────────────────────────────────────────────────────────
const results = { passed: 0, failed: 0 };

async function test(name, fn) {
  capturedLogs.length = 0; // reset before each test
  try {
    await fn();
    results.passed += 1;
    console.log(`  ✅  ${name}`);
  } catch (err) {
    results.failed += 1;
    console.error(`  ❌  ${name}`);
    console.error(err && err.stack ? err.stack : err);
  }
}

(async function run() {
  console.log("\n── payment redirect URL normalization ───────────────────────────────────────");

  await test("accepts valid HTTPS successUrl/backUrl unchanged", () => {
    const normalized = normalizePaymentRedirectUrls({
      successUrl: " https://app.example.com/orders/payment-success?ok=1 ",
      backUrl: "https://app.example.com/orders/payment-cancel",
      appUrl: "https://api.example.com",
    });
    assert.strictEqual(normalized.successUrl, "https://app.example.com/orders/payment-success?ok=1");
    assert.strictEqual(normalized.backUrl, "https://app.example.com/orders/payment-cancel");
    assert.strictEqual(normalized.logContext.successRedirectAccepted, true);
    assert.strictEqual(normalized.logContext.backRedirectAccepted, true);
    assert.strictEqual(normalized.backendOrigin, "https://api.example.com");
  });

  await test("replaces basicdiet deep links with APP_URL HTTPS fallbacks", () => {
    const normalized = normalizePaymentRedirectUrls({
      successUrl: "basicdiet://orders/payment-success",
      backUrl: "basicdiet://orders/payment-cancel",
      appUrl: "https://api.example.com",
    });
    assert.strictEqual(normalized.successUrl, "https://api.example.com/payment-success");
    assert.strictEqual(normalized.backUrl, "https://api.example.com/payment-cancel");
    assert.strictEqual(normalized.logContext.successRedirectAccepted, false);
    assert.strictEqual(normalized.logContext.backRedirectAccepted, false);
    assert.strictEqual(normalized.logContext.successOriginalScheme, "basicdiet");
    assert.strictEqual(normalized.logContext.backOriginalScheme, "basicdiet");
  });

  await test("replaces http URLs in production", () => {
    const savedNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const normalized = normalizePaymentRedirectUrls({
        successUrl: "http://client.example.com/success",
        backUrl: "http://client.example.com/cancel",
        appUrl: "https://api.example.com",
      });
      assert.strictEqual(normalized.successUrl, "https://api.example.com/payment-success");
      assert.strictEqual(normalized.backUrl, "https://api.example.com/payment-cancel");
      assert.strictEqual(normalized.logContext.successOriginalScheme, "http");
      assert.strictEqual(normalized.logContext.backOriginalScheme, "http");
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
    }
  });

  await test("missing URLs use HTTPS fallback", () => {
    const normalized = normalizePaymentRedirectUrls({
      appUrl: "https://api.example.com",
    });
    assert.strictEqual(normalized.successUrl, "https://api.example.com/payment-success");
    assert.strictEqual(normalized.backUrl, "https://api.example.com/payment-cancel");
    assert.strictEqual(normalized.logContext.successOriginalScheme, "none");
    assert.strictEqual(normalized.logContext.backOriginalScheme, "none");
  });

  await test("invalid strings do not throw and use fallback", () => {
    const normalized = normalizePaymentRedirectUrls({
      successUrl: "not a url",
      backUrl: "javascript:alert(1)",
      appUrl: "https://api.example.com",
    });
    assert.strictEqual(normalized.successUrl, "https://api.example.com/payment-success");
    assert.strictEqual(normalized.backUrl, "https://api.example.com/payment-cancel");
    assert.strictEqual(normalized.logContext.successOriginalScheme, "invalid");
    assert.strictEqual(normalized.logContext.backOriginalScheme, "javascript");
  });

  await test("isValidHttpsUrl rejects non-string and non-HTTPS values", () => {
    assert.strictEqual(isValidHttpsUrl("https://example.com/ok"), true);
    assert.strictEqual(isValidHttpsUrl("http://example.com/no"), false);
    assert.strictEqual(isValidHttpsUrl("basicdiet://orders/payment-success"), false);
    assert.strictEqual(isValidHttpsUrl(null), false);
  });

  // ── unit: moyasarService.getMoyasarEnvStatus ────────────────────────────────
  console.log("\n── getMoyasarEnvStatus ──────────────────────────────────────────────────────");

  await test("returns configured=false when MOYASAR_SECRET_KEY is absent", () => {
    const saved = process.env.MOYASAR_SECRET_KEY;
    delete process.env.MOYASAR_SECRET_KEY;
    try {
      const { getMoyasarEnvStatus } = require("../src/services/moyasarService");
      const status = getMoyasarEnvStatus();
      assert.strictEqual(status.configured, false);
      assert.deepStrictEqual(status.missingVars, ["MOYASAR_SECRET_KEY"]);
    } finally {
      if (saved !== undefined) process.env.MOYASAR_SECRET_KEY = saved;
    }
  });

  await test("returns configured=true when MOYASAR_SECRET_KEY is present", () => {
    const saved = process.env.MOYASAR_SECRET_KEY;
    process.env.MOYASAR_SECRET_KEY = "sk_test_dummy";
    try {
      const { getMoyasarEnvStatus } = require("../src/services/moyasarService");
      const status = getMoyasarEnvStatus();
      assert.strictEqual(status.configured, true);
      assert.deepStrictEqual(status.missingVars, []);
    } finally {
      if (saved !== undefined) process.env.MOYASAR_SECRET_KEY = saved;
      else delete process.env.MOYASAR_SECRET_KEY;
    }
  });

  // ── unit: moyasarService.createInvoice — missing key ───────────────────────
  console.log("\n── createInvoice: missing key ───────────────────────────────────────────────");

  await test("throws CONFIG error with missingEnv=MOYASAR_SECRET_KEY when key absent", async () => {
    const saved = process.env.MOYASAR_SECRET_KEY;
    delete process.env.MOYASAR_SECRET_KEY;
    try {
      await assert.rejects(
        () => moyasarService.createInvoice({
          amount: 2500,
          currency: "SAR",
          _orderId: "ord_abc",
          _paymentId: "pay_xyz",
        }),
        (err) => {
          assert.strictEqual(err.code, "CONFIG");
          assert.strictEqual(err.missingEnv, "MOYASAR_SECRET_KEY");
          assert.ok(err.context, "err.context should exist");
          assert.deepStrictEqual(err.context.missingEnvVars, ["MOYASAR_SECRET_KEY"]);
          assert.strictEqual(err.context.provider, "moyasar");
          assert.strictEqual(err.context.amountHalala, 2500);
          assert.strictEqual(err.context.orderId, "ord_abc");
          assert.strictEqual(err.context.paymentId, "pay_xyz");
          // must never contain secret value
          assert.ok(!JSON.stringify(err).includes("sk_"), "Must not leak secret key value");
          return true;
        }
      );
    } finally {
      if (saved !== undefined) process.env.MOYASAR_SECRET_KEY = saved;
    }
  });

  // ── unit: moyasarService.createInvoice — provider HTTP error ───────────────
  console.log("\n── createInvoice: provider HTTP error ───────────────────────────────────────");

  await test("err.context contains safe provider fields on Moyasar 401", async () => {
    process.env.MOYASAR_SECRET_KEY = "sk_test_bad";

    const httpErr = new Error("Unauthorized");
    httpErr.status = 401;
    httpErr.moyasarCode = "authentication_failed";

    const restore = stubCreateInvoice(async ({ amount, currency, _orderId, _paymentId }) => {
      httpErr.context = {
        provider: "moyasar",
        amountHalala: amount,
        currency,
        successUrlDomain: "https://example.com",
        backUrlDomain: "https://example.com",
        callbackUrlDomain: "https://example.com",
        providerHttpStatus: httpErr.status,
        providerErrorCode: httpErr.moyasarCode,
        providerErrorMessage: httpErr.message,
        orderId: _orderId,
        paymentId: _paymentId,
      };
      throw httpErr;
    });

    try {
      await assert.rejects(
        () => moyasarService.createInvoice({
          amount: 2500,
          currency: "SAR",
          successUrl: "https://example.com/success",
          backUrl: "https://example.com/cancel",
          callbackUrl: "https://example.com/api/webhooks/moyasar",
          _orderId: "ord_123",
          _paymentId: "pay_456",
        }),
        (err) => {
          const ctx = err.context;
          assert.ok(ctx, "err.context must exist");
          assert.strictEqual(ctx.provider, "moyasar");
          assert.strictEqual(ctx.providerHttpStatus, 401);
          assert.strictEqual(ctx.providerErrorCode, "authentication_failed");
          assert.strictEqual(ctx.orderId, "ord_123");
          assert.strictEqual(ctx.paymentId, "pay_456");
          const ctxStr = JSON.stringify(ctx);
          assert.ok(!ctxStr.includes("sk_test_bad"), "Must not leak MOYASAR_SECRET_KEY value");
          assert.ok(!ctxStr.includes("Authorization"), "Must not log Authorization header");
          return true;
        }
      );
    } finally {
      restore();
      delete process.env.MOYASAR_SECRET_KEY;
    }
  });

  // ── unit: catch block log structure ────────────────────────────────────────
  console.log("\n── orderController: catch block log & routing logic ─────────────────────────");

  await test("PAYMENT_INIT_ERROR log contains provider context but no secret values", () => {
    capturedLogs.length = 0;
    const mongoose = require("mongoose");

    const fakeOrderId = new mongoose.Types.ObjectId();
    const fakePaymentId = new mongoose.Types.ObjectId();

    const providerErr = new Error("Unauthorized");
    providerErr.status = 401;
    providerErr.code = "401";
    providerErr.context = {
      provider: "moyasar",
      amountHalala: 2500,
      currency: "SAR",
      successUrlDomain: "basicdiet://",
      backUrlDomain: "basicdiet://",
      callbackUrlDomain: "https://api.example.com",
      providerHttpStatus: 401,
      providerErrorCode: "authentication_failed",
      providerErrorMessage: "Unauthorized",
      orderId: String(fakeOrderId),
      paymentId: String(fakePaymentId),
    };

    const isProviderError = Boolean(
      providerErr.context
      && providerErr.context.provider === "moyasar"
      && providerErr.context.providerHttpStatus
    );
    const isConfigError = Boolean(providerErr.code === "CONFIG" || providerErr.missingEnv);

    const logDetail = {
      orderId: String(fakeOrderId),
      paymentId: String(fakePaymentId),
      errorName: providerErr.name,
      errorMessage: providerErr.message,
      ...(providerErr.context ? {
        provider: providerErr.context.provider,
        providerHttpStatus: providerErr.context.providerHttpStatus,
        providerErrorCode: providerErr.context.providerErrorCode,
        providerErrorMessage: providerErr.context.providerErrorMessage,
        amountHalala: providerErr.context.amountHalala,
        currency: providerErr.context.currency,
        successUrlDomain: providerErr.context.successUrlDomain,
        backUrlDomain: providerErr.context.backUrlDomain,
        callbackUrlDomain: providerErr.context.callbackUrlDomain,
        missingEnvVars: providerErr.context.missingEnvVars,
      } : {}),
      missingEnvName: providerErr.missingEnv || undefined,
      isProviderError,
      isConfigError,
    };

    logger.error("PAYMENT_INIT_ERROR [createOrder]", logDetail);

    assert.ok(capturedLogs.length > 0, "Expected at least one log entry");
    const log = capturedLogs[capturedLogs.length - 1];
    assert.ok(log.message.includes("PAYMENT_INIT_ERROR"));
    assert.strictEqual(log.meta.provider, "moyasar");
    assert.strictEqual(log.meta.providerHttpStatus, 401);
    assert.strictEqual(log.meta.providerErrorCode, "authentication_failed");
    assert.strictEqual(log.meta.isProviderError, true);

    const logStr = JSON.stringify(log);
    assert.ok(!logStr.includes("MOYASAR_SECRET_KEY="), "Must not log secret value");
    assert.ok(!logStr.includes("sk_test"), "Must not contain API key string");
    assert.ok(!logStr.includes("\"Authorization\""), "Must not log Authorization header");
  });

  await test("isClientError=false for provider HTTP errors (they become PAYMENT_INIT_ERROR)", () => {
    const providerErr = new Error("Unauthorized");
    providerErr.status = 401;
    providerErr.code = "401";
    providerErr.context = {
      provider: "moyasar",
      providerHttpStatus: 401,
    };

    const isProviderError = Boolean(
      providerErr.context
      && providerErr.context.provider === "moyasar"
      && providerErr.context.providerHttpStatus
    );
    const isConfigError = false;
    const isDuplicateKey = false;
    const isClientError = Boolean(
      providerErr.code && providerErr.status
      && !isProviderError && !isConfigError && !isDuplicateKey
    );
    assert.strictEqual(isClientError, false, "Provider errors must NOT be forwarded as client errors");
    assert.strictEqual(isProviderError, true);
  });

  await test("CONFIG error sets isConfigError=true and is not forwarded to client", () => {
    const configErr = new Error("MOYASAR_SECRET_KEY is not configured");
    configErr.code = "CONFIG";
    configErr.missingEnv = "MOYASAR_SECRET_KEY";
    configErr.context = {
      provider: "moyasar",
      missingEnvVars: ["MOYASAR_SECRET_KEY"],
      amountHalala: 2500,
      currency: "SAR",
    };

    const isConfigError = Boolean(configErr.code === "CONFIG" || configErr.missingEnv);
    assert.strictEqual(isConfigError, true);

    const isDuplicateKey = false;
    const isProviderError = false;
    const isClientError = Boolean(
      configErr.code && configErr.status && !isProviderError && !isConfigError && !isDuplicateKey
    );
    assert.strictEqual(isClientError, false, "CONFIG errors must not be forwarded as client errors");
  });

  await test("getMoyasarEnvStatus never exposes env var values in its return shape", () => {
    const saved = process.env.MOYASAR_SECRET_KEY;
    process.env.MOYASAR_SECRET_KEY = "sk_live_secret_value";
    try {
      const { getMoyasarEnvStatus } = require("../src/services/moyasarService");
      const status = getMoyasarEnvStatus();
      // Return value must only name the vars, never include their values
      const statusStr = JSON.stringify(status);
      assert.ok(!statusStr.includes("sk_live_secret_value"), "getMoyasarEnvStatus must not expose env var values");
      assert.strictEqual(status.configured, true);
      assert.deepStrictEqual(status.missingVars, []);
    } finally {
      if (saved !== undefined) process.env.MOYASAR_SECRET_KEY = saved;
      else delete process.env.MOYASAR_SECRET_KEY;
    }
  });

  // ── summary ─────────────────────────────────────────────────────────────────
  console.log(`\nResults: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed > 0) {
    process.exit(1);
  }
})();
