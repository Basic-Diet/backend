process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "supersecret";
process.env.DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || "dashboard-test-secret";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { createApp } = require("../src/app");
const MealBuilderConfig = require("../src/models/MealBuilderConfig");
const MenuCategory = require("../src/models/MenuCategory");
const MenuOption = require("../src/models/MenuOption");
const MenuOptionGroup = require("../src/models/MenuOptionGroup");
const MenuProduct = require("../src/models/MenuProduct");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const ProductOptionGroup = require("../src/models/ProductOptionGroup");
const { BOOTSTRAP_KEY, seedMealBuilderConfig } = require("../scripts/bootstrap/seed-meal-builder");

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri(`seed_meal_builder_${Date.now()}`);
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

async function resetDb() {
  await mongoose.connection.dropDatabase();
}

function expectSelectionTypes(sections, expected) {
  assert.deepStrictEqual(sections.map((section) => section.selectionType), expected);
}

async function seedCatalog({ includeSalad = true, disallowedSaladProtein = false, extraProteinGroup = false } = {}) {
  const now = new Date();
  const [customCategory, sandwichCategory] = await Promise.all([
    MenuCategory.create({
      key: "custom_order",
      name: { en: "Custom Order", ar: "Custom Order" },
      isActive: true,
      isVisible: true,
      isAvailable: true,
      publishedAt: now,
    }),
    MenuCategory.create({
      key: "cold_sandwiches",
      name: { en: "Sandwiches", ar: "Sandwiches" },
      isActive: true,
      isVisible: true,
      isAvailable: true,
      publishedAt: now,
    }),
  ]);
  const [proteinsGroup, carbsGroup, extraGroup] = await Promise.all([
    MenuOptionGroup.create({ key: "proteins", name: { en: "Proteins", ar: "Proteins" }, publishedAt: now }),
    MenuOptionGroup.create({ key: "carbs", name: { en: "Carbs", ar: "Carbs" }, publishedAt: now }),
    MenuOptionGroup.create({ key: "extra_protein_50g", name: { en: "Extra Protein", ar: "Extra Protein" }, publishedAt: now }),
  ]);
  const products = await Promise.all([
    MenuProduct.create({
      categoryId: customCategory._id,
      key: "basic_meal",
      itemType: "basic_meal",
      name: { en: "Basic Meal", ar: "Basic Meal" },
      pricingModel: "per_100g",
      priceHalala: 1900,
      availableFor: ["subscription"],
      sortOrder: 1,
      publishedAt: now,
    }),
    MenuProduct.create({
      categoryId: sandwichCategory._id,
      key: "grilled_chicken_cold_sandwich",
      itemType: "cold_sandwich",
      name: { en: "Chicken Sandwich", ar: "Chicken Sandwich" },
      pricingModel: "fixed",
      priceHalala: 1200,
      availableFor: ["subscription"],
      sortOrder: 1,
      publishedAt: now,
    }),
  ]);
  const basicMeal = products[0];
  const sandwich = products[1];
  const salad = includeSalad
    ? await MenuProduct.create({
      categoryId: customCategory._id,
      key: "premium_large_salad",
      itemType: "premium_large_salad",
      name: { en: "Premium Large Salad", ar: "Premium Large Salad" },
      pricingModel: "fixed",
      priceHalala: 2900,
      availableFor: ["subscription"],
      sortOrder: 2,
      publishedAt: now,
    })
    : null;

  const [chicken, salmon, rice, saladProtein, badSaladProtein, extraProtein] = await Promise.all([
    MenuOption.create({
      groupId: proteinsGroup._id,
      key: "grilled_chicken",
      name: { en: "Grilled Chicken", ar: "Grilled Chicken" },
      availableFor: ["subscription"],
      availableForSubscription: true,
      publishedAt: now,
    }),
    MenuOption.create({
      groupId: proteinsGroup._id,
      key: "salmon",
      premiumKey: "salmon",
      name: { en: "Salmon", ar: "Salmon" },
      extraPriceHalala: 3000,
      availableFor: ["subscription"],
      availableForSubscription: true,
      publishedAt: now,
    }),
    MenuOption.create({
      groupId: carbsGroup._id,
      key: "white_rice",
      name: { en: "White Rice", ar: "White Rice" },
      availableFor: ["subscription"],
      availableForSubscription: true,
      publishedAt: now,
    }),
    MenuOption.create({
      groupId: proteinsGroup._id,
      key: "chicken_fajita",
      name: { en: "Chicken Fajita", ar: "Chicken Fajita" },
      availableFor: ["subscription"],
      availableForSubscription: true,
      publishedAt: now,
    }),
    MenuOption.create({
      groupId: proteinsGroup._id,
      key: "beef_steak",
      premiumKey: "beef_steak",
      name: { en: "Beef Steak", ar: "Beef Steak" },
      extraPriceHalala: 3000,
      availableFor: ["subscription"],
      availableForSubscription: true,
      publishedAt: now,
    }),
    MenuOption.create({
      groupId: extraGroup._id,
      key: "extra_chicken_50g",
      name: { en: "Extra Chicken", ar: "Extra Chicken" },
      extraPriceHalala: 500,
      availableFor: ["subscription"],
      availableForSubscription: true,
      publishedAt: now,
    }),
  ]);

  await ProductOptionGroup.create({ productId: basicMeal._id, groupId: proteinsGroup._id, minSelections: 1, maxSelections: 1, isRequired: true, sortOrder: 1 });
  await ProductOptionGroup.create({ productId: basicMeal._id, groupId: carbsGroup._id, minSelections: 1, maxSelections: 2, isRequired: true, sortOrder: 2 });
  await ProductGroupOption.create({ productId: basicMeal._id, groupId: proteinsGroup._id, optionId: chicken._id, extraPriceHalala: 0, sortOrder: 1 });
  await ProductGroupOption.create({ productId: basicMeal._id, groupId: proteinsGroup._id, optionId: salmon._id, extraPriceHalala: 3000, sortOrder: 2 });
  await ProductGroupOption.create({ productId: basicMeal._id, groupId: carbsGroup._id, optionId: rice._id, extraPriceHalala: 0, sortOrder: 1 });

  if (salad) {
    await ProductOptionGroup.create({ productId: salad._id, groupId: proteinsGroup._id, minSelections: 1, maxSelections: 1, isRequired: true, sortOrder: 1 });
    await ProductGroupOption.create({
      productId: salad._id,
      groupId: proteinsGroup._id,
      optionId: (disallowedSaladProtein ? badSaladProtein : saladProtein)._id,
      extraPriceHalala: 0,
      sortOrder: 1,
    });
    if (extraProteinGroup) {
      await ProductOptionGroup.create({ productId: salad._id, groupId: extraGroup._id, minSelections: 0, maxSelections: 1, isRequired: false, sortOrder: 2 });
      await ProductGroupOption.create({ productId: salad._id, groupId: extraGroup._id, optionId: extraProtein._id, extraPriceHalala: 500, sortOrder: 1 });
    }
  }

  return { basicMeal, sandwich, salad };
}

