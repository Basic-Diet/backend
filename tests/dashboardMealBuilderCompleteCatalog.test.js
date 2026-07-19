process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "supersecret";
process.env.DASHBOARD_JWT_SECRET =
  process.env.DASHBOARD_JWT_SECRET || "dashboard-test-secret";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { createApp } = require("../src/app");
const { dashboardAuth } = require("./helpers/dashboardAuthHelper");
const MenuCategory = require("../src/models/MenuCategory");
const MenuProduct = require("../src/models/MenuProduct");
const MenuOptionGroup = require("../src/models/MenuOptionGroup");
const MenuOption = require("../src/models/MenuOption");
const ProductOptionGroup = require("../src/models/ProductOptionGroup");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const MealBuilderConfig = require("../src/models/MealBuilderConfig");

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri(
    `dashboard_meal_builder_complete_catalog_${Date.now()}`
  );
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

function expectStatus(response, expectedStatus, label) {
  assert.strictEqual(
    response.status,
    expectedStatus,
    `${label}: expected ${expectedStatus}, got ${response.status} ${JSON.stringify(
      response.body
    )}`
  );
}

async function seedCatalog() {
  const now = new Date();
  const category = await MenuCategory.create({
    key: "complete_catalog",
    name: { ar: "الكتالوج الكامل", en: "Complete Catalog" },
    isActive: true,
    isVisible: true,
    isAvailable: true,
    publishedAt: now,
  });

  const [basicMeal, readyMeal, addonProduct, inactiveProduct] =
    await MenuProduct.insertMany([
      {
        categoryId: category._id,
        key: "basic_meal",
        name: { ar: "وجبة مركبة", en: "Composed Meal" },
        itemType: "product",
        pricingModel: "per_100g",
        priceHalala: 1900,
        availableFor: ["subscription"],
        isCustomizable: true,
        isActive: true,
        isVisible: true,
        isAvailable: true,
        ui: { cardVariant: "hero_builder" },
        publishedAt: now,
        sortOrder: 1,
      },
      {
        categoryId: category._id,
        key: "ready_meal",
        name: { ar: "وجبة كاملة", en: "Ready Meal" },
        itemType: "product",
        pricingModel: "fixed",
        priceHalala: 1800,
        availableFor: ["subscription"],
        isCustomizable: false,
        isActive: true,
        isVisible: true,
        isAvailable: true,
        ui: { cardVariant: "ready_meal" },
        publishedAt: now,
        sortOrder: 2,
      },
      {
        categoryId: category._id,
        key: "addon_product",
        name: { ar: "إضافة", en: "Addon Product" },
        itemType: "product",
        pricingModel: "fixed",
        priceHalala: 500,
        availableFor: ["subscription"],
        isCustomizable: false,
        isActive: true,
        isVisible: true,
        isAvailable: true,
        ui: { cardVariant: "addon_card" },
        publishedAt: now,
        sortOrder: 3,
      },
      {
        categoryId: category._id,
        key: "inactive_meal",
        name: { ar: "وجبة غير نشطة", en: "Inactive Meal" },
        itemType: "full_meal_product",
        pricingModel: "fixed",
        priceHalala: 1600,
        availableFor: ["subscription"],
        isCustomizable: false,
        isActive: false,
        isVisible: false,
        isAvailable: false,
        ui: { cardVariant: "ready_meal" },
        publishedAt: null,
        sortOrder: 4,
      },
    ]);

  const [proteins, carbs] = await MenuOptionGroup.insertMany([
    {
      key: "proteins",
      name: { ar: "بروتينات", en: "Proteins" },
      isActive: true,
      isVisible: true,
      isAvailable: true,
      publishedAt: now,
      sortOrder: 1,
    },
    {
      key: "carbs",
      name: { ar: "كارب", en: "Carbs" },
      isActive: true,
      isVisible: true,
      isAvailable: true,
      publishedAt: now,
      sortOrder: 2,
    },
  ]);

  const [fish, rice, hiddenCarb] = await MenuOption.insertMany([
    {
      groupId: proteins._id,
      key: "fish_fillet",
      name: { ar: "فيليه سمك", en: "Fish Fillet" },
      availableFor: ["subscription"],
      availableForSubscription: true,
      proteinFamilyKey: "fish",
      displayCategoryKey: "fish",
      selectionType: "standard_meal",
      isActive: true,
      isVisible: true,
      isAvailable: true,
      publishedAt: now,
      sortOrder: 1,
    },
    {
      groupId: carbs._id,
      key: "white_rice",
      name: { ar: "أرز أبيض", en: "White Rice" },
      availableFor: ["subscription"],
      availableForSubscription: true,
      selectionType: "standard_meal",
      isActive: true,
      isVisible: true,
      isAvailable: true,
      publishedAt: now,
      sortOrder: 1,
    },
    {
      groupId: carbs._id,
      key: "hidden_carb",
      name: { ar: "كارب مخفي", en: "Hidden Carb" },
      availableFor: ["subscription"],
      availableForSubscription: true,
      selectionType: "standard_meal",
      isActive: false,
      isVisible: false,
      isAvailable: false,
      publishedAt: null,
      sortOrder: 2,
    },
  ]);

  await ProductOptionGroup.insertMany([
    {
      productId: basicMeal._id,
      groupId: proteins._id,
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      isActive: true,
      isVisible: true,
      isAvailable: true,
      sortOrder: 1,
    },
    {
      productId: basicMeal._id,
      groupId: carbs._id,
      minSelections: 1,
      maxSelections: 2,
      isRequired: true,
      isActive: true,
      isVisible: true,
      isAvailable: true,
      sortOrder: 2,
    },
  ]);

  await ProductGroupOption.insertMany([
    {
      productId: basicMeal._id,
      groupId: proteins._id,
      optionId: fish._id,
      isActive: true,
      isVisible: true,
      isAvailable: true,
      sortOrder: 1,
    },
    {
      productId: basicMeal._id,
      groupId: carbs._id,
      optionId: rice._id,
      isActive: true,
      isVisible: true,
      isAvailable: true,
      sortOrder: 1,
    },
    {
      productId: basicMeal._id,
      groupId: carbs._id,
      optionId: hiddenCarb._id,
      isActive: false,
      isVisible: false,
      isAvailable: false,
      sortOrder: 2,
    },
  ]);

  await MealBuilderConfig.create({
    status: "published",
    isCurrent: true,
    contractVersion: "subscription_meal_builder.v1",
    versionNumber: 1,
    source: "dashboard",
    publishedAt: now,
    sections: [
      {
        key: "ready_meals",
        sectionType: "product_list",
        sourceKind: "product_list",
        titleOverride: { ar: "وجبات كاملة", en: "Ready Meals" },
        selectedProductIds: [readyMeal._id],
        includeMode: "selected",
        selectionType: "full_meal_product",
        sortOrder: 1,
        required: false,
        minSelections: 0,
        maxSelections: 1,
        multiSelect: false,
        visible: true,
        availableFor: ["subscription"],
        metadata: { requiresBuilder: false, treatAsFullMeal: true },
        rules: { carbsRequired: false },
      },
    ],
  });
}

