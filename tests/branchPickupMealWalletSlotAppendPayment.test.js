"use strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "supersecret";
process.env.DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || "dashboardsecret";
process.env.SUBSCRIPTION_AUTO_SETTLEMENT_ENABLED = "false";

require("dotenv").config();

const assert = require("assert");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");

const { createApp } = require("../src/app");
const User = require("../src/models/User");
const DashboardUser = require("../src/models/DashboardUser");
const Subscription = require("../src/models/Subscription");
const SubscriptionDay = require("../src/models/SubscriptionDay");
const SubscriptionPickupRequest = require("../src/models/SubscriptionPickupRequest");
const Setting = require("../src/models/Setting");
const BuilderProtein = require("../src/models/BuilderProtein");
const BuilderCarb = require("../src/models/BuilderCarb");
const MealCategory = require("../src/models/MealCategory");
const Meal = require("../src/models/Meal");
const SaladIngredient = require("../src/models/SaladIngredient");
const Sandwich = require("../src/models/Sandwich");
const dateUtils = require("../src/utils/date");
const { performDaySelectionUpdate } = require("../src/services/subscription/subscriptionSelectionService");
const { mapSubscriptionPickupRequestToDTO } = require("../src/services/dashboard/dashboardDtoService");
const { issueDashboardAccessToken } = require("../src/services/dashboardTokenService");

const TEST_TAG = `pickup-slot-append-${Date.now()}`;
const TODAY = dateUtils.getTodayKSADate();
const START_DATE = dateUtils.addDaysToKSADateString(TODAY, -7);
const END_DATE = dateUtils.addDaysToKSADateString(TODAY, 30);
const TEST_PLAN_ID = new mongoose.Types.ObjectId();
const IDS = {
  regularProtein: "507f191e810c19729de870a1",
  premiumProtein: "507f191e810c19729de870a2",
  carbOne: "507f191e810c19729de870b1",
};
const results = { passed: 0, failed: 0 };

function token(userId) {
  return jwt.sign(
    { userId: String(userId), role: "client", tokenType: "app_access" },
    process.env.JWT_SECRET,
    { expiresIn: "31d" }
  );
}

function auth(userToken) {
  return { Authorization: `Bearer ${userToken}` };
}

async function dashboardHeaders(role) {
  const user = await DashboardUser.create({
    email: `${TEST_TAG}-${role}-${Math.random().toString(36).slice(2)}@example.com`,
    passwordHash: "test-only",
    role,
    isActive: true,
  });
  return {
    Authorization: `Bearer ${issueDashboardAccessToken(user)}`,
    "Accept-Language": "en",
  };
}

async function dashboardAction(api, headers, action, requestId, payload = {}) {
  return api.post(`/api/dashboard/ops/actions/${action}`).set(headers).send({
    entityType: "subscription_pickup_request",
    entityId: String(requestId),
    payload,
  });
}

async function fulfillPickupRequest(api, headers, requestId) {
  await dashboardAction(api, headers, "start_preparation", requestId);
  await dashboardAction(api, headers, "ready_for_pickup", requestId);
  return dashboardAction(api, headers, "fulfill", requestId);
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
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/basicdiet_test");
  }
}