async function testCreatePublishAndIdempotency() {
  await resetDb();
  await seedCatalog();

  const first = await seedMealBuilderConfig();
  assert.strictEqual(first.createdDraft, true);
  assert.strictEqual(first.createdPublished, true);
  assert.strictEqual(first.validation.ready, true);

  const [draft, published] = await Promise.all([
    MealBuilderConfig.findOne({ status: "draft", isCurrent: true }).lean(),
    MealBuilderConfig.findOne({ status: "published", isCurrent: true }).lean(),
  ]);
  assert.strictEqual(draft.source, "bootstrap");
  assert.strictEqual(draft.createdBySystem, true);
  assert.strictEqual(draft.bootstrapKey, BOOTSTRAP_KEY);
  expectSelectionTypes(published.sections, ["standard_meal", "standard_meal", "premium_meal", "sandwich", "premium_large_salad"]);

  const second = await seedMealBuilderConfig();
  assert.strictEqual(second.skippedDraft, true);
  assert.strictEqual(second.skippedPublished, true);
  assert.strictEqual(await MealBuilderConfig.countDocuments({ status: "draft" }), 1);
  assert.strictEqual(await MealBuilderConfig.countDocuments({ status: "published" }), 1);

  const app = createApp();
  const res = await request(app).get("/api/subscriptions/meal-builder?lang=en");
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  expectSelectionTypes(res.body.data.sections, ["standard_meal", "standard_meal", "premium_meal", "sandwich", "premium_large_salad"]);
  assert.strictEqual(res.body.data.sections[2].items[0].isPremium, true);
  assert.strictEqual(res.body.data.sections[2].items[0].premiumKind, "premium_protein");
  assert.strictEqual(res.body.data.sections[4].items[0].premiumKind, "premium_large_salad");
}

async function testSyncOnlyBootstrapOwned() {
  await resetDb();
  await seedCatalog();
  await seedMealBuilderConfig();
  await MealBuilderConfig.updateMany({ source: "bootstrap" }, { $set: { sections: [], notes: "mutated" } });

  const synced = await seedMealBuilderConfig({ sync: true });
  assert.strictEqual(synced.updatedDraft, true);
  assert.strictEqual(synced.updatedPublished, true);
  const published = await MealBuilderConfig.findOne({ status: "published", isCurrent: true }).lean();
  assert(published.sections.length >= 4, "sync restores bootstrap sections");

  await resetDb();
  await seedCatalog();
  await MealBuilderConfig.create({
    status: "published",
    isCurrent: true,
    source: "dashboard",
    createdBySystem: false,
    sections: [],
    notes: "admin layout",
    publishedAt: new Date(),
  });
  const adminSkipped = await seedMealBuilderConfig({ sync: true });
  assert.strictEqual(adminSkipped.skippedPublished, true);
  const adminPublished = await MealBuilderConfig.findOne({ status: "published", isCurrent: true }).lean();
  assert.strictEqual(adminPublished.source, "dashboard");
  assert.strictEqual(adminPublished.notes, "admin layout");
}

async function testMissingSaladWarning() {
  await resetDb();
  await seedCatalog({ includeSalad: false });
  const result = await seedMealBuilderConfig();
  assert(result.warnings.some((warning) => warning.code === "MEAL_BUILDER_PREMIUM_LARGE_SALAD_MISSING"));
  const published = await MealBuilderConfig.findOne({ status: "published", isCurrent: true }).lean();
  assert(!published.sections.some((section) => section.selectionType === "premium_large_salad"));
}

async function testInvalidSaladRelationsReject() {
  await resetDb();
  await seedCatalog({ disallowedSaladProtein: true });
  await assert.rejects(
    () => seedMealBuilderConfig(),
    /PREMIUM_LARGE_SALAD_PROTEIN_NOT_ALLOWED/
  );

  await resetDb();
  await seedCatalog({ extraProteinGroup: true });
  await assert.rejects(
    () => seedMealBuilderConfig(),
    /PREMIUM_LARGE_SALAD_EXTRA_PROTEIN_EXPOSED/
  );
}

async function main() {
  await connect();
  try {
    await testCreatePublishAndIdempotency();
    await testSyncOnlyBootstrapOwned();
    await testMissingSaladWarning();
    await testInvalidSaladRelationsReject();
    console.log("seedMealBuilderConfig.test.js passed");
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
