"use strict";

const assert = require("assert");

const { mapSubscriptionDelivery, mapOneTimeOrderDelivery } = require("../src/mappers/deliveryMapper");

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

test("fallback subscription delivery clears legacy flags when no canonical action is executable", () => {
  const dayId = "665000000000000000000001";
  const dto = mapSubscriptionDelivery({
    _id: dayId,
    dayId: { _id: dayId, status: "open", date: "2026-07-03", mealSlots: [] },
    subscriptionId: "665000000000000000000002",
    status: "preparing",
    date: "2026-07-03",
  }, { name: "QA Customer", phone: "+966500000000" });

  assert.deepStrictEqual(dto.allowedActionIds, []);
  assert.deepStrictEqual(dto.allowedActions, []);
  assert.strictEqual(dto.canCancel, false);
  assert.strictEqual(dto.canCourierPickup, false);
  assert.strictEqual(dto.canMarkArrivingSoon, false);
  assert.strictEqual(dto.canMarkDelivered, false);
});

test("persisted ready subscription delivery exposes canonical pickup and cancel actions", () => {
  const dto = mapSubscriptionDelivery({
    _id: "665000000000000000000003",
    dayId: { _id: "665000000000000000000004", status: "ready_for_delivery", date: "2026-07-03", mealSlots: [] },
    subscriptionId: "665000000000000000000005",
    status: "ready_for_delivery",
    date: "2026-07-03",
  }, { name: "QA Customer", phone: "+966500000000" });

  assert.deepStrictEqual(dto.allowedActionIds.sort(), ["cancel", "pickup"].sort());
  assert.strictEqual(dto.canCancel, true);
  assert.strictEqual(dto.canCourierPickup, true);
  assert(dto.allowedActions.every((action) => action.endpoint && action.method === "PUT"));
});

test("one-time delivery legacy flags mirror canonical actions", () => {
  const dto = mapOneTimeOrderDelivery({
    _id: "665000000000000000000006",
    status: "confirmed",
    paymentStatus: "paid",
    fulfillmentMethod: "delivery",
    fulfillmentDate: "2026-07-03",
    items: [],
  }, { name: "QA Customer", phone: "+966500000000" }, {
    _id: "665000000000000000000007",
    orderId: "665000000000000000000006",
    status: "scheduled",
    date: "2026-07-03",
  });

  assert.deepStrictEqual(dto.allowedActionIds, ["cancel"]);
  assert.strictEqual(dto.canCancel, true);
  assert.strictEqual(dto.canMarkDelivered, false);
});