async function cleanup() {
  const users = await User.find({ phone: { $regex: TEST_TAG } }).select("_id").lean();
  const userIds = users.map((user) => user._id);
  const subs = await Subscription.find({ userId: { $in: userIds } }).select("_id").lean();
  const subIds = subs.map((sub) => sub._id);
  await Promise.all([
    SubscriptionPickupRequest.deleteMany({ $or: [{ userId: { $in: userIds } }, { subscriptionId: { $in: subIds } }] }),
    SubscriptionDay.deleteMany({ subscriptionId: { $in: subIds } }),
    Subscription.deleteMany({ _id: { $in: subIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
    DashboardUser.deleteMany({ email: { $regex: `^${TEST_TAG}` } }),
    Setting.deleteMany({ key: { $in: ["restaurant_open_time", "restaurant_close_time", "restaurant_is_open"] } }),
  ]);
}

async function seedSettings() {
  await Setting.deleteMany({ key: { $in: ["restaurant_open_time", "restaurant_close_time", "restaurant_is_open"] } });
  await Setting.create([
    { key: "restaurant_open_time", value: "00:00" },
    { key: "restaurant_close_time", value: "00:00" },
    { key: "restaurant_is_open", value: true },
  ]);
}

async function seedUser(label) {
  return User.create({ phone: `${TEST_TAG}-${label}`, name: label, role: "client", isActive: true });
}

function mealSlot(slotIndex, overrides = {}) {
  return {
    slotIndex,
    slotKey: `slot_${slotIndex}`,
    status: "complete",
    selectionType: "standard_meal",
    productId: new mongoose.Types.ObjectId(),
    productKey: `product_${slotIndex}`,
    selectedOptions: [],
    displaySnapshot: { product: { name: { en: `Meal ${slotIndex}`, ar: `Meal ${slotIndex}` } } },
    fulfillmentSnapshot: { operationalSku: `sku_${slotIndex}`, kitchenLabel: `Meal ${slotIndex}` },
    isPremium: false,
    premiumSource: "none",
    ...overrides,
  };
}

async function seedSubscriptionWithDay({ label, remainingMeals = 5, totalMeals = 10, slots = [mealSlot(1), mealSlot(2)] } = {}) {
  const user = await seedUser(label);
  const subscription = await Subscription.create({
    userId: user._id,
    planId: TEST_PLAN_ID,
    status: "active",
    startDate: new Date(`${START_DATE}T00:00:00Z`),
    endDate: new Date(`${END_DATE}T00:00:00Z`),
    validityEndDate: new Date(`${END_DATE}T00:00:00Z`),
    totalMeals,
    remainingMeals,
    selectedGrams: 200,
    selectedMealsPerDay: 1,
    contractMode: "canonical",
    deliveryMode: "pickup",
    pickupLocationId: "main",
  });
  const day = await SubscriptionDay.create({
    subscriptionId: subscription._id,
    date: TODAY,
    status: "open",
    plannerState: "confirmed",
    planningState: "confirmed",
    mealSlots: slots,
    plannerMeta: {
      requiredSlotCount: slots.length,
      completeSlotCount: slots.length,
      partialSlotCount: 0,
      isDraftValid: true,
      isConfirmable: true,
      confirmedAt: new Date(),
    },
  });
  return { user, subscription, day };
}

function mockQuery(result) {
  return {
    session() { return this; },
    lean() { return Promise.resolve(result); },
  };
}

async function withMockedPlannerCatalog(fn) {
  const originals = {
    proteinFind: BuilderProtein.find,
    carbFind: BuilderCarb.find,
    categoryFindOne: MealCategory.findOne,
    mealFind: Meal.find,
    saladFind: SaladIngredient.find,
    sandwichFind: Sandwich.find,
  };
  BuilderProtein.find = () => mockQuery([
    { _id: IDS.regularProtein, isPremium: false, premiumKey: null, displayCategoryKey: "chicken", proteinFamilyKey: "chicken", ruleTags: [], extraFeeHalala: 0 },
    { _id: IDS.premiumProtein, isPremium: true, premiumKey: "shrimp", displayCategoryKey: "premium", proteinFamilyKey: "fish", ruleTags: ["premium"], extraFeeHalala: 1500 },
  ]);
  BuilderCarb.find = () => mockQuery([{ _id: IDS.carbOne, isActive: true, availableForSubscription: true, displayCategoryKey: "standard_carbs" }]);
  MealCategory.findOne = () => mockQuery(null);
  Meal.find = () => mockQuery([]);
  SaladIngredient.find = () => mockQuery([]);
  Sandwich.find = () => mockQuery([]);
  try {
    await fn();
  } finally {
    BuilderProtein.find = originals.proteinFind;
    BuilderCarb.find = originals.carbFind;
    MealCategory.findOne = originals.categoryFindOne;
    Meal.find = originals.mealFind;
    SaladIngredient.find = originals.saladFind;
    Sandwich.find = originals.sandwichFind;
  }
}

function legacySlot({ premium = false } = {}) {
  return {
    slotIndex: 1,
    selectionType: premium ? "premium_meal" : "standard_meal",
    proteinId: premium ? IDS.premiumProtein : IDS.regularProtein,
    carbs: [{ carbId: IDS.carbOne, grams: 150 }],
  };
}

(async function run() {
  try {
    await connect();
    await cleanup();
    await seedSettings();
    const api = request(createApp());
    const kitchenHeaders = await dashboardHeaders("kitchen");
    const adminHeaders = await dashboardHeaders("admin");

    await test("slot-based pickup request reserves selected slot only", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "slot-create" });
      const res = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`)
        .set(auth(token(user._id)))
        .send({ date: TODAY, selectedMealSlotIds: ["slot_1"], idempotencyKey: `${TEST_TAG}-slot-create` });
      assert.strictEqual(res.status, 200, JSON.stringify(res.body));
      assert.deepStrictEqual(res.body.data.selectedMealSlotIds, ["slot_1"]);
      const stored = await SubscriptionPickupRequest.findById(res.body.data.requestId).lean();
      assert.strictEqual(stored.mealCount, 1);
      assert.strictEqual(stored.selectionMode, "slot_ids");
      assert.strictEqual(stored.snapshot.mealSlots.length, 1);
      const sub = await Subscription.findById(subscription._id).lean();
      assert.strictEqual(sub.remainingMeals, 4);
    });

    await test("same slot reuse is blocked while another request reserves it", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "reuse-block" });
      const headers = auth(token(user._id));
      const first = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(first.status, 200, JSON.stringify(first.body));
      const second = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(second.status, 422, JSON.stringify(second.body));
      assert.strictEqual(second.body.error.code, "MEAL_SLOT_UNAVAILABLE");
    });

    await test("multiple same-date requests can select different slots", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "multi-slot" });
      const headers = auth(token(user._id));
      const first = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      const second = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_2"] });
      assert.strictEqual(first.status, 200, JSON.stringify(first.body));
      assert.strictEqual(second.status, 200, JSON.stringify(second.body));
      const sub = await Subscription.findById(subscription._id).lean();
      assert.strictEqual(sub.remainingMeals, 3);
    });

    await test("pickup availability hides reserved and unpaid slots", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({
        label: "availability",
        slots: [mealSlot(1), mealSlot(2, { isPremium: true, premiumSource: "pending_payment", premiumExtraFeeHalala: 1500 })],
      });
      const headers = auth(token(user._id));
      await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      const res = await api.get(`/api/subscriptions/${subscription._id}/pickup-availability?date=${TODAY}`).set(headers);
      assert.strictEqual(res.status, 200, JSON.stringify(res.body));
      assert.deepStrictEqual(res.body.data.availableSlotIds, []);
      const reasons = new Map(res.body.data.slots.map((slot) => [slot.slotId, slot.unavailableReason]));
      assert.strictEqual(reasons.get("slot_1"), "SLOT_ALREADY_RESERVED");
      assert.strictEqual(reasons.get("slot_2"), "PREMIUM_PAYMENT_REQUIRED");
    });

    await test("idempotency returns same request for same payload and conflicts on changed payload", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "idempotency" });
      const headers = auth(token(user._id));
      const body = { date: TODAY, selectedMealSlotIds: ["slot_1"], idempotencyKey: `${TEST_TAG}-idem` };
      const first = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send(body);
      const retry = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send(body);
      const conflict = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ ...body, selectedMealSlotIds: ["slot_2"] });
      assert.strictEqual(first.status, 200, JSON.stringify(first.body));
      assert.strictEqual(retry.status, 200, JSON.stringify(retry.body));
      assert.strictEqual(retry.body.data.requestId, first.body.data.requestId);
      assert.strictEqual(conflict.status, 409, JSON.stringify(conflict.body));
      assert.strictEqual(conflict.body.error.code, "IDEMPOTENCY_CONFLICT");
    });

    await test("legacy mealCount cannot bypass reserved slot availability", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "legacy-safe" });
      const headers = auth(token(user._id));
      await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      const res = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, mealCount: 2 });
      assert.strictEqual(res.status, 422, JSON.stringify(res.body));
      assert.strictEqual(res.body.error.code, "MEAL_SLOT_UNAVAILABLE");
    });

    await test("dashboard pickup snapshot includes exact selected slot only", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "dashboard-snapshot" });
      const headers = auth(token(user._id));
      const res = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_2"] });
      const pickup = await SubscriptionPickupRequest.findById(res.body.data.requestId).lean();
      const dto = mapSubscriptionPickupRequestToDTO(pickup, subscription, user, "kitchen", "en");
      assert.strictEqual(dto.entityType, "subscription_pickup_request");
      assert.strictEqual(dto.kitchenDetails.mealSlots.length, 1);
      assert.strictEqual(dto.kitchenDetails.mealSlots[0].slotKey, "slot_2");
      assert.strictEqual(dto.paymentValidity.canPrepare, true);
    });

    await test("dashboard pickup queue returns separate request rows with selected-only meals", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "dashboard-queue" });
      const headers = auth(token(user._id));
      const first = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      const second = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_2"] });
      assert.strictEqual(first.status, 200, JSON.stringify(first.body));
      assert.strictEqual(second.status, 200, JSON.stringify(second.body));

      const queue = await api.get(`/api/dashboard/pickup/queue?date=${TODAY}`).set(kitchenHeaders);
      assert.strictEqual(queue.status, 200, JSON.stringify(queue.body));
      const rows = queue.body.data.items.filter((item) => [
        first.body.data.requestId,
        second.body.data.requestId,
      ].includes(item.ids.pickupRequestId));
      assert.strictEqual(rows.length, 2, JSON.stringify(queue.body.data.items));
      const byId = new Map(rows.map((row) => [row.ids.pickupRequestId, row]));
      assert.strictEqual(byId.get(first.body.data.requestId).ids.entityType, "subscription_pickup_request");
      assert.deepStrictEqual(byId.get(first.body.data.requestId).kitchen.meals.map((meal) => meal.slotKey), ["slot_1"]);
      assert.deepStrictEqual(byId.get(second.body.data.requestId).kitchen.meals.map((meal) => meal.slotKey), ["slot_2"]);
    });

    await test("append basic slots is wallet-neutral and adds after max slotIndex", async () => {
      await withMockedPlannerCatalog(async () => {
        const existingSlot = { ...legacySlot(), slotIndex: 1, slotKey: "slot_1", status: "complete" };
        const { user, subscription, day } = await seedSubscriptionWithDay({ label: "append-basic", slots: [existingSlot], totalMeals: 3, remainingMeals: 3 });
        await performDaySelectionUpdate({
          userId: user._id,
          subscriptionId: subscription._id,
          date: TODAY,
          mealSlots: [legacySlot()],
          appendOnly: true,
        });
        const updated = await SubscriptionDay.findById(day._id).lean();
        assert.deepStrictEqual(updated.mealSlots.map((slot) => slot.slotIndex), [1, 2]);
        assert.strictEqual(updated.mealSlots[0].slotKey, "slot_1", "old slot is preserved");
        assert.strictEqual(updated.mealSlots[1].slotKey, "slot_2", "new slot is appended after max slotIndex");
        const sub = await Subscription.findById(subscription._id).lean();
        assert.strictEqual(sub.remainingMeals, 3);
        const availability = await api.get(`/api/subscriptions/${subscription._id}/pickup-availability?date=${TODAY}`).set(auth(token(user._id)));
        assert.strictEqual(availability.status, 200, JSON.stringify(availability.body));
        assert(availability.body.data.availableSlotIds.includes("slot_2"), "appended basic slot should be available");
      });
    });

    await test("append premium unpaid slot blocks pickup until simulated settlement", async () => {
      await withMockedPlannerCatalog(async () => {
        const existingSlot = { ...legacySlot(), slotIndex: 1, slotKey: "slot_1", status: "complete" };
        const { user, subscription, day } = await seedSubscriptionWithDay({ label: "append-premium", slots: [existingSlot], totalMeals: 2, remainingMeals: 5 });
        const result = await performDaySelectionUpdate({
          userId: user._id,
          subscriptionId: subscription._id,
          date: TODAY,
          mealSlots: [legacySlot({ premium: true })],
          appendOnly: true,
        });
        assert.strictEqual(result.paymentRequirement.requiresPayment, true);
        assert.strictEqual(result.paymentRequirement.blockingReason, "PREMIUM_PAYMENT_REQUIRED");

        let availability = await api.get(`/api/subscriptions/${subscription._id}/pickup-availability?date=${TODAY}`).set(auth(token(user._id)));
        assert.strictEqual(availability.status, 200, JSON.stringify(availability.body));
        const appendedPremium = availability.body.data.slots.find((slot) => slot.slotId === "slot_2");
        assert(appendedPremium, "appended premium slot should be listed");
        assert.strictEqual(appendedPremium.available, false);
        assert.strictEqual(appendedPremium.unavailableReason, "PREMIUM_PAYMENT_REQUIRED");
        const blocked = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`)
          .set(auth(token(user._id)))
          .send({ date: TODAY, selectedMealSlotIds: ["slot_2"] });
        assert.strictEqual(blocked.status, 422, JSON.stringify(blocked.body));
        assert.strictEqual(blocked.body.error.code, "PREMIUM_PAYMENT_REQUIRED");

        await SubscriptionDay.updateOne(
          { _id: day._id, "mealSlots.slotKey": "slot_2" },
          { $set: { "mealSlots.$.premiumSource": "paid_extra", "mealSlots.$.premiumExtraFeeHalala": 0 } }
        );
        availability = await api.get(`/api/subscriptions/${subscription._id}/pickup-availability?date=${TODAY}`).set(auth(token(user._id)));
        assert.strictEqual(availability.status, 200, JSON.stringify(availability.body));
        assert(availability.body.data.availableSlotIds.includes("slot_2"), "paid appended premium slot should be available");
        const created = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`)
          .set(auth(token(user._id)))
          .send({ date: TODAY, selectedMealSlotIds: ["slot_2"] });
        assert.strictEqual(created.status, 200, JSON.stringify(created.body));

        await assert.rejects(
          () => performDaySelectionUpdate({
            userId: user._id,
            subscriptionId: subscription._id,
            date: TODAY,
            mealSlots: [legacySlot()],
            appendOnly: true,
          }),
          (err) => err && err.code === "MEAL_PLANNING_LIMIT_EXCEEDED"
        );
      });
    });

    await test("unpaid addon blocks pickup creation until simulated settlement", async () => {
      const { user, subscription, day } = await seedSubscriptionWithDay({ label: "addon-unpaid", slots: [mealSlot(1)] });
      await SubscriptionDay.updateOne(
        { _id: day._id },
        {
          $set: {
            addonSelections: [{
              addonId: new mongoose.Types.ObjectId(),
              name: "Addon",
              category: "extra",
              source: "pending_payment",
              priceHalala: 500,
              currency: "SAR",
            }],
          },
        }
      );
      const headers = auth(token(user._id));
      let availability = await api.get(`/api/subscriptions/${subscription._id}/pickup-availability?date=${TODAY}`).set(headers);
      assert.strictEqual(availability.status, 200, JSON.stringify(availability.body));
      assert.strictEqual(availability.body.data.slots[0].available, false);
      assert.strictEqual(availability.body.data.slots[0].unavailableReason, "ADDON_PAYMENT_REQUIRED");
      let create = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(create.status, 422, JSON.stringify(create.body));
      assert(["ADDON_PAYMENT_REQUIRED", "PENDING_ADDON_PAYMENT"].includes(create.body.error.code), create.body.error.code);

      await SubscriptionDay.updateOne({ _id: day._id, "addonSelections.source": "pending_payment" }, { $set: { "addonSelections.$.source": "paid" } });
      availability = await api.get(`/api/subscriptions/${subscription._id}/pickup-availability?date=${TODAY}`).set(headers);
      assert.strictEqual(availability.status, 200, JSON.stringify(availability.body));
      assert.deepStrictEqual(availability.body.data.availableSlotIds, ["slot_1"]);
      create = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(create.status, 200, JSON.stringify(create.body));
    });

    await test("cancel releases credits and makes selected slot reusable", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "cancel-reuse", remainingMeals: 2, slots: [mealSlot(1)] });
      const headers = auth(token(user._id));
      const first = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(first.status, 200, JSON.stringify(first.body));
      let sub = await Subscription.findById(subscription._id).lean();
      assert.strictEqual(sub.remainingMeals, 1);
      const cancel = await dashboardAction(api, adminHeaders, "cancel", first.body.data.requestId, { reason: "customer_cancelled" });
      assert.strictEqual(cancel.status, 200, JSON.stringify(cancel.body));
      sub = await Subscription.findById(subscription._id).lean();
      assert.strictEqual(sub.remainingMeals, 2);
      const second = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(second.status, 200, JSON.stringify(second.body));
      assert.notStrictEqual(second.body.data.requestId, first.body.data.requestId);
    });

    await test("no-show consumes credits and leaves selected slot unavailable", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "no-show-lock", remainingMeals: 2, slots: [mealSlot(1)] });
      const headers = auth(token(user._id));
      const requestRes = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(requestRes.status, 200, JSON.stringify(requestRes.body));
      await dashboardAction(api, kitchenHeaders, "start_preparation", requestRes.body.data.requestId);
      await dashboardAction(api, kitchenHeaders, "ready_for_pickup", requestRes.body.data.requestId);
      const noShow = await dashboardAction(api, adminHeaders, "no_show", requestRes.body.data.requestId, { reason: "customer_no_show" });
      assert.strictEqual(noShow.status, 200, JSON.stringify(noShow.body));
      const sub = await Subscription.findById(subscription._id).lean();
      assert.strictEqual(sub.remainingMeals, 1);
      const retry = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(retry.status, 422, JSON.stringify(retry.body));
      assert.strictEqual(retry.body.error.code, "MEAL_SLOT_UNAVAILABLE");
    });

    await test("fulfill consumes once and duplicate fulfill does not double decrement or release slot", async () => {
      const { user, subscription } = await seedSubscriptionWithDay({ label: "fulfill-once", remainingMeals: 2, slots: [mealSlot(1)] });
      const headers = auth(token(user._id));
      const requestRes = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(requestRes.status, 200, JSON.stringify(requestRes.body));
      assert.strictEqual((await Subscription.findById(subscription._id).lean()).remainingMeals, 1);
      const fulfill = await fulfillPickupRequest(api, kitchenHeaders, requestRes.body.data.requestId);
      assert.strictEqual(fulfill.status, 200, JSON.stringify(fulfill.body));
      assert.strictEqual((await Subscription.findById(subscription._id).lean()).remainingMeals, 1);
      const duplicate = await dashboardAction(api, kitchenHeaders, "fulfill", requestRes.body.data.requestId);
      assert.strictEqual(duplicate.status, 409, JSON.stringify(duplicate.body));
      assert.strictEqual((await Subscription.findById(subscription._id).lean()).remainingMeals, 1);
      const retry = await api.post(`/api/subscriptions/${subscription._id}/pickup-requests`).set(headers).send({ date: TODAY, selectedMealSlotIds: ["slot_1"] });
      assert.strictEqual(retry.status, 422, JSON.stringify(retry.body));
    });
  } finally {
    await cleanup();
    await mongoose.disconnect();
    console.log(`\nBranch pickup slot append tests: ${results.passed} passed, ${results.failed} failed`);
    if (results.failed > 0) process.exit(1);
  }
})();
