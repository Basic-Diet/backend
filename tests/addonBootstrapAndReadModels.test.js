process.env.NODE_ENV = "test";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { seedCatalog } = require("../scripts/bootstrap/seed-catalog");
const Addon = require("../src/models/Addon");
const MenuProduct = require("../src/models/MenuProduct");
const AddonPlanPrice = require("../src/models/AddonPlanPrice");
const Plan = require("../src/models/Plan");

const { listAddonPlansAdmin, getAddonPlanAdmin } = require("../src/controllers/addonController");
const { listAddonPrices } = require("../src/controllers/addonPlanPriceController");

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    },
  };
}

async function runTests() {
  await connect();
  try {
    console.log("--- 1. Running Catalog and Subscription Plans Bootstrap Seeding ---");
    await seedCatalog({ sync: true });

    console.log("--- 2. Verifying Seeded Menu Products and Plans ---");
    const orangeJuice = await MenuProduct.findOne({ key: "orange_juice" });
    assert.ok(orangeJuice, "Orange Juice MenuProduct should be seeded");
    assert.strictEqual(orangeJuice.itemType, "juice");
    assert.strictEqual(orangeJuice.priceHalala, 1000);

    const greekSalad = await MenuProduct.findOne({ key: "greek_salad" });
    assert.ok(greekSalad, "Greek Salad MenuProduct should be seeded");
    assert.strictEqual(greekSalad.itemType, "green_salad");

    const proteinSnack = await MenuProduct.findOne({ key: "protein_snack" });
    assert.ok(proteinSnack, "Protein Snack MenuProduct should be seeded");
    assert.strictEqual(proteinSnack.itemType, "dessert");

    const juiceSub = await Addon.findOne({ kind: "plan", category: "juice" });
    assert.ok(juiceSub, "Juice Subscription addon plan should be seeded");
    assert.strictEqual(juiceSub.type, "subscription");
    assert.strictEqual(juiceSub.maxPerDay, 1);
    assert.strictEqual(juiceSub.pricingMode, "base_plan_matrix");
    assert.ok(juiceSub.menuProductIds.includes(orangeJuice._id), "Juice plan should link to Orange Juice");
    assert.strictEqual(juiceSub.menuProductIds.length, 3);

    const base7Day = await Plan.findOne({ durationDays: 7 });
    assert.ok(base7Day, "7-Day base plan should be seeded");

    const matrixRow = await AddonPlanPrice.findOne({ addonPlanId: juiceSub._id, basePlanId: base7Day._id });
    assert.ok(matrixRow, "AddonPlanPrice matrix row should exist for Juice Sub + 7-Day Plan");
    assert.strictEqual(matrixRow.priceHalala, 10000);

    console.log("--- 2.5 Injecting internal test matrix row to verify filtering ---");
    const internalPlan = await Plan.create({
      key: "test_delivery_internal",
      name: { en: "Test Delivery Plan" },
      daysCount: 5,
      durationDays: 5,
      isActive: true,
      isAvailable: true,
      active: true,
      available: true
    });
    await AddonPlanPrice.create({ addonPlanId: juiceSub._id, basePlanId: internalPlan._id, priceHalala: 500, currency: "SAR", isActive: true });

    console.log("--- 3. Testing Dashboard Add-on Plans Read Models (GET /addon-plans) ---");
    const reqList = { query: {} };
    const resList = mockResponse();
    await listAddonPlansAdmin(reqList, resList);
    assert.strictEqual(resList.statusCode, 200);
    assert.ok(resList.data.status);
    const plansList = resList.data.data;
    assert.strictEqual(plansList.length, 3);
    const juiceListPlan = plansList.find(p => p.category === "juice");
    assert.strictEqual(juiceListPlan.menuProductsCount, 3);
    assert.strictEqual(juiceListPlan.pricingMode, "base_plan_matrix");
    assert.strictEqual(juiceListPlan.planPricesCount, 3, "planPricesCount should strictly count sellable base plans only");
    assert.strictEqual(juiceListPlan.priceHalala, undefined, "Legacy priceHalala should be stripped from top level");
    assert.strictEqual(juiceListPlan.priceSar, undefined, "Legacy priceSar should be stripped from top level");
    assert.ok(juiceListPlan.legacyCompatibility, "legacyCompatibility object should exist");
    assert.strictEqual(juiceListPlan.legacyCompatibility.priceHalala, 1100, "legacyCompatibility should retain the value");

    console.log("--- 4. Testing Dashboard Add-on Plan Detail Read Model (GET /addon-plans/:id) ---");
    const reqDetail = { params: { id: juiceSub._id.toString() } };
    const resDetail = mockResponse();
    await getAddonPlanAdmin(reqDetail, resDetail);
    assert.strictEqual(resDetail.statusCode, 200);
    assert.ok(resDetail.data.status);
    const detailData = resDetail.data.data;
    assert.strictEqual(detailData.id, juiceSub._id.toString());
    assert.strictEqual(detailData.pricingMode, "base_plan_matrix");
    assert.strictEqual(detailData.menuProductsCount, 3);
    assert.strictEqual(detailData.priceHalala, undefined, "Legacy priceHalala should be stripped from top level");
    assert.ok(detailData.legacyCompatibility, "legacyCompatibility should exist on detail");
    assert.strictEqual(detailData.legacyCompatibility.priceHalala, 1100);
    assert.strictEqual(detailData.menuProducts.length, 3);
    assert.strictEqual(detailData.menuProducts[0].name.en, "Orange Juice");
    assert.strictEqual(detailData.planPricesCount, 3);
    assert.strictEqual(detailData.planPrices.length, 3);
    const detailPrice7Day = detailData.planPrices.find(p => p.daysCount === 7);
    assert.ok(detailPrice7Day.id, "planPrices row must contain id");
    assert.ok(detailPrice7Day._id, "planPrices row must contain _id");
    assert.ok(detailPrice7Day.addonPlanId, "planPrices row must contain addonPlanId");
    assert.strictEqual(detailPrice7Day.priceHalala, 10000);
    assert.strictEqual(detailPrice7Day.priceSar, 100);
    assert.strictEqual(detailPrice7Day.priceLabel, "100 SAR");
    assert.strictEqual(detailPrice7Day.mealsCount, 14);

    console.log("--- 5. Testing Dashboard Addon Prices Read Model (GET /addon-prices) ---");
    const reqPrices = { query: {} };
    const resPrices = mockResponse();
    await listAddonPrices(reqPrices, resPrices);
    assert.strictEqual(resPrices.statusCode, 200);
    assert.ok(resPrices.data.status);
    const pricesList = resPrices.data.data;
    assert.ok(pricesList.length >= 9, "Should have seeded pricing matrix rows");
    const priceRowObj = pricesList.find(p => String(p.addonPlanId) === juiceSub._id.toString() && p.daysCount === 7);
    assert.ok(priceRowObj, "Should find Juice Sub + 7-Day row");
    assert.strictEqual(priceRowObj.priceHalala, 10000);
    assert.strictEqual(priceRowObj.mealsCount, 14);

    const internalRowObj = pricesList.find(p => String(p.basePlanId) === internalPlan._id.toString());
    assert.strictEqual(internalRowObj, undefined, "Internal plans should be excluded by default");

    const reqPricesInternal = { query: { includeInternal: "true" } };
    const resPricesInternal = mockResponse();
    await listAddonPrices(reqPricesInternal, resPricesInternal);
    const internalRowObjIncluded = resPricesInternal.data.data.find(p => String(p.basePlanId) === internalPlan._id.toString());
    assert.ok(internalRowObjIncluded, "Internal plans should be included when includeInternal=true is passed");

    console.log("All catalog bootstrap and read model verification tests passed successfully!");
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

runTests();
