"use strict";

require("dotenv").config();

const assert = require("assert");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");

const { createApp } = require("../src/app");
const User = require("../src/models/User");
const Subscription = require("../src/models/Subscription");
const SubscriptionDay = require("../src/models/SubscriptionDay");
const CheckoutDraft = require("../src/models/CheckoutDraft");
const Plan = require("../src/models/Plan");
const Zone = require("../src/models/Zone");
const Setting = require("../src/models/Setting");
const Payment = require("../src/models/Payment");
const { dashboardAuth } = require("./helpers/dashboardAuthHelper");
const { finalizeSubscriptionDraftPaymentFlow } = require("../src/services/subscription/subscriptionActivationService");
const { resolveMongoUri } = require("../src/utils/mongoUriResolver");
const dateUtils = require("../src/utils/date");

const TEST_TAG = `first-day-override-${Date.now()}`;
const results = { passed: 0, failed: 0 };

function clientAuth(userId) {
  return {
    Authorization: `Bearer ${jwt.sign({ userId: String(userId), role: "client", tokenType: "app_access" }, process.env.JWT_SECRET || "supersecret", { expiresIn: "31d" })}`,
    "Accept-Language": "en",
  };
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

let app, api, testUser, testPlan, testZone, branchId;

async function setup() {
  const mongoUri = resolveMongoUri();
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
  app = createApp();
  api = request(app);

  testUser = await User.create({
    phone: `+96650999${Math.floor(Math.random() * 10000)}`,
    name: `${TEST_TAG} User`,
    role: "client",
    isActive: true,
  });

  testPlan = await Plan.create({
    key: `${TEST_TAG}-plan`,
    name: { ar: "خطة", en: `${TEST_TAG} Plan` },
    daysCount: 6,
    durationDays: 7,
    currency: "SAR",
    gramsOptions: [{
      grams: 200,
      isActive: true,
      mealsOptions: [{ mealsPerDay: 2, priceHalala: 60000, compareAtHalala: 60000, isActive: true }],
    }],
    isActive: true,
  });

  testZone = await Zone.create({
    name: { ar: "منطقة", en: "Override Zone" },
    deliveryFeeHalala: 1000,
    isActive: true,
  });

  branchId = "branch_main_override";
  await Setting.deleteMany({ key: { $in: ["pickup_locations", "delivery_windows", "restaurant_open_time", "restaurant_close_time", "restaurant_is_open"] } });
  await Setting.create([
    { key: "pickup_locations", value: [{ id: branchId, locationId: branchId, name: { ar: "الفرع", en: "Branch" }, address: { street: "Branch St" }, isActive: true }] },
    { key: "delivery_windows", value: ["16:00-18:00"] },
    { key: "restaurant_open_time", value: "00:00" },
    { key: "restaurant_close_time", value: "23:59" },
    { key: "restaurant_is_open", value: true },
  ]);
}

async function cleanup() {
  await CheckoutDraft.deleteMany({ userId: testUser._id });
  const subs = await Subscription.find({ userId: testUser._id }).lean();
  for (const sub of subs) {
    await SubscriptionDay.deleteMany({ subscriptionId: sub._id });
  }
  await Subscription.deleteMany({ userId: testUser._id });
  await User.deleteOne({ _id: testUser._id });
  await Plan.deleteOne({ _id: testPlan._id });
  await Zone.deleteOne({ _id: testZone._id });
}

(async function run() {
  await setup();
  const { headers: adminHeaders } = await dashboardAuth("admin", TEST_TAG);

  try {
    const startDate = dateUtils.getTodayKSADate();
    const sd = new Date(`${startDate}T12:00:00Z`);
    sd.setDate(sd.getDate() + 1);
    const secondDate = sd.toISOString().split("T")[0];

    let normalSubscriptionId;
    await test("1. Existing delivery subscription without override", async () => {
      const payload = {
        planId: String(testPlan._id),
        grams: 200,
        mealsPerDay: 2,
        startDate,
        delivery: {
          type: "delivery",
          address: { street: "Normal Delivery St", city: "Riyadh" },
          zoneId: String(testZone._id),
          slot: { slotId: "delivery_slot_1" },
        },
        idempotencyKey: `normal_${TEST_TAG}`,
      };

      const res = await api.post("/api/subscriptions/checkout").set(clientAuth(testUser._id)).send(payload);
      assert.strictEqual(res.status, 201, JSON.stringify(res.body));
      const draft = await CheckoutDraft.findById(res.body.data.draftId).lean();
      assert.strictEqual(draft.delivery.firstDayFulfillmentOverride, null);

      const payment = await Payment.create({
        userId: testUser._id, draftId: draft._id, type: "subscription_activation",
        amount: draft.breakdown.totalHalala, currency: "SAR", status: "paid", provider: "moyasar",
      });
      const act = await finalizeSubscriptionDraftPaymentFlow({ draft, payment }, null);
      normalSubscriptionId = act.subscriptionId;

      const sub = await Subscription.findById(normalSubscriptionId).lean();
      assert.strictEqual(sub.deliveryMode, "delivery");

      const days = await SubscriptionDay.find({ subscriptionId: normalSubscriptionId }).sort("date").lean();
      assert.strictEqual(days[0].fulfillmentModeOverride, null);

      const statusRes = await api.get(`/api/subscriptions/${normalSubscriptionId}/days/${startDate}/fulfillment/status`).set(clientAuth(testUser._id));
      assert.strictEqual(statusRes.status, 200);
      assert.strictEqual(statusRes.body.data.deliveryMode, "delivery");
      assert.strictEqual(statusRes.body.data.firstDayFulfillmentOverride, false);

      const availRes = await api.get(`/api/subscriptions/${normalSubscriptionId}/pickup-availability?date=${startDate}`).set(clientAuth(testUser._id));
      assert.strictEqual(availRes.status, 400, JSON.stringify(availRes.body));
      assert.strictEqual(availRes.body.error.code, "INVALID_DELIVERY_MODE");

      const reqRes = await api.post(`/api/subscriptions/${normalSubscriptionId}/pickup-requests`).set(clientAuth(testUser._id)).send({ date: startDate, mealCount: 1 });
      assert.strictEqual(reqRes.status, 400, JSON.stringify(reqRes.body));
      assert.strictEqual(reqRes.body.error.code, "INVALID_DELIVERY_MODE");
    });

    let overrideSubscriptionId;
    await test("2. Delivery subscription with first-day pickup override", async () => {
      const payload = {
        planId: String(testPlan._id),
        grams: 200,
        mealsPerDay: 2,
        startDate,
        delivery: {
          type: "delivery",
          address: { street: "Override St", city: "Riyadh", district: "Olaya" },
          zoneId: String(testZone._id),
          slot: { slotId: "delivery_slot_1" },
          firstDayFulfillmentOverride: {
            type: "pickup",
            pickupLocationId: branchId,
          },
        },
        idempotencyKey: `override_${TEST_TAG}`,
      };

      const res = await api.post("/api/subscriptions/checkout").set(clientAuth(testUser._id)).send(payload);
      assert.strictEqual(res.status, 201, JSON.stringify(res.body));
      const draft = await CheckoutDraft.findById(res.body.data.draftId).lean();
      assert.strictEqual(draft.delivery.firstDayFulfillmentOverride.type, "pickup");
      assert.strictEqual(draft.delivery.firstDayFulfillmentOverride.pickupLocationId, branchId);

      const payment = await Payment.create({
        userId: testUser._id, draftId: draft._id, type: "subscription_activation",
        amount: draft.breakdown.totalHalala, currency: "SAR", status: "paid", provider: "moyasar",
      });
      const act = await finalizeSubscriptionDraftPaymentFlow({ draft, payment }, null);
      overrideSubscriptionId = act.subscriptionId;

      const sub = await Subscription.findById(overrideSubscriptionId).lean();
      assert.strictEqual(sub.deliveryMode, "delivery");
      assert.strictEqual(sub.deliveryAddress.street, "Override St");

      const days = await SubscriptionDay.find({ subscriptionId: overrideSubscriptionId }).sort("date").lean();
      assert.strictEqual(days[0].fulfillmentModeOverride, "pickup");
      assert.strictEqual(days[0].pickupLocationIdOverride, branchId);

      assert.strictEqual(days[1].fulfillmentModeOverride, null);
      assert.strictEqual(days[1].pickupLocationIdOverride, null);
    });

    await test("3. Pickup policy behavior", async () => {
      const avail1 = await api.get(`/api/subscriptions/${overrideSubscriptionId}/pickup-availability?date=${startDate}`).set(clientAuth(testUser._id));
      assert.strictEqual(avail1.status, 200, JSON.stringify(avail1.body));

      const req1 = await api.post(`/api/subscriptions/${overrideSubscriptionId}/pickup-requests`).set(clientAuth(testUser._id)).send({ date: startDate, mealCount: 1 });
      assert.strictEqual(req1.status, 200, JSON.stringify(req1.body));

      const avail2 = await api.get(`/api/subscriptions/${overrideSubscriptionId}/pickup-availability?date=${secondDate}`).set(clientAuth(testUser._id));
      assert.strictEqual(avail2.status, 400, JSON.stringify(avail2.body));
      assert.strictEqual(avail2.body.error.code, "INVALID_DELIVERY_MODE");

      const req2 = await api.post(`/api/subscriptions/${overrideSubscriptionId}/pickup-requests`).set(clientAuth(testUser._id)).send({ date: secondDate, mealCount: 1 });
      assert.strictEqual(req2.status, 400, JSON.stringify(req2.body));
      assert.strictEqual(req2.body.error.code, "INVALID_DELIVERY_MODE");
    });

    await test("4. Delivery/operations queue behavior", async () => {
      const ops1 = await api.get(`/api/dashboard/ops/list?date=${startDate}`).set(adminHeaders);
      assert.strictEqual(ops1.status, 200, JSON.stringify(ops1.body));
      
      const day1 = await SubscriptionDay.findOne({ subscriptionId: overrideSubscriptionId, date: startDate }).lean();
      const day1Dto = ops1.body.data.find(item => item.entityType === "subscription_day" && String(item.entityId) === String(day1._id));
      assert(!day1Dto, "subscription day DTO should be filtered out from ops because active pickup request exists for pickup mode");

      const statusRes1 = await api.get(`/api/subscriptions/${overrideSubscriptionId}/days/${startDate}/fulfillment/status`).set(clientAuth(testUser._id));
      assert.strictEqual(statusRes1.status, 200);
      assert.strictEqual(statusRes1.body.data.deliveryMode, "delivery");
      assert.strictEqual(statusRes1.body.data.fulfillmentModeOverride, "pickup");
      assert.strictEqual(statusRes1.body.data.effectiveFulfillmentMode, "pickup");
      assert.strictEqual(statusRes1.body.data.pickupLocationIdOverride, branchId);
      assert.strictEqual(statusRes1.body.data.firstDayFulfillmentOverride, true);

      const statusRes2 = await api.get(`/api/subscriptions/${overrideSubscriptionId}/days/${secondDate}/fulfillment/status`).set(clientAuth(testUser._id));
      assert.strictEqual(statusRes2.status, 200);
      assert.strictEqual(statusRes2.body.data.deliveryMode, "delivery");
      assert.strictEqual(statusRes2.body.data.fulfillmentModeOverride, null);
      assert.strictEqual(statusRes2.body.data.effectiveFulfillmentMode, "delivery");
      assert.strictEqual(statusRes2.body.data.pickupLocationIdOverride, null);
      assert.strictEqual(statusRes2.body.data.firstDayFulfillmentOverride, false);

      // Advance both days to in_preparation status so they appear in courier board default statuses
      // (courier board default statuses: ["in_preparation", "out_for_delivery", "fulfilled", "delivery_canceled"])
      await SubscriptionDay.updateMany(
        { subscriptionId: overrideSubscriptionId, date: { $in: [startDate, secondDate] } },
        { $set: { status: "in_preparation", plannerState: "confirmed", planningState: "confirmed", plannerMeta: { completeSlotCount: 2 }, planningMeta: { selectedTotalMealCount: 2 }, mealSlots: [{ slotIndex: 1, slotKey: "slot_1", status: "complete", selectionType: "standard_meal", productKey: "p1" }] } }
      );

      // Use view=legacy to get the legacy raw format where subscriptionId is a root field.
      // The clean contract (default) wraps everything under ids.subscriptionId.
      // The courier queue (queryBoardDays) filters by subscription.deliveryMode, not day.fulfillmentModeOverride.
      // Both days belong to a delivery subscription, so both appear in method=delivery queue.
      const courier1 = await api.get(`/api/dashboard/courier/queue?date=${startDate}&method=delivery&view=legacy`).set(adminHeaders);
      assert.strictEqual(courier1.status, 200);
      const courier1Items = Array.isArray(courier1.body.data) ? courier1.body.data : (courier1.body.data && courier1.body.data.items ? courier1.body.data.items : []);
      const inCourier1 = courier1Items.some(item => item.subscriptionId === String(overrideSubscriptionId));
      assert.strictEqual(inCourier1, true, "day 1 (pickup override) appears in courier/delivery queue — parent subscription is delivery; ops/list handles exclusion separately when pickup request active");

      const courier2 = await api.get(`/api/dashboard/courier/queue?date=${secondDate}&method=delivery&view=legacy`).set(adminHeaders);
      assert.strictEqual(courier2.status, 200);
      const courier2Items = Array.isArray(courier2.body.data) ? courier2.body.data : (courier2.body.data && courier2.body.data.items ? courier2.body.data.items : []);
      const inCourier2 = courier2Items.some(item => item.subscriptionId === String(overrideSubscriptionId));
      assert.strictEqual(inCourier2, true, "second delivery day is included in delivery courier queue");
    });

    await test("5. Balances unaffected", async () => {
      const sub = await Subscription.findById(overrideSubscriptionId).lean();
      assert.strictEqual(sub.totalMeals, 12);
      assert.strictEqual(sub.remainingMeals, 11); // 1 meal reserved by pickup request on day 1
      assert.strictEqual(Array.isArray(sub.premiumBalance), true);
    });

    await test("6. Backward compatibility", async () => {
      const invalidPayload = {
        planId: String(testPlan._id), grams: 200, mealsPerDay: 2, startDate,
        delivery: { type: "delivery", address: { street: "St", city: "Riyadh" }, zoneId: String(testZone._id), slot: { slotId: "delivery_slot_1" }, firstDayFulfillmentOverride: { type: "pickup", pickupLocationId: "invalid_branch_xyz" } },
        idempotencyKey: `invalid_${TEST_TAG}`,
      };
      const resInvalid = await api.post("/api/subscriptions/checkout").set(clientAuth(testUser._id)).send(invalidPayload);
      assert.strictEqual(resInvalid.status, 400, JSON.stringify(resInvalid.body));

      const pickupPayload = {
        planId: String(testPlan._id), grams: 200, mealsPerDay: 2, startDate,
        delivery: { type: "pickup", pickupLocationId: branchId, firstDayFulfillmentOverride: { type: "pickup", pickupLocationId: branchId } },
        idempotencyKey: `pickup_${TEST_TAG}`,
      };
      const resPickup = await api.post("/api/subscriptions/checkout").set(clientAuth(testUser._id)).send(pickupPayload);
      assert.strictEqual(resPickup.status, 201, JSON.stringify(resPickup.body));
      const pickupDraft = await CheckoutDraft.findById(resPickup.body.data.draftId).lean();
      assert.strictEqual(pickupDraft.delivery.firstDayFulfillmentOverride, null, "unknown override on pickup subscription is ignored safely");
    });

  } finally {
    await cleanup().catch(() => {});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log(`\nResult: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed > 0) process.exit(1);
})();
