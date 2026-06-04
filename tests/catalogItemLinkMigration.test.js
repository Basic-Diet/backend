process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";
process.env.DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || "dashboardsecret";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const CatalogItem = require("../src/models/CatalogItem");
const MenuCategory = require("../src/models/MenuCategory");
const MenuOption = require("../src/models/MenuOption");
const MenuOptionGroup = require("../src/models/MenuOptionGroup");
const MenuProduct = require("../src/models/MenuProduct");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const {
  applyReport,
  buildReport,
  loadCatalogLinkInputs,
  verifyReportLinks,
} = require("../scripts/migrations/link-catalog-items");

let mongoServer;
const results = { passed: 0, failed: 0 };

async function test(name, fn) {
  try {
    await mongoose.connection.db.dropDatabase();
    await fn();
    results.passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    results.failed += 1;
    console.error(`FAIL ${name}`);
    console.error(err && err.stack ? err.stack : err);
  }
}

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri("catalog_item_link_migration_test"), { serverSelectionTimeoutMS: 10000 });
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

async function createCategory() {
  return MenuCategory.create({
    key: "meals",
    name: { en: "Meals", ar: "Meals" },
    isActive: true,
    isVisible: true,
    isAvailable: true,
  });
}

async function createGroup(key = "proteins") {
  return MenuOptionGroup.create({
    key,
    name: { en: key, ar: key },
    isActive: true,
    isVisible: true,
    isAvailable: true,
  });
}

async function createProduct(category, key, catalogItemId = null) {
  return MenuProduct.create({
    categoryId: category._id,
    catalogItemId,
    key,
    name: { en: key, ar: key },
    pricingModel: "fixed",
    priceHalala: 1000,
    availableFor: ["one_time"],
    isActive: true,
    isVisible: true,
    isAvailable: true,
  });
}

async function createOption(group, key, catalogItemId = null) {
  return MenuOption.create({
    groupId: group._id,
    catalogItemId,
    key,
    name: { en: key, ar: key },
    availableFor: ["one_time"],
    isActive: true,
    isVisible: true,
    isAvailable: true,
  });
}

async function createCatalogItem(key, itemKind = "product") {
  return CatalogItem.create({
    key,
    nameI18n: { en: key, ar: key },
    itemKind,
  });
}

async function reportFromDb() {
  return buildReport(await loadCatalogLinkInputs());
}

async function run() {
  await connect();
  try {
    await test("dry-run proposes stable key links and leaves unknown rows for review", async () => {
      const category = await createCategory();
      const group = await createGroup("migration_dry_run_options");
      const riceItem = await createCatalogItem("white_rice", "carb");
      const chickenItem = await createCatalogItem("chicken", "protein");
      await createProduct(category, "white_rice");
      await createProduct(category, "unknown_product");
      await createOption(group, "chicken");
      await createOption(group, "unknown_option");

      const report = await reportFromDb();
      assert.strictEqual(report.mode, "dry_run");
      assert(report.proposedProductLinks.some((link) => link.key === "white_rice" && link.newValue === String(riceItem._id)));
      assert(report.proposedOptionLinks.some((link) => link.key === "chicken" && link.newValue === String(chickenItem._id)));
      assert(report.manualReviewRequired.some((row) => row.key === "unknown_product"));
      assert(report.manualReviewRequired.some((row) => row.key === "unknown_option"));
    });

    await test("apply links only missing direct links and never overwrites existing links", async () => {
      const category = await createCategory();
      const group = await createGroup("migration_apply_options");
      const riceItem = await createCatalogItem("white_rice", "carb");
      const chickenItem = await createCatalogItem("chicken", "protein");
      const beefSteakItem = await createCatalogItem("beef_steak", "protein");
      const existingItem = await createCatalogItem("existing_catalog_item", "other");
      const riceProduct = await createProduct(category, "white_rice");
      const protectedProduct = await createProduct(category, "beef_steak", existingItem._id);
      const chickenOption = await createOption(group, "chicken");
      const protectedOption = await createOption(group, "beef_steak", existingItem._id);
      const unknownOption = await createOption(group, "unknown_option");

      await ProductGroupOption.create({
        productId: riceProduct._id,
        groupId: group._id,
        optionId: unknownOption._id,
        isActive: true,
        isVisible: true,
        isAvailable: true,
      });

      const report = await reportFromDb();
      const applied = await applyReport(report);
      assert.strictEqual(applied.productLinksModified, 1);
      assert.strictEqual(applied.optionLinksModified, 1);

      const [reloadedRiceProduct, reloadedProtectedProduct, reloadedChickenOption, reloadedProtectedOption, reloadedUnknownOption] = await Promise.all([
        MenuProduct.findById(riceProduct._id).lean(),
        MenuProduct.findById(protectedProduct._id).lean(),
        MenuOption.findById(chickenOption._id).lean(),
        MenuOption.findById(protectedOption._id).lean(),
        MenuOption.findById(unknownOption._id).lean(),
      ]);

      assert.strictEqual(String(reloadedRiceProduct.catalogItemId), String(riceItem._id));
      assert.strictEqual(String(reloadedChickenOption.catalogItemId), String(chickenItem._id));
      assert.strictEqual(String(reloadedProtectedProduct.catalogItemId), String(existingItem._id));
      assert.strictEqual(String(reloadedProtectedOption.catalogItemId), String(existingItem._id));
      assert.strictEqual(reloadedUnknownOption.catalogItemId, null);

      const verification = await verifyReportLinks(report);
      assert.strictEqual(verification.ok, true);
      assert.strictEqual(verification.countsByCatalogItemId[String(riceItem._id)].linkedProductsCount, 1);
      assert.strictEqual(verification.countsByCatalogItemId[String(chickenItem._id)].linkedOptionsCount, 1);
      assert.strictEqual(verification.countsByCatalogItemId[String(beefSteakItem._id)], undefined);
    });
  } finally {
    await disconnect();
  }

  if (results.failed > 0) {
    console.error(`catalogItemLinkMigration: ${results.failed} failed, ${results.passed} passed`);
    process.exit(1);
  }
  console.log(`catalogItemLinkMigration: ${results.passed} passed`);
}

run().catch(async (err) => {
  console.error(err && err.stack ? err.stack : err);
  await disconnect();
  process.exit(1);
});
