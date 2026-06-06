process.env.NODE_ENV = "test";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const { seedCatalog, verifySeedReadContracts } = require("../scripts/seed-catalog");
const MenuProduct = require("../src/models/MenuProduct");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const { getSubscriptionBuilderCatalogWithV2 } = require("../src/services/catalog/CatalogService");
const {
  validateCanonicalMealSlots,
} = require("../src/services/subscription/canonicalMealSlotPlannerService");

const TEST_DB_NAME = `seed_catalog_v3_contract_${Date.now()}`;

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, dbName: TEST_DB_NAME },
  });
  const uri = mongoServer.getUri(TEST_DB_NAME);
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

function assertObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
}

function sectionByKey(catalog, key) {
  return (catalog.sections || []).find((section) => section.key === key);
}

function firstProduct(section, key) {
  return (section.products || []).find((product) => product.key === key) || (section.products || [])[0];
}

function groupBySourceKey(product, key) {
  return (product.optionGroups || []).find((group) => group.sourceKey === key || group.key === key);
}

async function run() {
  await connect();
  try {
    await seedCatalog({ sync: false });
    await verifySeedReadContracts({ strict: true });

    const { plannerCatalog, builderCatalogV2 } = await getSubscriptionBuilderCatalogWithV2({
      lang: "en",
      includeV3: true,
    });

    assertObject(builderCatalogV2, "builderCatalogV2");
    assertObject(plannerCatalog, "plannerCatalog");
    assert.strictEqual(plannerCatalog.contractVersion, "meal_planner_menu.v3", "planner v3 contract version");
    assertArray(plannerCatalog.sections, "plannerCatalog.sections");

    const standardSection = sectionByKey(plannerCatalog, "standard_meal");
    const standardProduct = firstProduct(standardSection, "basic_meal");
    const proteinGroup = groupBySourceKey(standardProduct, "proteins");
    const carbGroup = groupBySourceKey(standardProduct, "carbs");
    assertObject(standardProduct, "standard basic_meal product");
    assertObject(proteinGroup, "standard protein group");
    assertObject(carbGroup, "standard carb group");
    assertArray(proteinGroup.options, "standard protein options");
    assertArray(carbGroup.options, "standard carb options");

    const premiumSection = sectionByKey(plannerCatalog, "premium_meal");
    const premiumProduct = firstProduct(premiumSection, "basic_meal");
    const premiumProteinGroup = groupBySourceKey(premiumProduct, "proteins");
    assert(
      premiumProteinGroup.options.every((option) => Number(option.extraPriceHalala || option.extraFeeHalala || 0) > 0),
      "premium meal protein relation prices are seeded"
    );

    const saladSection = sectionByKey(plannerCatalog, "premium_large_salad");
    const saladProduct = firstProduct(saladSection, "premium_large_salad");
    assertObject(saladProduct, "premium large salad product");
    assert(
      !saladProduct.optionGroups.some((group) => group.key === "extra_protein_50g"),
      "premium large salad excludes extra protein group"
    );

    const proteinOption = proteinGroup.options[0];
    const carbOption = carbGroup.options[0];
    const validSlot = {
      slotIndex: 1,
      selectionType: "standard_meal",
      productId: standardProduct.id,
      selectedOptions: [
        {
          groupId: proteinGroup.groupId || proteinGroup.id,
          groupKey: proteinGroup.key,
          optionId: proteinOption.optionId || proteinOption.id,
          optionKey: proteinOption.key,
          quantity: 1,
        },
        {
          groupId: carbGroup.groupId || carbGroup.id,
          groupKey: carbGroup.key,
          optionId: carbOption.optionId || carbOption.id,
          optionKey: carbOption.key,
          quantity: 1,
          grams: 150,
        },
      ],
    };

    let validation = await validateCanonicalMealSlots({
      mealSlots: [validSlot],
      mealsPerDayLimit: 1,
      maxSlotCount: 1,
      subscription: { premiumBalance: [] },
    });
    assert.strictEqual(validation.valid, true, `seeded canonical slot should validate: ${JSON.stringify(validation)}`);
    assert.strictEqual(validation.processedSlots[0].productKey, "basic_meal", "processed slot product key");
    assertArray(validation.processedSlots[0].selectedOptions, "processed selectedOptions");

    await ProductGroupOption.updateOne(
      {
        productId: standardProduct.id,
        groupId: carbGroup.groupId || carbGroup.id,
        optionId: carbOption.optionId || carbOption.id,
      },
      { $set: { isActive: false } }
    );

    validation = await validateCanonicalMealSlots({
      mealSlots: [validSlot],
      mealsPerDayLimit: 1,
      maxSlotCount: 1,
      subscription: { premiumBalance: [] },
    });
    assert.strictEqual(validation.valid, false, "disabled relation must fail validation");
    assert.strictEqual(validation.errorCode, "PLANNER_OPTION_RELATION_INACTIVE", "disabled relation error code");

    const basicMeal = await MenuProduct.findOne({ key: "basic_meal" }).lean();
    assertObject(basicMeal, "seeded basic_meal db product");
    assert(basicMeal.availableFor.includes("subscription"), "basic_meal is subscription-enabled");
    assert(basicMeal.availableFor.includes("one_time"), "basic_meal remains one-time-enabled");

    console.log("seed catalog canonical v3 contract checks passed");
  } finally {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await disconnect();
  }
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
