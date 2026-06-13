"use strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "supersecret";

require("dotenv").config();

const assert = require("assert");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");

const { createApp } = require("../src/app");
const User = require("../src/models/User");
const Subscription = require("../src/models/Subscription");
const SubscriptionDay = require("../src/models/SubscriptionDay");
const SubscriptionPickupRequest = require("../src/models/SubscriptionPickupRequest");
const dateUtils = require("../src/utils/date");

const TEST_TAG = `pickup-request-routes-${Date.now()}`;
const TEST_PLAN_ID = new mongoose.Types.ObjectId();
const TODAY = dateUtils.getTodayKSADate();
const SUBSCRIPTION_START_DATE = dateUtils.addDaysToKSADateString(TODAY, -7);
const SUBSCRIPTION_END_DATE = dateUtils.addDaysToKSADateString(TODAY, 30);

const results = { passed: 0, failed: 0 };

function issueAppAccessToken(userId) {
  return jwt.sign(
    { userId: String(userId), role: "client", tokenType: "app_access" },
    process.env.JWT_SECRET || "supersecret",
    { expiresIn: "31d" }
  );
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function test(name, fn) {
  try {
    await fn();
    results.passed += 1;
    console.log(`✅ ${name}`);
  } catch (err) {
    results.failed += 1;
    console.error(`❌ ${name}`);
    console.error(err && err.stack ? err.stack : err);
  }
}

async function connect() {
  if (mongoose.connection.readyState !== 0) return;
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/basicdiet_test";
  await mongoose.connect(mongoUri);
}

async function cleanup() {
  const users = await User.find({ phone: { $regex: `^${TEST_TAG}` } }).select("_id").lean();
  const userIds = users.map((user) => user._id);
  const subscriptions = await Subscription.find({ userId: { $in: userIds } }).select("_id").lean();
  const subscriptionIds = subscriptions.map((subscription) => subscription._id);
  await Promise.all([
    SubscriptionPickupRequest.deleteMany({ $or: [{ userId: { $in: userIds } }, { subscriptionId: { $in: subscriptionIds } }] }),
    SubscriptionDay.deleteMany({ subscriptionId: { $in: subscriptionIds } }),
    Subscription.deleteMany({ _id: { $in: subscriptionIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
}

function buildCompleteDayFields({ status = "open", pickupRequested = false } = {}) {
  return {
    date: TODAY,
    status,
    pickupRequested,
    plannerState: "confirmed",
    planningState: "confirmed",
    selections: [new mongoose.Types.ObjectId()],
    plannerMeta: {
      requiredSlotCount: 1,
      completeSlotCount: 1,
      isDraftValid: true,
      isConfirmable: true,
      confirmedAt: new Date(),
      confirmedByRole: "client",
    },
    planningMeta: {
      requiredMealCount: 1,
      selectedTotalMealCount: 1,
      isExactCountSatisfied: true,
      confirmedAt: new Date(),
      confirmedByRole: "client",
    },
  };
}

async function seedUser(label) {
  return User.create({
    phone: `${TEST_TAG}-${label}`,
    name: label,
    role: "client",
    isActive: true,
  });
}

async function seedSubscriptionWithDay({
  user,
  deliveryMode = "pickup",
  remainingMeals = 10,
  dayStatus = "open",
} = {}) {
  const subscription = await Subscription.create({
    userId: user._id,
    planId: TEST_PLAN_ID,
    status: "active",
    startDate: new Date(`${SUBSCRIPTION_START_DATE}T00:00:00Z`),
    endDate: new Date(`${SUBSCRIPTION_END_DATE}T00:00:00Z`),
    validityEndDate: new Date(`${SUBSCRIPTION_END_DATE}T00:00:00Z`),
    totalMeals: remainingMeals,
    remainingMeals,
    selectedGrams: 200,
    selectedMealsPerDay: 1,
    deliveryMode,
    pickupLocationId: "main",
  });

  const day = await SubscriptionDay.create({
    subscriptionId: subscription._id,
    ...buildCompleteDayFields({ status: dayStatus }),
  });

  return { subscription, day };
}

async function getRemainingMeals(subscriptionId) {
  const subscription = await Subscription.findById(subscriptionId).select("remainingMeals").lean();
  assert(subscription, "subscription should exist");
  return Number(subscription.remainingMeals || 0);
}

(async function run() {
  try {
    await connect();
    await cleanup();

    const api = request(createApp());

    await test("POST creates request and returns requestId", async () => {
      const user = await seedUser("post-create");
      const token = issueAppAccessToken(user._id);
      const { subscription } = await seedSubscriptionWithDay({ user, remainingMeals: 10 });

      const res = await api
        .post(`/api/subscriptions/${subscription._id}/pickup-requests`)
        .set(auth(token))
        .send({ date: TODAY, mealCount: 2, idempotencyKey: `${TEST_TAG}-post-create` });

      assert.strictEqual(res.status, 200, JSON.stringify(res.body));
      assert.strictEqual(res.body.status, true);
      assert(res.body.data.requestId, "requestId should be returned");
      assert.strictEqual(res.body.data.status, "locked");
      assert.strictEqual(res.body.data.nextAction, "poll_pickup_request_status");
    });

    await test("POST reserves remainingMeals", async () => {
      const user = await seedUser("post-reserve");
      const token = issueAppAccessToken(user._id);
      const { subscription } = await seedSubscriptionWithDay({ user, remainingMeals: 10 });

      const res = await api
        .post(`/api/subscriptions/${subscription._id}/pickup-requests`)
        .set(auth(token))
        .send({ date: TODAY, mealCount: 3 });

      assert.strictEqual(res.status, 200, JSON.stringify(res.body));
      assert.strictEqual(await getRemainingMeals(subscription._id), 7);
    });

    await test("POST supports multiple requests same day", async () => {
      const user = await seedUser("post-multiple");
      const token = issueAppAccessToken(user._id);
      const { subscription } = await seedSubscriptionWithDay({ user, remainingMeals: 10 });

      const first = await api
        .post(`/api/subscriptions/${subscription._id}/pickup-requests`)
        .set(auth(token))
        .send({ date: TODAY, mealCount: 2 });
      const second = await api
        .post(`/api/subscriptions/${subscription._id}/pickup-requests`)
        .set(auth(token))
        .send({ date: TODAY, mealCount: 3 });

      assert.strictEqual(first.status, 200, JSON.stringify(first.body));
      assert.strictEqual(second.status, 200, JSON.stringify(second.body));
      assert.notStrictEqual(first.body.data.requestId, second.body.data.requestId);
      assert.strictEqual(await getRemainingMeals(subscription._id), 5);
    });

    await test("POST blocks insufficient credits", async () => {
      const user = await seedUser("post-insufficient");
      const token = issueAppAccessToken(user._id);
      const { subscription } = await seedSubscriptionWithDay({ user, remainingMeals: 1 });

      const res = await api
        .post(`/api/subscriptions/${subscription._id}/pickup-requests`)
        .set(auth(token))
        .send({ date: TODAY, mealCount: 2 });

      assert.strictEqual(res.status, 422, JSON.stringify(res.body));
      assert.strictEqual(res.body.error.code, "INSUFFICIENT_CREDITS");
      assert.strictEqual(await getRemainingMeals(subscription._id), 1);
    });

    await test("POST blocks courier subscription", async () => {
      const user = await seedUser("post-courier");
      const token = issueAppAccessToken(user._id);
      const { subscription } = await seedSubscriptionWithDay({ user, deliveryMode: "delivery", remainingMeals: 10 });

      const res = await api
        .post(`/api/subscriptions/${subscription._id}/pickup-requests`)
        .set(auth(token))
        .send({ date: TODAY, mealCount: 1 });

      assert.strictEqual(res.status, 400, JSON.stringify(res.body));
      assert.strictEqual(res.body.error.code, "INVALID_DELIVERY_MODE");
    });

    await test("GET list returns active requests", async () => {
      const user = await seedUser("list-active");
      const token = issueAppAccessToken(user._id);
      const { subscription } = await seedSubscriptionWithDay({ user, remainingMeals: 10 });

      await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(auth(token)).send({ date: TODAY, mealCount: 1 });
      await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(auth(token)).send({ date: TODAY, mealCount: 1 });
      await SubscriptionPickupRequest.create({
        subscriptionId: subscription._id,
        userId: user._id,
        date: TODAY,
        mealCount: 1,
        status: "fulfilled",
        creditsReserved: true,
        creditsConsumedAt: new Date(),
      });

      const res = await api
        .get(`/api/subscriptions/${subscription._id}/pickup-requests?date=${TODAY}&status=active`)
        .set(auth(token));

      assert.strictEqual(res.status, 200, JSON.stringify(res.body));
      assert.strictEqual(res.body.data.requests.length, 2);
      assert(res.body.data.requests.every((row) => ["locked", "in_preparation", "ready_for_pickup"].includes(row.status)));
    });

    await test("GET status returns status for specific request", async () => {
      const user = await seedUser("status-specific");
      const token = issueAppAccessToken(user._id);
      const { subscription } = await seedSubscriptionWithDay({ user, remainingMeals: 10 });
      const createRes = await api
        .post(`/api/subscriptions/${subscription._id}/pickup-requests`)
        .set(auth(token))
        .send({ date: TODAY, mealCount: 2 });

      const res = await api
        .get(`/api/subscriptions/${subscription._id}/pickup-requests/${createRes.body.data.requestId}/status`)
        .set(auth(token));

      assert.strictEqual(res.status, 200, JSON.stringify(res.body));
      assert.strictEqual(res.body.data.requestId, createRes.body.data.requestId);
      assert.strictEqual(res.body.data.currentStep, 2);
      assert.strictEqual(res.body.data.status, "locked");
    });

    await test("GET status does not expose pickupCode before ready_for_pickup", async () => {
      const user = await seedUser("status-code-hidden");
      const token = issueAppAccessToken(user._id);
      const { subscription } = await seedSubscriptionWithDay({ user, remainingMeals: 10 });
      const pickupRequest = await SubscriptionPickupRequest.create({
        subscriptionId: subscription._id,
        userId: user._id,
        date: TODAY,
        mealCount: 1,
        status: "locked",
        pickupCode: "123456",
        pickupCodeIssuedAt: new Date(),
        creditsReserved: true,
      });

      const res = await api
        .get(`/api/subscriptions/${subscription._id}/pickup-requests/${pickupRequest._id}/status`)
        .set(auth(token));

      assert.strictEqual(res.status, 200, JSON.stringify(res.body));
      assert.strictEqual(res.body.data.pickupCode, null);
      assert.strictEqual(res.body.data.pickupCodeIssuedAt, null);
    });

    await test("GET status returns 404 when request does not belong to subscription", async () => {
      const user = await seedUser("status-404");
      const token = issueAppAccessToken(user._id);
      const first = await seedSubscriptionWithDay({ user, remainingMeals: 10 });
      const second = await seedSubscriptionWithDay({ user, remainingMeals: 10 });
      const pickupRequest = await SubscriptionPickupRequest.create({
        subscriptionId: first.subscription._id,
        userId: user._id,
        date: TODAY,
        mealCount: 1,
        status: "locked",
      });

      const res = await api
        .get(`/api/subscriptions/${second.subscription._id}/pickup-requests/${pickupRequest._id}/status`)
        .set(auth(token));

      assert.strictEqual(res.status, 404, JSON.stringify(res.body));
    });

    await test("GET status returns 403 when request user does not match subscription owner", async () => {
      const user = await seedUser("status-403-owner");
      const otherUser = await seedUser("status-403-other");
      const token = issueAppAccessToken(user._id);
      const { subscription } = await seedSubscriptionWithDay({ user, remainingMeals: 10 });
      const pickupRequest = await SubscriptionPickupRequest.create({
        subscriptionId: subscription._id,
        userId: otherUser._id,
        date: TODAY,
        mealCount: 1,
        status: "locked",
      });

      const res = await api
        .get(`/api/subscriptions/${subscription._id}/pickup-requests/${pickupRequest._id}/status`)
        .set(auth(token));

      assert.strictEqual(res.status, 403, JSON.stringify(res.body));
    });
  } finally {
    await cleanup().catch(() => {});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log(`\nResult: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed > 0) process.exit(1);
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
