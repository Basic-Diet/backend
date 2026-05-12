"use strict";

const assert = require("assert");
const mongoose = require("mongoose");

const { resolvePickupPreparationState } = require("../src/services/subscription/subscriptionPickupPreparationService");
const { mapSubscriptionPickupRequestStatus } = require("../src/services/subscription/subscriptionPickupRequestClientService");

const TODAY = "2026-05-18";
const results = { passed: 0, failed: 0 };

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

function subscription(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    status: "active",
    deliveryMode: "pickup",
    remainingMeals: 5,
    selectedMealsPerDay: 1,
    validityEndDate: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

function completeDay(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    subscriptionId: new mongoose.Types.ObjectId(),
    date: TODAY,
    status: "open",
    pickupRequested: false,
    plannerState: "confirmed",
    planningState: "confirmed",
    selections: [new mongoose.Types.ObjectId()],
    plannerMeta: {
      requiredSlotCount: 1,
      completeSlotCount: 1,
      isDraftValid: true,
      isConfirmable: true,
      confirmedAt: new Date("2026-05-18T07:00:00Z"),
      confirmedByRole: "client",
    },
    planningMeta: {
      requiredMealCount: 1,
      selectedTotalMealCount: 1,
      isExactCountSatisfied: true,
      confirmedAt: new Date("2026-05-18T07:00:00Z"),
      confirmedByRole: "client",
    },
    ...overrides,
  };
}

function resolve(sub, day, deps = {}) {
  return resolvePickupPreparationState(sub, day, {
    lang: "en",
    getTodayKSADate: () => TODAY,
    ...deps,
  });
}

