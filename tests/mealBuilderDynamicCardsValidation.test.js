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

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri(`meal_builder_dynamic_cards_${Date.now()}`);
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

function expectStatus(response, expected, label) {
  assert.strictEqual(
    response.status,
    expected,
    `${label}: expected ${expected}, got ${response.status} ${JSON.stringify(response.body)}`
  );
}

function issueCodes(validation) {
  return new Set([
    ...(validation?.errors || []),
    ...(validation?.warnings || []),
  ].map((issue) => issue.code));
}

function assertNoTemplateIssues(validation, label) {
  const codes = issueCodes(validation);
  for (const code of [
    "MEAL_BUILDER_VISUAL_SECTION_MISSING",
    "MEAL_BUILDER_VISUAL_SECTION_ORDER_CHANGED",
    "MEAL_BUILDER_LEGACY_VISUAL_TEMPLATE",
  ]) {
    assert(!codes.has(code), `${label}: unexpected ${code}`);
  }
}

function directCard({ key, productIds, sortOrder, selectionType = "full_meal_product" }) {
  const sandwich = selectionType === "sandwich";
  return {
    key,
    sectionType: "product_list",
    sourceKind: "product_list",
    titleOverride: { ar: key, en: key },
    productContextId: null,
    sourceGroupId: null,
    sourceCategoryId: null,
    selectedOptionIds: [],
    selectedProductIds: productIds,
    includeMode: "selected",
    selectionType,
    sortOrder,
    required: false,
    minSelections: 0,
    maxSelections: 1,
    multiSelect: false,
    visible: true,
    availableFor: ["subscription"],
    metadata: {
      requiresBuilder: false,
      treatAsFullMeal: true,
    },
    rules: sandwich ? { carbsRequired: false } : {},
  };
}

async function seedCatalog() {
  const now = new Date();
  const category = await MenuCategory.create({
    key: "dynamic_cards",
    name: { ar: "بطاقات ديناميكية", en: "Dynamic cards" },
    publishedAt: now,
  });

  const products = await MenuProduct.insertMany([
    {
      categoryId: category._id,
      key: "basic_meal",
      name: { ar: "وجبة أساسية", en: "Basic meal" },
      itemType: "basic_meal",
      pricingModel: "per_100g",
      priceHalala: 1900,
      availableFor: ["subscription"],
      availableForSubscription: true,
      publishedAt: now,
    },
    {
      categoryId: category._id,
      key: "sandwich_only_product",
      name: { ar: "ساندويتش", en: "Sandwich" },
      itemType: "cold_sandwich",
      pricingModel: "fixed",
      priceHalala: 1200,
      availableFor: ["subscription"],
      availableForSubscription: true,
      publishedAt: now,
    },
    ...["custom_meal_one", "custom_meal_two", "custom_meal_three"].map(
      (key, index) => ({
        categoryId: category._id,
        key,
        name: { ar: key, en: key },
        itemType: "full_meal_product",
        pricingModel: "fixed",
        priceHalala: 1400 + index * 100,
        availableFor: ["subscription"],
        availableForSubscription: true,
        publishedAt: now,
        sortOrder: index + 1,
      })
    ),
    {
      categoryId: category._id,
      key: "unavailable_meal",
      name: { ar: "غير متاح", en: "Unavailable" },
      itemType: "full_meal_product",
      pricingModel: "fixed",
      priceHalala: 1000,
      availableFor: ["subscription"],
      availableForSubscription: true,
      isAvailable: false,
      publishedAt: now,
    },
  ]);

  return Object.fromEntries(products.map((product) => [product.key, product]));
}

