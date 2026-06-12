const assert = require("assert");

const {
  buildDeliveryPayload,
  buildKitchenDetailsPayload,
  buildOrderKitchenDetailsPayload,
  buildPaymentValidityPayload,
  buildPickupPayload,
  buildPlanPayload,
} = require("../src/services/dashboard/opsPayloadService");
const {
  CONTRACT_VERSION,
  normalizeKitchenQueueResponse,
} = require("../src/services/dashboard/kitchenQueueContractService");

function run() {
  const subscription = {
    _id: "sub1",
    planId: {
      _id: "plan1",
      key: "monthly_fit",
      name: { en: "Monthly Fit", ar: "شهري" },
      daysCount: 28,
      durationDays: 28,
    },
    totalMeals: 56,
    remainingMeals: 42,
    selectedMealsPerDay: 2,
    selectedGrams: 200,
    deliveryMode: "delivery",
    pickupLocationId: "main",
  };

  const day = {
    _id: "day1",
    date: "2026-06-11",
    status: "ready_for_pickup",
    plannerState: "confirmed",
    plannerMeta: {
      requiredSlotCount: 1,
      completeSlotCount: 1,
      partialSlotCount: 0,
      isDraftValid: true,
    },
    mealSlots: [{
      slotIndex: 1,
      slotKey: "slot_1",
      status: "complete",
      selectionType: "premium_meal",
      productId: "product1",
      productKey: "basic_meal",
      proteinId: "protein1",
      proteinFamilyKey: "beef",
      carbs: [{ carbId: "carb1", grams: 150, name: { en: "Rice" } }],
      selectedOptions: [
        { groupKey: "sauce", optionId: "sauce1", optionKey: "bbq", quantity: 1, name: { en: "BBQ" } },
        { groupKey: "side", optionId: "side1", optionKey: "veg", quantity: 1, name: { en: "Vegetables" } },
      ],
      confirmationSnapshot: {
        product: { id: "product1", key: "basic_meal", name: { en: "Basic Meal" } },
        protein: { name: { en: "Beef" } },
      },
      isPremium: true,
      premiumKey: "beef_premium",
      premiumSource: "paid",
    }],
    addonSelections: [{
      addonId: "addon1",
      name: { en: "Protein Bar" },
      qty: 2,
      priceHalala: 1200,
    }],
  };

  const plan = buildPlanPayload(subscription, "en");
  assert.strictEqual(plan.id, "plan1");
  assert.strictEqual(plan.key, "monthly_fit");
  assert.strictEqual(plan.name, "Monthly Fit");
  assert.strictEqual(plan.totalMeals, 56);
  assert.strictEqual(plan.remainingMeals, 42);
  assert.strictEqual(plan.selectedMealsPerDay, 2);
  assert.strictEqual(plan.deliveryMode, "delivery");
  assert.strictEqual(plan.proteinGrams, 200);
  assert.strictEqual(plan.portionSize, "200g");

  const kitchenDetails = buildKitchenDetailsPayload(day, subscription, "en");
  assert.strictEqual(kitchenDetails.mealSlots.length, 1);
  assert.strictEqual(kitchenDetails.mealSlots[0].slotKey, "slot_1");
  assert.strictEqual(kitchenDetails.mealSlots[0].productName, "Basic Meal");
  assert.strictEqual(kitchenDetails.mealSlots[0].proteinName, "Beef");
  assert.strictEqual(kitchenDetails.mealSlots[0].proteinGrams, 200);
  assert.strictEqual(kitchenDetails.mealSlots[0].carbSelections[0].carbId, "carb1");
  assert.strictEqual(kitchenDetails.mealSlots[0].sauce[0].optionKey, "bbq");
  assert.strictEqual(kitchenDetails.mealSlots[0].sides[0].optionKey, "veg");
  assert.strictEqual(kitchenDetails.mealSlots[0].isPremium, true);
  assert.strictEqual(kitchenDetails.mealSlots[0].premiumKey, "beef_premium");
  assert.strictEqual(kitchenDetails.mealSlots[0].quantity, 1);
  assert.strictEqual(kitchenDetails.addons.length, 1);
  assert.strictEqual(kitchenDetails.addons[0].id, "addon1");
  assert.strictEqual(kitchenDetails.addons[0].quantity, 2);

  const paidValidity = buildPaymentValidityPayload(day);
  assert.strictEqual(paidValidity.paymentRequired, false);
  assert.strictEqual(paidValidity.pendingUnpaid, false);
  assert.strictEqual(paidValidity.canFulfill, true);

  const pendingValidity = buildPaymentValidityPayload({
    ...day,
    status: "ready_for_pickup",
    mealSlots: [{ ...day.mealSlots[0], premiumSource: "pending_payment", premiumExtraFeeHalala: 1200 }],
    plannerMeta: { ...day.plannerMeta, premiumSlotCount: 1, premiumPendingPaymentCount: 1, premiumTotalHalala: 1200 },
    premiumExtraPayment: { status: "pending", amountHalala: 1200, revisionHash: "rev1" },
  });
  assert.strictEqual(pendingValidity.paymentRequired, true);
  assert.strictEqual(pendingValidity.pendingUnpaid, true);
  assert.strictEqual(pendingValidity.canFulfill, false);

  const supersededValidity = buildPaymentValidityPayload({
    ...day,
    premiumExtraPayment: { status: "paid", metadata: { isSuperseded: true } },
  });
  assert.strictEqual(supersededValidity.superseded, true);
  assert.strictEqual(supersededValidity.canFulfill, false);

  const delivery = buildDeliveryPayload({ _id: "delivery1", date: "2026-06-11", status: "out_for_delivery" });
  assert.strictEqual(delivery.deliveryId, "delivery1");
  assert.strictEqual(delivery.date, "2026-06-11");
  assert.strictEqual(delivery.status, "out_for_delivery");

  const pickup = buildPickupPayload({
    pickupRequest: {
      _id: "pickup1",
      mealCount: 3,
      creditsReserved: true,
      creditsConsumedAt: null,
      creditsReleasedAt: null,
      pickupCode: "123456",
    },
    subscription,
  });
  assert.strictEqual(pickup.pickupRequestId, "pickup1");
  assert.strictEqual(pickup.mealCount, 3);
  assert.strictEqual(pickup.reserved, true);
  assert.strictEqual(pickup.remainingMeals, 42);

  const orderKitchenDetails = buildOrderKitchenDetailsPayload({
    items: [{
      itemType: "standard_meal",
      productId: "orderProduct1",
      name: { en: "Chicken Bowl" },
      qty: 2,
      selections: {
        proteinId: "protein1",
        proteinName: { en: "Chicken" },
        carbs: [{ carbId: "carb1", name: { en: "Rice" }, grams: 150 }],
      },
      selectedOptions: [{ groupKey: "sauce", optionKey: "garlic", name: { en: "Garlic" } }],
    }],
  }, "en");
  assert.strictEqual(orderKitchenDetails.mealSlots.length, 1);
  assert.strictEqual(orderKitchenDetails.mealSlots[0].productName, "Chicken Bowl");
  assert.strictEqual(orderKitchenDetails.mealSlots[0].quantity, 2);
  assert.strictEqual(orderKitchenDetails.mealSlots[0].proteinName, "Chicken");
  assert.strictEqual(orderKitchenDetails.mealSlots[0].sauce[0].optionKey, "garlic");

  const cleanResponse = normalizeKitchenQueueResponse({
    date: "2026-06-12",
    businessDate: "2026-06-12",
    items: [{
      id: "day1",
      entityId: "day1",
      entityType: "subscription_day",
      subscriptionDayId: "day1",
      subscriptionId: "sub1",
      user: { id: "user1", name: "Sara", phone: "+966500000000" },
      date: "2026-06-12",
      status: "ready_for_pickup",
      fulfillmentType: "branch_pickup",
      plan,
      kitchenDetails,
      paymentValidity: paidValidity,
      pickup,
      delivery,
      mealSlots: day.mealSlots,
      materializedMeals: [{ operationalSku: "internal-heavy-sku" }],
      allowedActions: [{ id: "fulfill", method: "POST", endpoint: "/actions/fulfill" }],
      timestamps: { createdAt: "2026-06-12T08:00:00.000Z", updatedAt: "2026-06-12T08:30:00.000Z" },
    }],
  });
  assert.strictEqual(cleanResponse.contractVersion, CONTRACT_VERSION);
  assert.strictEqual(cleanResponse.contractVersion, "dashboard_kitchen_queue.v2");
  assert.strictEqual(cleanResponse.count, 1);
  const cleanItem = cleanResponse.items[0];
  assert(cleanItem.ids, "clean item includes ids section");
  assert(cleanItem.customer, "clean item includes customer section");
  assert(cleanItem.source, "clean item includes source section");
  assert(cleanItem.subscription, "clean item includes subscription section");
  assert(cleanItem.orderSummary, "clean item includes orderSummary section");
  assert(cleanItem.kitchen, "clean item includes kitchen section");
  assert(cleanItem.fulfillment, "clean item includes fulfillment section");
  assert(cleanItem.payment, "clean item includes payment section");
  assert(cleanItem.actions, "clean item includes actions section");
  assert.strictEqual(cleanItem.subscription.plan.proteinGrams, 200);
  assert.strictEqual(cleanItem.subscription.plan.portionSize, "200g");
  assert.strictEqual(cleanItem.kitchen.meals[0].protein.grams, 200);
  assert.strictEqual(cleanItem.orderSummary.mealCount, 1);
  assert.strictEqual(cleanItem.kitchen.meals.length, 1);
  assert.strictEqual(cleanItem.orderSummary.hasPremium, true);
  assert.strictEqual(cleanItem.orderSummary.hasAddons, true);
  assert.strictEqual(cleanItem.kitchen.addons.length, 1);
  assert.strictEqual(cleanItem.kitchen.addons[0].name, "Protein Bar");
  assert.strictEqual(cleanItem.payment.canFulfill, true);
  assert.strictEqual(cleanItem.actions.canFulfill, true);
  assert.strictEqual(cleanItem.fulfillment.delivery.deliveryId, "delivery1");
  assert.strictEqual(cleanItem.fulfillment.delivery.status, "out_for_delivery");
  assert.strictEqual(cleanItem.fulfillment.pickup.pickupRequestId, "pickup1");
  assert.strictEqual(cleanItem.fulfillment.pickup.mealCount, 3);
  assert.strictEqual(cleanItem.raw, undefined);
  assert.strictEqual(cleanItem.mealSlots, undefined);
  assert.strictEqual(cleanItem.materializedMeals, undefined);

  const rawResponse = normalizeKitchenQueueResponse({
    date: "2026-06-12",
    items: [{ entityId: "day1", entityType: "subscription_day", kitchenDetails, paymentValidity: paidValidity, mealSlots: day.mealSlots }],
  }, { includeRaw: true });
  assert(Array.isArray(rawResponse.items[0].raw.mealSlots), "includeRaw attaches legacy internals under raw only");

  const pendingClean = normalizeKitchenQueueResponse({
    date: "2026-06-12",
    items: [{
      entityId: "pendingDay",
      entityType: "subscription_day",
      date: "2026-06-12",
      status: "ready_for_pickup",
      kitchenDetails,
      paymentValidity: pendingValidity,
      allowedActions: [{ id: "fulfill" }],
    }],
  }).items[0];
  assert.strictEqual(pendingClean.payment.pendingUnpaid, true);
  assert.strictEqual(pendingClean.payment.canFulfill, false);
  assert.strictEqual(pendingClean.actions.canFulfill, false);

  const supersededClean = normalizeKitchenQueueResponse({
    date: "2026-06-12",
    items: [{
      entityId: "supersededDay",
      entityType: "subscription_day",
      date: "2026-06-12",
      status: "ready_for_pickup",
      kitchenDetails,
      paymentValidity: supersededValidity,
      allowedActions: [{ id: "fulfill" }],
    }],
  }).items[0];
  assert.strictEqual(supersededClean.payment.superseded, true);
  assert.strictEqual(supersededClean.payment.canFulfill, false);

  console.log("✅ ops payload service exposes plan, kitchen details, payment, delivery, and pickup fields");
}

run();