(async function run() {
  await test("pickup overview returns available when remainingMeals > 0 even if SubscriptionDay.status = fulfilled", async () => {
    const state = resolve(subscription({ remainingMeals: 3 }), completeDay({ status: "fulfilled" }));

    assert.strictEqual(state.flowStatus, "available");
    assert.strictEqual(state.canCreatePickupRequest, true);
    assert.strictEqual(state.mode, "multi_request");
  });

  await test("pickup overview returns available when previous SubscriptionPickupRequest is fulfilled and balance remains", async () => {
    const latestPickupRequest = mapSubscriptionPickupRequestStatus({
      _id: new mongoose.Types.ObjectId(),
      subscriptionId: new mongoose.Types.ObjectId(),
      date: TODAY,
      mealCount: 2,
      status: "fulfilled",
      pickupCode: "123456",
      pickupCodeIssuedAt: new Date("2026-05-18T10:00:00Z"),
      fulfilledAt: new Date("2026-05-18T10:30:00Z"),
      creditsReserved: true,
      createdAt: new Date("2026-05-18T09:00:00Z"),
    }, { includeNextAction: false });

    const state = resolve(subscription({ remainingMeals: 4 }), completeDay({ status: "fulfilled" }), {
      latestPickupRequest,
      activePickupRequestCount: 0,
    });

    assert.strictEqual(state.flowStatus, "available");
    assert.strictEqual(state.canCreatePickupRequest, true);
    assert.strictEqual(state.latestPickupRequest.status, "fulfilled");
    assert.strictEqual(state.latestPickupRequest.pickupCode, "123456");
  });

  await test("pickup overview returns disabled / INSUFFICIENT_CREDITS when remainingMeals = 0", async () => {
    const state = resolve(subscription({ remainingMeals: 0 }), completeDay());

    assert.strictEqual(state.flowStatus, "disabled");
    assert.strictEqual(state.reason, "INSUFFICIENT_CREDITS");
    assert.strictEqual(state.canCreatePickupRequest, false);
    assert.strictEqual(state.availableMealBalance, 0);
  });

  await test("pickup overview includes activePickupRequestCount", async () => {
    const state = resolve(subscription({ remainingMeals: 5 }), completeDay(), {
      activePickupRequestCount: 2,
    });

    assert.strictEqual(state.flowStatus, "available");
    assert.strictEqual(state.activePickupRequestCount, 2);
  });

  await test("pickup overview latestPickupRequest maps status correctly", async () => {
    const latestPickupRequest = mapSubscriptionPickupRequestStatus({
      _id: new mongoose.Types.ObjectId(),
      subscriptionId: new mongoose.Types.ObjectId(),
      date: TODAY,
      mealCount: 1,
      status: "in_preparation",
      creditsReserved: true,
      createdAt: new Date("2026-05-18T09:00:00Z"),
    }, { includeNextAction: false });
    const state = resolve(subscription({ remainingMeals: 5 }), completeDay(), {
      latestPickupRequest,
      activePickupRequestCount: 1,
    });

    assert.strictEqual(state.latestPickupRequest.status, "in_preparation");
    assert.strictEqual(state.latestPickupRequest.currentStep, 3);
    assert.strictEqual(state.latestPickupRequest.isReady, false);
    assert.strictEqual(state.latestPickupRequest.isCompleted, false);
  });

  await test("pickup overview does not expose pickupCode before ready_for_pickup", async () => {
    const latestPickupRequest = mapSubscriptionPickupRequestStatus({
      _id: new mongoose.Types.ObjectId(),
      subscriptionId: new mongoose.Types.ObjectId(),
      date: TODAY,
      mealCount: 1,
      status: "locked",
      pickupCode: "123456",
      pickupCodeIssuedAt: new Date("2026-05-18T09:00:00Z"),
      creditsReserved: true,
      createdAt: new Date("2026-05-18T08:00:00Z"),
    }, { includeNextAction: false });

    const state = resolve(subscription({ remainingMeals: 5 }), completeDay(), { latestPickupRequest });

    assert.strictEqual(state.latestPickupRequest.pickupCode, null);
    assert.strictEqual(state.latestPickupRequest.pickupCodeIssuedAt, null);
  });

  await test("courier overview behavior remains unchanged for completed/locked day", async () => {
    const completed = resolve(subscription({ deliveryMode: "delivery" }), completeDay({ status: "fulfilled" }));
    const locked = resolve(subscription({ deliveryMode: "delivery" }), completeDay({ status: "locked" }));

    assert.strictEqual(completed.flowStatus, "hidden");
    assert.strictEqual(locked.flowStatus, "hidden");
  });

  await test("skipped/frozen day still disabled for pickup", async () => {
    const skipped = resolve(subscription({ remainingMeals: 5 }), completeDay({ status: "skipped" }));
    const frozen = resolve(subscription({ remainingMeals: 5 }), completeDay({ status: "frozen" }));

    assert.strictEqual(skipped.flowStatus, "disabled");
    assert.strictEqual(skipped.reason, "DAY_SKIPPED");
    assert.strictEqual(frozen.flowStatus, "disabled");
    assert.strictEqual(frozen.reason, "DAY_SKIPPED");
  });

  await test("planning incomplete still disabled for pickup", async () => {
    const state = resolve(subscription({ remainingMeals: 5 }), completeDay({
      selections: [],
      plannerMeta: { requiredSlotCount: 1, completeSlotCount: 0 },
      planningMeta: { requiredMealCount: 1, selectedTotalMealCount: 0 },
    }));

    assert.strictEqual(state.flowStatus, "disabled");
    assert.strictEqual(state.reason, "PLANNING_INCOMPLETE");
  });

  await test("planning unconfirmed still disabled for pickup", async () => {
    const state = resolve(subscription({ remainingMeals: 5 }), completeDay({
      plannerState: "draft",
      planningState: "draft",
      plannerMeta: { requiredSlotCount: 1, completeSlotCount: 1, isDraftValid: true },
      planningMeta: { requiredMealCount: 1, selectedTotalMealCount: 1, isExactCountSatisfied: true },
    }));

    assert.strictEqual(state.flowStatus, "disabled");
    assert.strictEqual(state.reason, "PLANNING_UNCONFIRMED");
  });

  await test("payment required still disabled for pickup", async () => {
    const state = resolve(subscription({ remainingMeals: 5 }), completeDay({
      addonSelections: [
        {
          addonId: new mongoose.Types.ObjectId(),
          category: "snack",
          source: "pending_payment",
          priceHalala: 500,
        },
      ],
    }));

    assert.strictEqual(state.flowStatus, "disabled");
    assert.strictEqual(state.reason, "PAYMENT_REQUIRED");
  });

  console.log(`\nResult: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed > 0) process.exit(1);
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