async function run() {
  await connect();
  try {
    const products = await seedCatalog();
    const id = (key) => String(products[key]._id);
    const app = createApp();
    const api = request(app);
    const auth = await dashboardAuth("admin", "meal-builder-dynamic-cards");

    let response = await api
      .post("/api/dashboard/meal-builder/draft")
      .set(auth.headers)
      .send({});
    expectStatus(response, 201, "optional seed draft");
    assert(response.body.data.sections.length > 0, "optional seed should remain available");

    const sandwichOnly = [
      directCard({
        key: "sandwich",
        productIds: [id("sandwich_only_product")],
        sortOrder: 47,
        selectionType: "sandwich",
      }),
    ];
    response = await api
      .put("/api/dashboard/meal-builder/draft")
      .set(auth.headers)
      .send({ sections: sandwichOnly, notes: "sandwich only" });
    expectStatus(response, 200, "save sandwich-only draft");
    assert.deepStrictEqual(response.body.data.sections.map((section) => section.key), ["sandwich"]);

    response = await api
      .post("/api/dashboard/meal-builder/validate")
      .set(auth.headers)
      .send({ sections: sandwichOnly });
    expectStatus(response, 200, "validate sandwich-only draft");
    assert.strictEqual(response.body.data.ready, true);
    assert.deepStrictEqual(response.body.data.errors, []);
    assert.deepStrictEqual(response.body.data.warnings, []);
    assertNoTemplateIssues(response.body.data, "sandwich-only validation");

    response = await api
      .post("/api/dashboard/meal-builder/publish")
      .set(auth.headers)
      .send({ notes: "publish sandwich only" });
    expectStatus(response, 200, "publish sandwich-only draft");
    assert.strictEqual(response.body.data.validation.ready, true);
    assert.deepStrictEqual(response.body.data.config.sections.map((section) => section.key), ["sandwich"]);

    response = await api.get("/api/subscriptions/meal-planner-menu?lang=en");
    expectStatus(response, 200, "public v3 sandwich-only catalog");
    assert.strictEqual(response.body.data.builderCatalog.contractVersion, "meal_planner_menu.v3");
    assert.strictEqual(response.body.data.plannerCatalog, undefined);
    assert.strictEqual(response.body.data.builderCatalogV2, undefined);
    assert(response.body.data.builderCatalog.sections.some((section) => section.key === "sandwich"));

    const customOnly = [
      directCard({
        key: "chef_specials",
        productIds: [id("custom_meal_one")],
        sortOrder: 900,
      }),
    ];
    response = await api
      .post("/api/dashboard/meal-builder/validate")
      .set(auth.headers)
      .send({ sections: customOnly });
    expectStatus(response, 200, "validate custom-key card");
    assert.strictEqual(response.body.data.ready, true);
    assert.deepStrictEqual(response.body.data.errors, []);
    assert.deepStrictEqual(response.body.data.warnings, []);
    assertNoTemplateIssues(response.body.data, "custom-key validation");

    const twoCards = [
      directCard({
        key: "later_card",
        productIds: [id("custom_meal_two")],
        sortOrder: 80,
      }),
      directCard({
        key: "first_card",
        productIds: [id("custom_meal_one")],
        sortOrder: 3,
      }),
    ];
    response = await api
      .post("/api/dashboard/meal-builder/validate")
      .set(auth.headers)
      .send({ sections: twoCards });
    expectStatus(response, 200, "validate two independent cards");
    assert.strictEqual(response.body.data.ready, true);
    assert.deepStrictEqual(response.body.data.warnings, []);
    assertNoTemplateIssues(response.body.data, "two-card validation");

    response = await api
      .post("/api/dashboard/meal-builder/validate")
      .set(auth.headers)
      .send({
        sections: [
          directCard({
            key: "invalid_present_product",
            productIds: [id("unavailable_meal")],
            sortOrder: 1,
          }),
        ],
      });
    expectStatus(response, 200, "validate unavailable present product");
    assert.strictEqual(response.body.data.ready, false);
    assert(issueCodes(response.body.data).has("MEAL_BUILDER_PRODUCT_UNAVAILABLE"));

    response = await api
      .post("/api/dashboard/meal-builder/validate")
      .set(auth.headers)
      .send({
        sections: [
          directCard({
            key: "missing_product",
            productIds: [String(new mongoose.Types.ObjectId())],
            sortOrder: 1,
          }),
        ],
      });
    expectStatus(response, 200, "validate missing referenced product");
    assert.strictEqual(response.body.data.ready, false);
    assert(issueCodes(response.body.data).has("MEAL_BUILDER_PRODUCT_NOT_FOUND"));

    response = await api
      .post("/api/dashboard/meal-builder/validate")
      .set(auth.headers)
      .send({
        sections: [
          directCard({ key: "bad_id", productIds: ["not-an-object-id"], sortOrder: 1 }),
        ],
      });
    expectStatus(response, 400, "reject invalid ObjectId");
    assert.strictEqual(response.body.error.code, "MEAL_BUILDER_INVALID_REFERENCE");

    response = await api
      .put("/api/dashboard/meal-builder/draft")
      .set(auth.headers)
      .send({ sections: customOnly });
    expectStatus(response, 200, "save custom card before card actions");

    response = await api
      .post("/api/dashboard/meal-builder/sections")
      .set(auth.headers)
      .send({
        key: "second_card",
        titleOverride: { ar: "ثانية", en: "Second" },
        selectedProductIds: [id("custom_meal_two"), id("custom_meal_three")],
        sortOrder: 12,
      });
    expectStatus(response, 201, "create arbitrary card");
    assert.strictEqual(response.body.data.action, "created");
    assert.strictEqual(response.body.data.validation.ready, true);

    response = await api
      .get("/api/dashboard/meal-builder/pickers/second_card?limit=1000")
      .set(auth.headers);
    expectStatus(response, 200, "picker for arbitrary card key");
    assert.strictEqual(response.body.data.sectionKey, "second_card");
    assert.strictEqual(response.body.data.candidateType, "product");

    response = await api
      .patch("/api/dashboard/meal-builder/sections/second_card")
      .set(auth.headers)
      .send({ titleOverride: { ar: "معدلة", en: "Updated" }, sortOrder: 2 });
    expectStatus(response, 200, "update arbitrary card");
    assert.strictEqual(response.body.data.section.titleOverride.en, "Updated");

    response = await api
      .delete(`/api/dashboard/meal-builder/sections/second_card/products/${id("custom_meal_three")}`)
      .set(auth.headers);
    expectStatus(response, 200, "remove product from arbitrary card");
    assert(!response.body.data.section.selectedProductIds.includes(id("custom_meal_three")));

    response = await api
      .delete("/api/dashboard/meal-builder/sections/second_card")
      .set(auth.headers);
    expectStatus(response, 200, "delete arbitrary card");
    assert.strictEqual(response.body.data.action, "deleted");
    assert.deepStrictEqual(response.body.data.draft.sections.map((section) => section.key), ["chef_specials"]);

    response = await api
      .put("/api/dashboard/meal-builder/draft")
      .set(auth.headers)
      .send({ sections: [] });
    expectStatus(response, 200, "save empty editable draft");
    assert.deepStrictEqual(response.body.data.sections, []);

    response = await api
      .get("/api/dashboard/meal-builder/draft/hydrated")
      .set(auth.headers);
    expectStatus(response, 200, "hydrate empty editable draft");
    assert.strictEqual(response.body.data.ready, false);
    assert(issueCodes(response.body.data.validation).has("MEAL_BUILDER_SECTIONS_EMPTY"));
    assertNoTemplateIssues(response.body.data.validation, "empty draft validation");

    response = await api
      .post("/api/dashboard/meal-builder/publish")
      .set(auth.headers)
      .send({ notes: "must not publish empty" });
    expectStatus(response, 422, "block empty publish");
    assert.strictEqual(response.body.error.code, "MEAL_BUILDER_VALIDATION_FAILED");

    response = await api
      .post("/api/dashboard/meal-builder/draft/reset")
      .set(auth.headers)
      .send({});
    expectStatus(response, 200, "reset draft to published sandwich-only state");
    assert.strictEqual(response.body.data.reset, true);
    assert.deepStrictEqual(response.body.data.draft.sections.map((section) => section.key), ["sandwich"]);
    assert.strictEqual(response.body.data.draft.sections.length, 1);

    response = await api.get("/api/dashboard/meal-builder").set(auth.headers);
    expectStatus(response, 200, "dashboard response compatibility");
    for (const field of [
      "draft",
      "published",
      "preview",
      "plannerCatalog",
      "premiumSection",
      "validation",
    ]) {
      assert(Object.prototype.hasOwnProperty.call(response.body.data, field));
    }
    assertNoTemplateIssues(response.body.data.validation.draft, "final dashboard draft");
    assertNoTemplateIssues(response.body.data.validation.published, "final dashboard published");

    console.log("mealBuilderDynamicCardsValidation.test.js passed");
  } finally {
    await disconnect();
  }
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
