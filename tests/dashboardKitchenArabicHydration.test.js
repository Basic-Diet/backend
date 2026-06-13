const assert = require("assert");

const {
  normalizeKitchenQueueResponse,
} = require("../src/services/dashboard/kitchenQueueContractService");

function assertNoUnsafeDisplay(payload) {
  const json = JSON.stringify(payload);
  assert(!json.includes("[object Object]"));
  assert(!json.includes("حضّر premium_large_salad"));
  assert(!json.includes("حضّر standard_meal"));
  assert(!json.includes('"displayName":"premium_large_salad"'));
  assert(!json.includes('"displayName":"standard_meal"'));
}

function run() {
  const response = normalizeKitchenQueueResponse({
    date: "2026-06-14",
    items: [{
      entityId: "day1",
      entityType: "subscription_day",
      subscriptionId: "sub1",
      user: { id: "user1", name: "Sara", phone: "+966500000000" },
      date: "2026-06-14",
      status: "locked",
      fulfillmentType: "branch_pickup",
      plan: {
        id: "plan1",
        key: "fit",
        name: { ar: "باقة", en: "Plan" },
        proteinGrams: 100,
        portionSize: "100g",
        selectedMealsPerDay: 2,
        totalMeals: 20,
        remainingMeals: 18,
      },
      kitchenDetails: {
        mealSlots: [{
          slotIndex: 1,
          slotKey: "standard",
          selectionType: "standard_meal",
          productKey: "standard_meal",
          proteinKey: "meatballs",
          proteinNameI18n: { ar: "كرات لحم", en: "Meatballs" },
          proteinGrams: 100,
          carbSelections: [{ carbId: "carb1", key: "rice", nameI18n: { ar: "رز أبيض", en: "White Rice" }, grams: 120 }],
        }, {
          slotIndex: 2,
          slotKey: "premium_salad",
          selectionType: "premium_large_salad",
          productKey: "premium_large_salad",
          proteinGrams: 100,
          salad: {
            presetKey: "premium_large_salad",
            groups: {
              leafy_greens: [{ id: "leaf1", key: "lettuce", name: { ar: "خس", en: "Lettuce" } }],
              cheese_nuts: ["6a2ce701c2ce6c0528b5c9da"],
            },
          },
        }, {
          slotIndex: 3,
          slotKey: "sandwich",
          selectionType: "sandwich",
          sandwichId: "sandwich1",
          sandwichKey: "chicken_sandwich",
          sandwichNameI18n: { ar: "ساندويتش دجاج", en: "Chicken Sandwich" },
        }],
        addons: [{
          id: "addon1",
          key: "soup",
          nameI18n: { ar: "شوربة", en: "Soup" },
          quantity: 1,
        }],
      },
      paymentValidity: { paymentStatus: "not_required", canPrepare: true, canFulfill: false },
      allowedActions: [{ id: "prepare", label: { ar: "تحضير", en: "Prepare" } }],
    }],
  });

  const item = response.items[0];
  const standard = item.kitchen.meals[0];
  const premiumSalad = item.kitchen.meals[1];
  const sandwich = item.kitchen.meals[2];

  assertNoUnsafeDisplay(response);
  assert.strictEqual(standard.product.displayName, "وجبة");
  assert.strictEqual(standard.protein.displayName, "كرات لحم");
  assert.strictEqual(standard.carbs[0].displayName, "رز أبيض");
  assert(standard.display.titleAr.includes("وجبة"));
  assert(standard.display.preparationTextAr.includes("وجبة"));
  assert.strictEqual(premiumSalad.product.displayName, "سلطة كبيرة مميزة");
  assert.strictEqual(premiumSalad.salad.displayName, "سلطة كبيرة مميزة");
  assert.strictEqual(premiumSalad.salad.groups.leafy_greens[0].displayName, "خس");
  assert.strictEqual(premiumSalad.salad.groups.cheese_nuts[0].displayName, "عنصر غير معروف");
  assert(premiumSalad.dataQuality === undefined);
  assert(premiumSalad.display.titleAr.includes("سلطة كبيرة مميزة"));
  assert(premiumSalad.display.preparationTextAr.includes("سلطة كبيرة مميزة"));
  assert.strictEqual(sandwich.sandwich.displayName, "ساندويتش دجاج");
  assert.strictEqual(item.kitchen.addons[0].displayName, "شوربة");
  assert(item.dataQuality.warnings.some((warning) => warning.code === "UNRESOLVED_SALAD_GROUP_ITEM"));

  const empty = normalizeKitchenQueueResponse({
    date: "2026-06-14",
    items: [{
      entityId: "empty",
      entityType: "subscription_day",
      customer: { id: "user1", name: "Sara" },
      status: "locked",
      kitchenDetails: { mealSlots: [], addons: [] },
      paymentValidity: { paymentStatus: "not_required", canPrepare: true },
      allowedActions: [{ id: "prepare", label: { ar: "تحضير", en: "Prepare" } }],
    }],
  }, { includeCanceled: true });
  assert.strictEqual(empty.items[0].payment.canPrepare, false);
  assert(!empty.items[0].actions.allowed.some((action) => action.id === "prepare"));

  console.log("✅ dashboard kitchen Arabic hydration contract is safe");
}

run();
