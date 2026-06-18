process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "supersecret";
process.env.DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || "dashboard-test-secret";
process.env.ALLOW_CATALOG_RESET = "true";
process.env.BOOTSTRAP_SYNC = "true";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { createApp } = require("../src/app");
const { dashboardAuth } = require("./helpers/dashboardAuthHelper");
const { seedCatalog } = require("../scripts/bootstrap/seed-catalog");
const MenuOption = require("../src/models/MenuOption");
const MenuProduct = require("../src/models/MenuProduct");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const ProductOptionGroup = require("../src/models/ProductOptionGroup");

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri(`dashboard_meal_builder_regression_${Date.now()}`);
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

function expectStatus(res, status, label) {
  assert.strictEqual(res.status, status, `${label}: expected ${status}, got ${res.status} ${JSON.stringify(res.body)}`);
}

async function main() {
  await connect();
  try {
    console.log("Seeding catalog using bootstrap seed-catalog script...");
    await seedCatalog({ reset: true, sync: true });

    const app = createApp();
    const api = request(app);
    const { headers } = await dashboardAuth("admin", "meal-builder-regression");

    // 1. Verify that all standard and premium protein variants are successfully seeded & linked in the DB
    const basicMealProduct = await MenuProduct.findOne({ key: "basic_meal" });
    assert(basicMealProduct, "basic_meal product should exist");

    const proteinGroupOptionRelations = await ProductGroupOption.find({ productId: basicMealProduct._id });
    const optionIds = proteinGroupOptionRelations.map((rel) => rel.optionId);
    const linkedOptions = await MenuOption.find({ _id: { $in: optionIds } });
    const linkedOptionKeys = linkedOptions.map((o) => o.key);

    console.log("Verifying standard protein variants are linked...");
    const expectedChickenVariants = [
      "chicken", "chicken_fajita", "spicy_chicken", "italian_spiced_chicken",
      "chicken_tikka", "asian_chicken", "chicken_strips", "grilled_chicken", "mexican_chicken"
    ];
    for (const key of expectedChickenVariants) {
      assert(linkedOptionKeys.includes(key), `basic_meal should have linked option: ${key}`);
    }

    const expectedBeefVariants = ["beef", "meatballs", "beef_stroganoff"];
    for (const key of expectedBeefVariants) {
      assert(linkedOptionKeys.includes(key), `basic_meal should have linked option: ${key}`);
    }

    const expectedFishVariants = ["fish", "tuna", "fish_fillet"];
    for (const key of expectedFishVariants) {
      assert(linkedOptionKeys.includes(key), `basic_meal should have linked option: ${key}`);
    }

    const expectedEggVariants = ["eggs", "boiled_eggs"];
    for (const key of expectedEggVariants) {
      assert(linkedOptionKeys.includes(key), `basic_meal should have linked option: ${key}`);
    }

    // Create draft first
    let res = await api.post("/api/dashboard/meal-builder/draft").set(headers).send({});
    expectStatus(res, 201, "create draft");

    // 2. Load draft/hydrated draft
    res = await api.get("/api/dashboard/meal-builder/draft/hydrated").set(headers);
    expectStatus(res, 200, "hydrate canonical draft");
    const draft = res.body.data.draft;
    const sections = res.body.data.sections;

    // Verify sections count and keys
    const sectionKeys = sections.map((s) => s.key);
    assert.deepStrictEqual(sectionKeys, ["premium", "sandwich", "chicken", "beef", "fish", "eggs", "carbs"]);

    // 3. Run validation and assert no NOT_LINKED_TO_PRODUCT_GROUP or PREMIUM_REQUIRED_KEY errors/warnings
    res = await api.post("/api/dashboard/meal-builder/validate").set(headers).send({ sections: draft.sections });
    expectStatus(res, 200, "validate draft");
    
    const errors = res.body.data.errors || [];
    const warnings = res.body.data.warnings || [];

    const linkErrors = errors.filter((e) => e.code === "NOT_LINKED_TO_PRODUCT_GROUP");
    assert.strictEqual(linkErrors.length, 0, `Should have no NOT_LINKED_TO_PRODUCT_GROUP errors, got: ${JSON.stringify(linkErrors)}`);

    const premiumRequiredWarnings = warnings.filter((w) => w.code === "PREMIUM_REQUIRED_KEY");
    assert.strictEqual(premiumRequiredWarnings.length, 0, `Should have no PREMIUM_REQUIRED_KEY warnings, got: ${JSON.stringify(premiumRequiredWarnings)}`);

    // 4. Verify visual section order is stable under 1-based and 10-based sortOrders
    const orderChangedWarnings = warnings.filter((w) => w.code === "MEAL_BUILDER_VISUAL_SECTION_ORDER_CHANGED");
    assert.strictEqual(orderChangedWarnings.length, 0, `Should have no order changed warnings with standard draft, got: ${JSON.stringify(orderChangedWarnings)}`);

    // Modify sort orders to 1-based index (1, 2, 3, etc.) and validate
    const oneBasedSections = draft.sections.map((s, idx) => ({ ...s, sortOrder: idx + 1 }));
    res = await api.post("/api/dashboard/meal-builder/validate").set(headers).send({ sections: oneBasedSections });
    expectStatus(res, 200, "validate 1-based sort order draft");
    const oneBasedWarnings = res.body.data.warnings || [];
    const oneBasedOrderWarnings = oneBasedWarnings.filter((w) => w.code === "MEAL_BUILDER_VISUAL_SECTION_ORDER_CHANGED");
    assert.strictEqual(oneBasedOrderWarnings.length, 0, `Should support 1-based sort order without warnings, got: ${JSON.stringify(oneBasedOrderWarnings)}`);

    // 5. Publish meal builder draft
    res = await api.post("/api/dashboard/meal-builder/publish").set(headers).send({ notes: "regression publish" });
    expectStatus(res, 200, "publish draft");
    assert.strictEqual(res.body.data.validation.ready, true);

    // 6. Verify after publish, `/api/subscriptions/meal-planner-menu` returns non-empty `plannerCatalog.sections`
    res = await api.get("/api/subscriptions/meal-planner-menu?includeLegacy=true&lang=en");
    expectStatus(res, 200, "get subscriptions meal planner menu");
    
    const plannerCatalog = res.body.data.plannerCatalog;
    assert(plannerCatalog, "plannerCatalog should exist in the response");
    assert(Array.isArray(plannerCatalog.sections) && plannerCatalog.sections.length > 0, "plannerCatalog.sections should be non-empty");

    // 7. Verify premium options remain paid/backend-priced (extraFeeHalala > 0)
    const premiumSection = plannerCatalog.sections.find((s) => s.key === "premium");
    assert(premiumSection, "premium section must exist");
    
    const basicMealProductInPremium = premiumSection.products.find((p) => p.key === "basic_meal");
    assert(basicMealProductInPremium, "basic_meal product shell should exist under premium section");
    
    const premiumProteinsGroup = basicMealProductInPremium.optionGroups.find((g) => g.key === "proteins");
    assert(premiumProteinsGroup, "proteins option group should exist under basic_meal in premium section");
    
    const premiumOptionsList = premiumProteinsGroup.options;
    const beefSteak = premiumOptionsList.find((o) => o.key === "beef_steak");
    assert(beefSteak, "beef_steak option should exist in premium proteins");
    assert(beefSteak.extraPriceHalala > 0, "beef_steak must keep positive extraPriceHalala");
    assert(beefSteak.extraFeeHalala > 0, "beef_steak must keep positive extraFeeHalala");

    // 8. Verify sandwich products remain direct/full-meal selections and are not treated as group options
    const sandwichSection = plannerCatalog.sections.find((s) => s.key === "sandwich");
    assert(sandwichSection, "sandwich section must exist");
    assert.strictEqual(sandwichSection.type, "product_list");
    for (const prod of sandwichSection.products) {
      assert.strictEqual(prod.selectionType, "sandwich");
      assert.strictEqual(prod.action.requiresBuilder, false);
      assert.strictEqual(prod.action.type, "direct_add");
      assert.deepStrictEqual(prod.optionGroups, []);
    }

    console.log("All meal builder regression tests passed!");
  } finally {
    await disconnect();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
