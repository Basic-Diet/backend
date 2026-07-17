"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
  enrichDashboardSubscriptionPayload,
} = require("../src/controllers/dashboard/subscriptionCreationController");

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

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

(async function run() {
  await test("dashboard subscription routes expose quote and create endpoints", async () => {
    const source = read("src/routes/dashboardSubscriptions.js");
    assert.ok(source.includes('require("../controllers/dashboard/subscriptionCreationController")'));
    assert.ok(source.includes('router.post(\n  "/quote"'));
    assert.ok(source.includes('subscriptionCreationController.quoteSubscriptionAdmin'));
    assert.ok(source.includes('router.post(\n  "/"'));
    assert.ok(source.includes('subscriptionCreationController.createSubscriptionAdmin'));
  });

  await test("quote response exposes base subscription price, premium items, add-ons, and checkout summary", async () => {
    const payload = enrichDashboardSubscriptionPayload({
      status: true,
      data: {
        plan: {
          id: "plan_1",
          name: "Monthly Plan",
          daysCount: 28,
          currency: "SAR",
        },
        breakdown: {
          basePlanPriceHalala: 10000,
          premiumTotalHalala: 2500,
          addonsTotalHalala: 7000,
          deliveryFeeHalala: 0,
          discountHalala: 500,
          grossTotalHalala: 19500,
          vatPercentage: 15,
          vatHalala: 2478,
          totalHalala: 19000,
          currency: "SAR",
        },
        premiumItems: [{
          premiumKey: "shrimp",
          name: "Shrimp",
          qty: 1,
          unitExtraFeeHalala: 2500,
          totalHalala: 2500,
          currency: "SAR",
        }],
        addonPlans: [{
          addonPlanId: "addon_1",
          name: "Juice Subscription",
          qty: 1,
          unitPriceHalala: 1000,
          totalHalala: 7000,
          currency: "SAR",
        }],
      },
    }, { lang: "en" });

    const data = payload.data;
    assert.strictEqual(data.subscriptionPrice.amountHalala, 10000);
    assert.strictEqual(data.subscriptionPriceHalala, 10000);
    assert.strictEqual(data.plan.priceHalala, 10000);
    assert.strictEqual(data.plan.subscriptionPriceHalala, 10000);
    assert.strictEqual(data.pricing.subscriptionPriceHalala, 10000);
    assert.strictEqual(data.pricing.premiumTotalHalala, 2500);
    assert.strictEqual(data.pricing.addonsTotalHalala, 7000);
    assert.strictEqual(data.pricing.totalHalala, 19000);
    assert.strictEqual(data.pricing.vatPercentage, 15);
    assert.ok(data.lineItems.some((item) => item.kind === "plan" && item.amountHalala === 10000));
    assert.ok(data.lineItems.some((item) => item.kind === "premium" && item.amountHalala === 2500));
    assert.ok(data.lineItems.some((item) => item.kind === "addons" && item.amountHalala === 7000));
    assert.ok(data.lineItems.some((item) => item.kind === "total" && item.amountHalala === 19000));
    assert.strictEqual(data.premiumItems[0].ui.selectionStyle, "stepper");
    assert.strictEqual(data.premiumItems[0].priceHalala, 2500);
    assert.strictEqual(data.addonPlans[0].ui.selectionStyle, "stepper");
    assert.strictEqual(data.addonPlans[0].pricingModel, "daily_recurring");
    assert.strictEqual(data.addons[0].totalHalala, 7000);
    assert.strictEqual(data.checkoutSummary.subscriptionPrice.amountHalala, 10000);
  });

  await test("create response also exposes subscription price from persisted subscription pricing", async () => {
    const payload = enrichDashboardSubscriptionPayload({
      status: true,
      data: {
        id: "sub_1",
        basePlanPriceHalala: 12000,
        basePlanGrossHalala: 12000,
        premiumBalance: [],
        addonSubscriptions: [],
        pricingSummary: {
          basePlanPriceHalala: 12000,
          totalPriceHalala: 12000,
          vatPercentage: 15,
          vatHalala: 1565,
          currency: "SAR",
        },
      },
    }, { lang: "en" });

    const data = payload.data;
    assert.strictEqual(data.subscriptionPrice.amountHalala, 12000);
    assert.strictEqual(data.subscriptionPriceHalala, 12000);
    assert.strictEqual(data.pricing.subscriptionPriceHalala, 12000);
    assert.strictEqual(data.pricing.totalHalala, 12000);
    assert.ok(data.lineItems.some((item) => item.kind === "plan" && item.amountHalala === 12000));
  });

  if (results.failed > 0) process.exitCode = 1;
  console.log(`\nDashboard subscription creation contract: ${results.passed} passed, ${results.failed} failed`);
})();
