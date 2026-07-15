const assert = require("assert");
const mongoose = require("mongoose");

const {
  buildCanonicalSubscriptionCheckoutBreakdown,
} = require("../src/services/subscription/subscriptionCheckoutService");
const {
  buildCanonicalSubscriptionActivationPayload,
} = require("../src/services/subscription/subscriptionActivationService");

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

function premiumItem({ premiumKey, qty, unitExtraFeeHalala, name }) {
  return {
    configId: new mongoose.Types.ObjectId(),
    revision: 3,
    proteinId: null,
    premiumKey,
    kind: premiumKey === "premium_large_salad" ? "product" : "option",
    entityType: premiumKey === "premium_large_salad" ? "premium_large_salad" : "premium_meal",
    selectionType: premiumKey === "premium_large_salad" ? "premium_large_salad" : "premium_meal",
    sourceType: premiumKey === "premium_large_salad" ? "menu_product" : "menu_option",
    sourceModel: premiumKey === "premium_large_salad" ? "MenuProduct" : "MenuOption",
    sourceId: String(new mongoose.Types.ObjectId()),
    sourceProductId: String(new mongoose.Types.ObjectId()),
    sourceGroupId: String(new mongoose.Types.ObjectId()),
    sourceGroupKey: "proteins",
    sourceKey: premiumKey,
    name,
    nameI18n: { ar: name, en: name },
    imageUrl: "",
    qty,
    unitExtraFeeHalala,
    totalHalala: qty * unitExtraFeeHalala,
    currency: "SAR",
    catalogVersion: "test",
    purchasedAt: new Date("2026-07-15T00:00:00.000Z"),
  };
}

(async () => {
  await test("quote totals sum each premiumKey config price times qty", () => {
    const quote = {
      breakdown: {
        basePlanPriceHalala: 10000,
        addonsTotalHalala: 0,
        deliveryFeeHalala: 0,
        discountHalala: 0,
      },
    };
    const normalizedPremiumItems = [
      premiumItem({ premiumKey: "beef_steak", qty: 1, unitExtraFeeHalala: 1500, name: "Beef Steak" }),
      premiumItem({ premiumKey: "salmon", qty: 1, unitExtraFeeHalala: 1800, name: "Salmon" }),
      premiumItem({ premiumKey: "premium_large_salad", qty: 1, unitExtraFeeHalala: 2900, name: "Premium Salad" }),
    ];
    const result = buildCanonicalSubscriptionCheckoutBreakdown(quote, normalizedPremiumItems);
    assert.strictEqual(result.breakdown.premiumTotalHalala, 6200);
    assert.strictEqual(result.breakdown.grossTotalHalala, 16200);
  });

  await test("activation creates exact isolated premium balance buckets", async () => {
    const items = [
      premiumItem({ premiumKey: "beef_steak", qty: 1, unitExtraFeeHalala: 1500, name: "Beef Steak" }),
      premiumItem({ premiumKey: "salmon", qty: 1, unitExtraFeeHalala: 1800, name: "Salmon" }),
      premiumItem({ premiumKey: "premium_large_salad", qty: 1, unitExtraFeeHalala: 2900, name: "Premium Salad" }),
    ];
    const planId = new mongoose.Types.ObjectId();
    const contract = {
      contractVersion: "phase1",
      contractMode: "canonical",
      contractCompleteness: "authoritative",
      contractSource: "customer_checkout",
      contractHash: "test-hash",
      contractSnapshot: {
        plan: {
          planId: String(planId),
          daysCount: 1,
          mealsPerDay: 3,
          selectedGrams: 200,
        },
        start: { resolvedStartDate: "2026-07-16T00:00:00.000+03:00" },
        pricing: {
          premiumTotalHalala: 6200,
          totalHalala: 16200,
          currency: "SAR",
        },
        entitlementContract: { premiumItems: items },
      },
    };
    const payload = await buildCanonicalSubscriptionActivationPayload({
      draft: {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        planId,
        contractVersion: contract.contractVersion,
        contractMode: contract.contractMode,
        contractCompleteness: contract.contractCompleteness,
        contractSource: contract.contractSource,
        contractHash: contract.contractHash,
        contractSnapshot: contract.contractSnapshot,
        premiumItems: items,
        delivery: { type: "pickup", pickupLocationId: "test-branch", slot: { type: "pickup" } },
      },
    });
    const rows = payload.subscriptionPayload.premiumBalance;
    assert.deepStrictEqual(rows.map((row) => row.premiumKey).sort(), ["beef_steak", "premium_large_salad", "salmon"]);
    for (const row of rows) {
      assert(row.configId, `${row.premiumKey} keeps configId`);
      assert.strictEqual(row.revision, 3);
      assert.strictEqual(row.purchasedQty, 1);
      assert.strictEqual(row.consumedQty, 0);
      assert.strictEqual(row.reservedQty, 0);
      assert.strictEqual(row.remainingQty, 1);
      assert.strictEqual(row.totalHalala, row.unitExtraFeeHalala);
    }
  });

  await test("mixed covered paid shape preserves both quantities", () => {
    const selection = {
      premiumKey: "beef_steak",
      quantity: 3,
      coveredQty: 1,
      paidQty: 2,
      unitExtraFeeHalala: 1500,
      payableTotalHalala: 3000,
      source: "pending_payment",
    };
    assert.strictEqual(selection.coveredQty + selection.paidQty, selection.quantity);
    assert.strictEqual(selection.payableTotalHalala, selection.paidQty * selection.unitExtraFeeHalala);
  });
})();
