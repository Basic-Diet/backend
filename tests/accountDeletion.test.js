process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-account-deletion-secret";
process.env.RATE_LIMIT_ACCOUNT_DELETION_WINDOW_MS = "60000";
process.env.RATE_LIMIT_ACCOUNT_DELETION_MAX = "3";
process.env.TRUST_PROXY = "true";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const request = require("supertest");

const { createApp } = require("../src/app");
const User = require("../src/models/User");
const AppUser = require("../src/models/AppUser");
const RefreshSession = require("../src/models/RefreshSession");
const AccountDeletionRequest = require("../src/models/AccountDeletionRequest");
const { issueAppAccessToken } = require("../src/services/appTokenService");
const { createRefreshSession } = require("../src/services/refreshSessionService");

const app = createApp();
const api = request(app);
const results = { passed: 0, failed: 0 };
let replSet;

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

function ip(value) {
  return { "X-Forwarded-For": value };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function startMongo() {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, dbName: "basicdiet_account_deletion_test" },
  });
  const uri = replSet.getUri("basicdiet_account_deletion_test");
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function stopMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

async function run() {
  await startMongo();

  await test("public account deletion request with valid email is stored as pending", async () => {
    const res = await api
      .post("/api/account-deletion/request")
      .set(ip("203.0.113.10"))
      .send({ email: "Delete.Me@Example.com", reason: "No longer needed", confirmation: true });

    assert.strictEqual(res.status, 202, JSON.stringify(res.body));
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.status, "pending");
    assert(res.body.requestId);

    const saved = await AccountDeletionRequest.findById(res.body.requestId).lean();
    assert(saved);
    assert.strictEqual(saved.email, "delete.me@example.com");
    assert.strictEqual(saved.status, "pending");
    assert.strictEqual(saved.userId, null);
    assert.strictEqual(saved.reason, "No longer needed");
  });

  await test("invalid email is rejected", async () => {
    const res = await api
      .post("/api/account-deletion/request")
      .set(ip("203.0.113.11"))
      .send({ email: "not-an-email", confirmation: true });

    assert.strictEqual(res.status, 400, JSON.stringify(res.body));
    assert.strictEqual(res.body.error.code, "INVALID_EMAIL");
  });

  await test("missing confirmation is rejected", async () => {
    const res = await api
      .post("/api/account-deletion/request")
      .set(ip("203.0.113.12"))
      .send({ email: "missing.confirm@example.com" });

    assert.strictEqual(res.status, 400, JSON.stringify(res.body));
    assert.strictEqual(res.body.error.code, "CONFIRMATION_REQUIRED");
  });

  await test("account deletion endpoint is rate limited", async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await api
        .post("/api/account-deletion/request")
        .set(ip("203.0.113.13"))
        .send({ email: `rate-${i}@example.com`, confirmation: true });
      assert.strictEqual(res.status, 202, JSON.stringify(res.body));
    }

    const blocked = await api
      .post("/api/account-deletion/request")
      .set(ip("203.0.113.13"))
      .send({ email: "rate-blocked@example.com", confirmation: true });
    assert.strictEqual(blocked.status, 429, JSON.stringify(blocked.body));
    assert.strictEqual(blocked.body.error.code, "RATE_LIMIT");
  });

  await test("authenticated deletion request soft deletes user and revokes sessions", async () => {
    const user = await User.create({
      phone: "+15551234567",
      phoneE164: "+15551234567",
      phoneVerified: true,
      email: "auth.delete@example.com",
      name: "Auth Delete",
      role: "client",
      passwordHash: "hashed",
      fcmTokens: ["token-1"],
    });
    await AppUser.create({
      phone: user.phoneE164,
      email: user.email,
      fullName: user.name,
      coreUserId: user._id,
      fcmTokens: ["token-2"],
    });
    await createRefreshSession({ userId: user._id });

    const accessToken = issueAppAccessToken(user);
    const res = await api
      .post("/api/app/account-deletion/request")
      .set(ip("203.0.113.14"))
      .set(authHeader(accessToken))
      .send({ email: user.email, reason: "Please remove me", confirmation: true });

    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.status, "completed");

    const savedUser = await User.findById(user._id).lean();
    assert.strictEqual(savedUser.isActive, false);
    assert.strictEqual(savedUser.passwordHash, null);
    assert.deepStrictEqual(savedUser.fcmTokens, []);

    const activeSessions = await RefreshSession.countDocuments({ userId: user._id, revokedAt: null });
    assert.strictEqual(activeSessions, 0);

    const deletionRequest = await AccountDeletionRequest.findById(res.body.requestId).lean();
    assert.strictEqual(deletionRequest.status, "completed");
    assert.strictEqual(String(deletionRequest.userId), String(user._id));
  });

  await test("soft-deleted user cannot access protected routes and sensitive fields are not returned", async () => {
    const user = await User.findOne({ email: "auth.delete@example.com" }).lean();
    const accessToken = issueAppAccessToken(user);

    const res = await api
      .get("/api/auth/me")
      .set(ip("203.0.113.15"))
      .set(authHeader(accessToken));

    assert.strictEqual(res.status, 403, JSON.stringify(res.body));
    assert.strictEqual(res.body.error.code, "SESSION_REVOKED");
    assert.strictEqual(JSON.stringify(res.body).includes("passwordHash"), false);
    assert.strictEqual(JSON.stringify(res.body).includes("hashed"), false);
  });

  await stopMongo();

  if (results.failed > 0) {
    console.error(`${results.failed} account deletion tests failed`);
    process.exit(1);
  }
  console.log(`All account deletion tests passed (${results.passed})`);
}

run().catch(async (err) => {
  console.error(err && err.stack ? err.stack : err);
  await stopMongo();
  process.exit(1);
});
