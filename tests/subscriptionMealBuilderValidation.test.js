process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "supersecret";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { validateCanonicalMealSlots } = require("../src/services/subscription/canonicalMealSlotPlannerService");
const mealBuilderService = require("../src/services/subscription/mealBuilderConfigService");
const MenuCategory = require("../src/models/MenuCategory");
const MenuOption = require("../src/models/MenuOption");
const MenuOptionGroup = require("../src/models/MenuOptionGroup");
const MenuProduct = require("../src/models/MenuProduct");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const ProductOptionGroup = require("../src/models/ProductOptionGroup");

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri(`subscription_meal_builder_validation_${Date.now()}`);
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

async function seedCatalog() {
  const now = new Date();
  const category = await MenuCategory.create({ key: "custom_order", name: { en: "Custom Order", ar: "Custom Order" }, publishedAt: now });
  const [proteinsGroup, carbsGroup] = await Promise.all([
    MenuOptionGroup.create({ key: "proteins", name: { en: "Proteins", ar: "Proteins" }, publishedAt: now }),
    MenuOptionGroup.create({ key: "carbs", name: { en: "Carbs", ar: "Carbs" }, publishedAt: now }),
  ]);
  const product = await MenuProduct.create({
    categoryId: category._id,
    key: "basic_meal",
    itemType: "basic_meal",
    name: { en: "Basic Meal", ar: "Basic Meal" },
    pricingModel: "per_100g",
    priceHalala: 1900,
    availableFor: ["subscription"],
    publishedAt: now,
  });
  const [chicken, rice] = await Promise.all([
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
      groupId: carbsGroup._id,
      key: "white_rice",
      name: { en: "White Rice", ar: "White Rice" },
      availableFor: ["subscription"],
      publishedAt: now,
    }),
  ]);
  await ProductOptionGroup.create({ productId: product._id, groupId: proteinsGroup._id, minSelections: 1, maxSelections: 1, isRequired: true });
  await ProductOptionGroup.create({ productId: product._id, groupId: carbsGroup._id, minSelections: 1, maxSelections: 2, isRequired: true });
  await ProductGroupOption.create({ productId: product._id, groupId: proteinsGroup._id, optionId: chicken._id });
  await ProductGroupOption.create({ productId: product._id, groupId: carbsGroup._id, optionId: rice._id });
  return { product, proteinsGroup, carbsGroup, chicken, rice };
}

function slot(fixture) {
  return {
    slotIndex: 1,
    selectionType: "standard_meal",
    productId: String(fixture.product._id),
    selectedOptions: [
      {
        groupId: String(fixture.proteinsGroup._id),
        groupKey: "proteins",
        optionId: String(fixture.chicken._id),
        optionKey: "grilled_chicken",
        quantity: 1,
      },
      {
        groupId: String(fixture.carbsGroup._id),
        groupKey: "carbs",
        optionId: String(fixture.rice._id),
        optionKey: "white_rice",
        quantity: 1,
        grams: 150,
      },
    ],
  };
}

async function main() {
  await connect();
  try {
    const fixture = await seedCatalog();

    let result = await validateCanonicalMealSlots({
      mealSlots: [slot(fixture)],
      mealsPerDayLimit: 1,
      subscription: { premiumBalance: [] },
    });
    assert.strictEqual(result.valid, true, JSON.stringify(result));

    await mealBuilderService.createDraft({
      sections: [{
        sectionType: "option_group",
        productContextId: String(fixture.product._id),
        sourceGroupId: String(fixture.proteinsGroup._id),
        selectedOptionIds: [String(fixture.chicken._id)],
        selectionType: "standard_meal",
        titleOverride: { en: "Proteins", ar: "Proteins" },
        required: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 1,
      }],
    });
    await mealBuilderService.publishDraft({});

    result = await validateCanonicalMealSlots({
      mealSlots: [slot(fixture)],
      mealsPerDayLimit: 1,
      subscription: { premiumBalance: [] },
    });
    assert.strictEqual(result.valid, false, JSON.stringify(result));
    assert.strictEqual(result.errorCode, "PLANNER_BUILDER_GROUP_NOT_INCLUDED");
    assert.strictEqual(result.slotErrors[0].hint, "Refresh planner catalog and retry.");

    console.log("subscription meal builder validation checks passed");
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
