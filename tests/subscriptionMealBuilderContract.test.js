process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "supersecret";
process.env.DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || "dashboard-test-secret";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { createApp } = require("../src/app");
const { dashboardAuth } = require("./helpers/dashboardAuthHelper");
const MenuCategory = require("../src/models/MenuCategory");
const MenuOption = require("../src/models/MenuOption");
const MenuOptionGroup = require("../src/models/MenuOptionGroup");
const MenuProduct = require("../src/models/MenuProduct");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const ProductOptionGroup = require("../src/models/ProductOptionGroup");

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri(`subscription_meal_builder_contract_${Date.now()}`);
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

async function seedPremiumCatalog() {
  const now = new Date();
  const category = await MenuCategory.create({
    key: "custom_order",
    name: { en: "Custom Order", ar: "Custom Order" },
    publishedAt: now,
  });
  const [proteinsGroup, carbsGroup] = await Promise.all([
    MenuOptionGroup.create({ key: "proteins", name: { en: "Proteins", ar: "Proteins" }, publishedAt: now }),
    MenuOptionGroup.create({ key: "carbs", name: { en: "Carbs", ar: "Carbs" }, publishedAt: now }),
  ]);
  const basicMeal = await MenuProduct.create({
    categoryId: category._id,
    key: "basic_meal",
    itemType: "basic_meal",
    name: { en: "Basic Meal", ar: "Basic Meal" },
    pricingModel: "per_100g",
    priceHalala: 1900,
    availableFor: ["subscription"],
    publishedAt: now,
  });
  const [chicken, salmon, rice] = await Promise.all([
    MenuOption.create({
      groupId: proteinsGroup._id,
      key: "grilled_chicken",
      name: { en: "Grilled Chicken", ar: "Grilled Chicken" },
      proteinFamilyKey: "chicken",
      displayCategoryKey: "chicken",
      availableFor: ["subscription"],
      publishedAt: now,
    }),
    MenuOption.create({
      groupId: proteinsGroup._id,
      key: "salmon",
      premiumKey: "salmon",
      name: { en: "Salmon", ar: "Salmon" },
      proteinFamilyKey: "fish",
      displayCategoryKey: "premium",
      extraPriceHalala: 3000,
      availableFor: ["subscription"],
      publishedAt: now,
    }),
    MenuOption.create({
      groupId: carbsGroup._id,
      key: "white_rice",
      name: { en: "White Rice", ar: "White Rice" },
      availableFor: ["subscription"],
      publishedAt: now,
    }),
  ]);
  await ProductOptionGroup.create({ productId: basicMeal._id, groupId: proteinsGroup._id, minSelections: 1, maxSelections: 1, isRequired: true });
  await ProductOptionGroup.create({ productId: basicMeal._id, groupId: carbsGroup._id, minSelections: 1, maxSelections: 2, isRequired: true });
  await ProductGroupOption.create({ productId: basicMeal._id, groupId: proteinsGroup._id, optionId: chicken._id, extraPriceHalala: 0, sortOrder: 10 });
  await ProductGroupOption.create({ productId: basicMeal._id, groupId: proteinsGroup._id, optionId: salmon._id, extraPriceHalala: 3000, sortOrder: 20 });
  await ProductGroupOption.create({ productId: basicMeal._id, groupId: carbsGroup._id, optionId: rice._id, extraPriceHalala: 0, sortOrder: 10 });
  return { basicMeal, proteinsGroup, carbsGroup, chicken, salmon, rice };
}

async function main() {
  await connect();
  try {
    const fixture = await seedPremiumCatalog();
    const app = createApp();
    const api = request(app);
    const { headers } = await dashboardAuth("admin", "subscription-meal-builder-contract");
    const sections = [
      {
        sectionType: "option_group",
        productContextId: String(fixture.basicMeal._id),
        sourceGroupId: String(fixture.proteinsGroup._id),
        selectedOptionIds: [String(fixture.chicken._id)],
        selectionType: "standard_meal",
        titleOverride: { en: "Standard Proteins", ar: "Standard Proteins" },
        required: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 1,
      },
      {
        sectionType: "option_group",
        productContextId: String(fixture.basicMeal._id),
        sourceGroupId: String(fixture.proteinsGroup._id),
        selectedOptionIds: [String(fixture.salmon._id)],
        selectionType: "premium_meal",
        titleOverride: { en: "Premium Proteins", ar: "Premium Proteins" },
        required: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 2,
      },
      {
        sectionType: "option_group",
        productContextId: String(fixture.basicMeal._id),
        sourceGroupId: String(fixture.carbsGroup._id),
        selectedOptionIds: [String(fixture.rice._id)],
        selectionType: "standard_meal",
        titleOverride: { en: "Carbs", ar: "Carbs" },
        required: true,
        minSelections: 1,
        maxSelections: 2,
        multiSelect: true,
        sortOrder: 3,
      },
    ];

    let res = await api.post("/api/dashboard/meal-builder/draft").set(headers).send({ sections });
    expectStatus(res, 201, "create premium builder draft");
    res = await api.post("/api/dashboard/meal-builder/publish").set(headers).send({});
    expectStatus(res, 200, "publish premium builder draft");

    res = await api.get("/api/subscriptions/meal-builder?lang=en");
    expectStatus(res, 200, "read published meal builder");
    const firstHash = res.body.data.revisionHash;
    assert.strictEqual(res.body.data.contractVersion, "subscription_meal_builder.v1");
    assert(firstHash.startsWith("sha256:"), "mobile contract has revision hash");
    const premiumSection = res.body.data.sections.find((section) => section.selectionType === "premium_meal");
    assert(premiumSection, "premium meal section is present");
    assert.strictEqual(premiumSection.items[0].id, String(fixture.salmon._id));
    assert.strictEqual(premiumSection.items[0].isPremium, true);
    assert.strictEqual(premiumSection.items[0].premiumKind, "premium_protein");
    assert.strictEqual(premiumSection.items[0].premiumPriceHalala, 3000);
    assert.strictEqual(premiumSection.items[0].requiresPremiumBalance, true);

    res = await api.get("/api/subscriptions/meal-builder?lang=en");
    expectStatus(res, 200, "read published meal builder again");
    assert.strictEqual(res.body.data.revisionHash, firstHash, "revision hash is stable between reads");

    res = await api.get("/api/subscriptions/meal-planner-menu?lang=en");
    expectStatus(res, 200, "legacy planner endpoint remains available");
    assert(res.body.data.builderCatalog, "legacy planner response still includes builderCatalog");
    assert(res.body.data.plannerCatalog, "legacy planner response still includes plannerCatalog");

    console.log("subscription meal builder contract checks passed");
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  try { await disconnect(); } catch (_err) {}
  process.exit(1);
});
