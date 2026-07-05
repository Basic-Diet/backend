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
const MenuProduct = require("../src/models/MenuProduct");

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri(`meal_planner_full_meal_product_${Date.now()}`);
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
  const pastaCategory = await MenuCategory.create({ key: "pasta", name: { en: "Pasta", ar: "مكرونة" }, publishedAt: now });
  const pastaProduct = await MenuProduct.create({
    categoryId: pastaCategory._id,
    key: "macarna_bashamel",
    itemType: "standalone_meal",
    name: { en: "Macaroni Béchamel", ar: "مكرونة بشاميل" },
    pricingModel: "fixed",
    priceHalala: 2000,
    availableFor: ["subscription"],
    publishedAt: now,
  });

  return { pastaCategory, pastaProduct };
}

async function main() {
  await connect();
  try {
    const fixture = await seedCatalog();
    const app = createApp();
    const api = request(app);
    const { headers } = await dashboardAuth("admin", "full-meal-product-test");

    // 1. Create a draft config with our full meal product section
    const draftPayload = {
      sections: [
        {
          key: "pasta_section",
          sectionType: "product_category",
          sourceCategoryId: String(fixture.pastaCategory._id),
          includeMode: "selected",
          selectedProductIds: [String(fixture.pastaProduct._id)],
          selectionType: "full_meal_product",
          titleOverride: { en: "Pasta Meals", ar: "وجبات مكرونة" },
          required: false,
          minSelections: 0,
          maxSelections: 1,
          multiSelect: false,
          visible: true,
          availableFor: ["subscription"],
        }
      ]
    };

    let res = await api.post("/api/dashboard/meal-builder/draft").set(headers).send(draftPayload);
    assert.strictEqual(res.status, 201, `Failed to create draft: ${JSON.stringify(res.body)}`);

    res = await api.post("/api/dashboard/meal-builder/publish").set(headers).send({});
    assert.strictEqual(res.status, 200, `Failed to publish draft: ${JSON.stringify(res.body)}`);

    // 2. Fetch the published contract
    res = await api.get("/api/subscriptions/meal-planner-menu?lang=en");
    assert.strictEqual(res.status, 200);
    
    const planner = res.body.data.builderCatalog;
    assert.strictEqual(planner.contractVersion, "meal_planner_menu.v3");
    
    const pastaSection = planner.sections.find((section) => section.key === "pasta_section");
    assert(pastaSection, "pasta section should exist in contract");
    
    const pastaItem = pastaSection.products[0];
    assert.strictEqual(pastaItem.productId, String(fixture.pastaProduct._id));
    assert.strictEqual(pastaItem.selectionType, "full_meal_product", "selectionType should map correctly");
    assert.deepStrictEqual(pastaItem.action, {
      type: "direct_add",
      requiresBuilder: false,
      treatAsFullMeal: true
    }, "action contract should treat as full meal and not require builder");

    console.log("Full Meal Product Contract test passed!");
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnect();
  }
}

main().catch(async (err) => {
  console.error(err && err.stack ? err.stack : err);
  try { await disconnect(); } catch (_err) {}
  process.exit(1);
});