async function assertCompleteCatalogPayload(payload) {
  assert.strictEqual(
    payload.contractVersion,
    "dashboard_meal_builder_catalog.v1"
  );
  assert.strictEqual(payload.complete, true);
  assert.deepStrictEqual(payload.counts, {
    categories: 1,
    products: 4,
    optionGroups: 2,
    options: 3,
    productOptionGroups: 2,
    productGroupOptions: 3,
  });

  const productKeys = new Set(payload.products.map((product) => product.key));
  assert.deepStrictEqual(
    productKeys,
    new Set(["basic_meal", "ready_meal", "addon_product", "inactive_meal"])
  );

  const basicMeal = payload.products.find(
    (product) => product.key === "basic_meal"
  );
  assert.ok(basicMeal, "basic_meal must be returned");
  assert.strictEqual(basicMeal.optionGroupCount, 2);
  assert.strictEqual(basicMeal.optionCount, 3);
  assert.strictEqual(basicMeal.mealPlanner.composedMeal.eligible, true);
  assert.strictEqual(basicMeal.mealPlanner.composedMeal.hasProteinGroup, true);
  assert.strictEqual(basicMeal.mealPlanner.composedMeal.hasCarbGroup, true);

  const readyMeal = payload.products.find(
    (product) => product.key === "ready_meal"
  );
  assert.strictEqual(readyMeal.mealPlanner.directAdd.eligible, true);
  assert.strictEqual(
    readyMeal.mealPlanner.directAdd.selectionType,
    "full_meal_product"
  );

  const addon = payload.products.find(
    (product) => product.key === "addon_product"
  );
  assert.ok(addon, "addon product must not disappear from complete catalog");
  assert.strictEqual(addon.mealPlanner.directAdd.eligible, false);
  assert.ok(addon.mealPlanner.reasonCodes.includes("NON_MEAL_CARD_VARIANT"));

  const inactive = payload.products.find(
    (product) => product.key === "inactive_meal"
  );
  assert.ok(inactive, "inactive product must not disappear from complete catalog");
  assert.strictEqual(inactive.status.customerReady, false);
  assert.ok(inactive.status.reasonCodes.includes("INACTIVE"));
  assert.ok(inactive.status.reasonCodes.includes("UNPUBLISHED"));

  const hiddenOption = payload.options.find(
    (option) => option.key === "hidden_carb"
  );
  assert.ok(hiddenOption, "inactive option must be returned");
  assert.strictEqual(hiddenOption.status.customerReady, false);
  assert.strictEqual(payload.relations.productOptionGroups.length, 2);
  assert.strictEqual(payload.relations.productGroupOptions.length, 3);
  assert.strictEqual(payload.diagnostics.hasOrphans, false);
}

async function run() {
  await connect();
  try {
    await seedCatalog();
    const app = createApp();
    const auth = await dashboardAuth(
      "admin",
      "dashboard-meal-builder-complete-catalog"
    );

    const catalogResponse = await request(app)
      .get("/api/dashboard/meal-builder/catalog?lang=ar")
      .set(auth.headers);
    expectStatus(catalogResponse, 200, "complete catalog endpoint");
    await assertCompleteCatalogPayload(catalogResponse.body.data);

    const stateResponse = await request(app)
      .get("/api/dashboard/meal-builder?lang=ar")
      .set(auth.headers);
    expectStatus(stateResponse, 200, "meal builder state endpoint");
    assert.ok(stateResponse.body.data.catalog, "main state must include catalog");
    await assertCompleteCatalogPayload(stateResponse.body.data.catalog);
  } finally {
    await disconnect();
  }
}

run()
  .then(() => {
    console.log("dashboard Meal Builder complete catalog passed");
  })
  .catch(async (error) => {
    console.error(error);
    await disconnect().catch(() => {});
    process.exit(1);
  });
