process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "dynamic-catalog-test-secret";

const assert = require("assert");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const request = require("supertest");

const moyasarService = require("../src/services/moyasarService");
moyasarService.createInvoice = async (payload) => ({
  id: `inv_dynamic_catalog_${Date.now()}`,
  url: "https://payments.example.test/dynamic-catalog",
  amount: payload.amount,
  currency: payload.currency || "SAR",
  status: "initiated",
  metadata: payload.metadata || {},
});

const { createApp } = require("../src/app");
const CheckoutDraft = require("../src/models/CheckoutDraft");
const MenuCategory = require("../src/models/MenuCategory");
const MenuOption = require("../src/models/MenuOption");
const MenuOptionGroup = require("../src/models/MenuOptionGroup");
const MenuProduct = require("../src/models/MenuProduct");
const Payment = require("../src/models/Payment");
const Plan = require("../src/models/Plan");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const ProductOptionGroup = require("../src/models/ProductOptionGroup");
const Setting = require("../src/models/Setting");
const Subscription = require("../src/models/Subscription");
const User = require("../src/models/User");
const premiumUpgradeConfigService = require("../src/services/subscription/premiumUpgradeConfigService");
const { finalizeSubscriptionDraftPaymentFlow } = require("../src/services/subscription/subscriptionActivationService");

const DYNAMIC_PREMIUM_KEY = "dynamic_test_premium_781";
const ORIGINAL_NAME_EN = "Dynamic Premium Old";
const UPDATED_NAME_EN = "Dynamic Premium Changed";

let mongoReplSet;

async function connect() {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { storageEngine: "wiredTiger" } });
  const uri = mongoReplSet.getUri(`dynamic_catalog_premium_test_${Date.now()}`);
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoReplSet) await mongoReplSet.stop();
}

function issueAppAccessToken(userId) {
  return jwt.sign(
    { userId: String(userId), role: "client", tokenType: "app_access" },
    process.env.JWT_SECRET,
    { expiresIn: "31d" }
  );
}

function expectStatus(res, status, label) {
  assert.strictEqual(res.status, status, `${label}: expected ${status}, got ${res.status} ${JSON.stringify(res.body)}`);
}

function findPremiumInPublicCatalog(body, premiumKey) {
  const premiumMealItems = body.data?.mealPlanner?.premiumMeals?.items || [];
  const builderPremiumItems = body.data?.builderCatalog?.premiumProteins || [];
  return premiumMealItems.find((item) => item.premiumKey === premiumKey)
    || builderPremiumItems.find((item) => item.premiumKey === premiumKey || item.key === premiumKey)
    || null;
}

async function seedBaseData() {
  await Setting.create({
    key: "pickup_locations",
    value: [
      {
        id: "main",
        name: { ar: "الفرع الرئيسي", en: "Main Branch" },
        address: { line1: { ar: "الرياض", en: "Riyadh" } },
        isActive: true,
        isDefault: true,
      },
    ],
  });
  await Setting.create({ key: "delivery_windows", value: ["18:00-20:00"] });

  const plan = await Plan.create({
    key: "dynamic_test_package_902",
    name: { ar: "باقة ديناميكية", en: "Dynamic Test Package" },
    daysCount: 7,
    durationDays: 7,
    isActive: true,
    active: true,
    available: true,
    isAvailable: true,
    gramsOptions: [
      {
        grams: 150,
        isActive: true,
        mealsOptions: [
          { mealsPerDay: 2, priceHalala: 50000, compareAtHalala: 50000, isActive: true },
        ],
      },
    ],
  });

  const category = await MenuCategory.create({
    key: "dynamic_builder",
    name: { ar: "بناء ديناميكي", en: "Dynamic Builder" },
    isActive: true,
    isVisible: true,
    isAvailable: true,
    publishedAt: new Date(),
  });
  const basicMeal = await MenuProduct.create({
    categoryId: category._id,
    key: "basic_meal",
    name: { ar: "وجبة أساسية", en: "Basic Meal" },
    itemType: "basic_meal",
    pricingModel: "fixed",
    priceHalala: 0,
    availableFor: ["subscription"],
    isActive: true,
    isVisible: true,
    isAvailable: true,
    publishedAt: new Date(),
  });
  const proteinsGroup = await MenuOptionGroup.create({
    key: "proteins",
    name: { ar: "بروتين", en: "Proteins" },
    isActive: true,
    isVisible: true,
    isAvailable: true,
    publishedAt: new Date(),
  });
  await ProductOptionGroup.create({
    productId: basicMeal._id,
    groupId: proteinsGroup._id,
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    isActive: true,
    isVisible: true,
    isAvailable: true,
  });
  const option = await MenuOption.create({
    groupId: proteinsGroup._id,
    key: DYNAMIC_PREMIUM_KEY,
    premiumKey: DYNAMIC_PREMIUM_KEY,
    name: { ar: "بروتين ديناميكي قديم", en: ORIGINAL_NAME_EN },
    imageUrl: "https://cdn.example.com/dynamic-premium.jpg",
    extraPriceHalala: 1700,
    currency: "SAR",
    availableFor: ["subscription"],
    availableForSubscription: true,
    isActive: true,
    isVisible: true,
    isAvailable: true,
    publishedAt: new Date(),
  });
  await ProductGroupOption.create({
    productId: basicMeal._id,
    groupId: proteinsGroup._id,
    optionId: option._id,
    extraPriceHalala: 1700,
    isActive: true,
    isVisible: true,
    isAvailable: true,
  });

  const dashboardConfig = await premiumUpgradeConfigService.createConfig({
    sourceType: "menu_option",
    sourceId: String(option._id),
    sourceProductId: String(basicMeal._id),
    sourceGroupId: String(proteinsGroup._id),
    selectionType: "premium_meal",
    upgradeDeltaHalala: 1700,
    isEnabled: true,
    isVisible: true,
  }, new mongoose.Types.ObjectId());

  const user = await User.create({
    phone: "+966500000781",
    name: "Dynamic Premium User",
    role: "client",
    isActive: true,
  });

  return { plan, option, dashboardConfig, user };
}

async function main() {
  await connect();
  try {
    const { plan, option, dashboardConfig, user } = await seedBaseData();
    const app = createApp();
    const api = request(app);
    const auth = { Authorization: `Bearer ${issueAppAccessToken(user._id)}` };

    let res = await api.get("/api/subscriptions/menu").set("Accept-Language", "en");
    expectStatus(res, 200, "public subscription menu");
    const publicPremium = findPremiumInPublicCatalog(res.body, DYNAMIC_PREMIUM_KEY);
    assert(publicPremium, "dashboard-created premium appears in public catalog");
    assert.strictEqual(Number(publicPremium.extraFeeHalala || publicPremium.priceHalala), 1700);

    const quotePayload = {
      planId: String(plan._id),
      grams: 150,
      mealsPerDay: 2,
      delivery: { type: "pickup", pickupLocationId: "main" },
      premiumItems: [{ premiumKey: DYNAMIC_PREMIUM_KEY, qty: 2 }],
    };
    res = await api.post("/api/subscriptions/quote").set(auth).send(quotePayload);
    expectStatus(res, 200, "quote dynamic premium");
    assert.strictEqual(res.body.data.breakdown.premiumTotalHalala, 3400);
    assert.strictEqual(res.body.data.summary.premiumItems[0].premiumKey, DYNAMIC_PREMIUM_KEY);

    res = await api.post("/api/subscriptions/checkout").set(auth).send({
      ...quotePayload,
      idempotencyKey: `dynamic_catalog_${Date.now()}`,
    });
    expectStatus(res, 201, "checkout dynamic premium");
    const draft = await CheckoutDraft.findById(res.body.data.draftId).lean();
    assert(draft, "checkout draft created");
    assert.strictEqual(draft.premiumItems[0].premiumKey, DYNAMIC_PREMIUM_KEY);
    assert.strictEqual(draft.premiumItems[0].nameI18n.en, ORIGINAL_NAME_EN);
    assert.strictEqual(draft.premiumItems[0].unitExtraFeeHalala, 1700);
    assert.strictEqual(draft.contractSnapshot.entitlementContract.premiumItems[0].nameI18n.en, ORIGINAL_NAME_EN);
    assert.strictEqual(draft.contractSnapshot.entitlementContract.premiumItems[0].unitExtraFeeHalala, 1700);

    const payment = await Payment.create({
      userId: user._id,
      draftId: draft._id,
      type: "subscription_activation",
      amount: draft.breakdown.totalHalala,
      currency: "SAR",
      status: "paid",
      provider: "moyasar",
      providerInvoiceId: `paid_dynamic_catalog_${Date.now()}`,
      invoiceResponse: { id: `paid_dynamic_catalog_${Date.now()}`, url: "https://payments.example.test/paid" },
    });
    const activation = await finalizeSubscriptionDraftPaymentFlow({ draft, payment }, null);
    assert.strictEqual(activation.applied, true, "activation applied");

    let subscription = await Subscription.findById(activation.subscriptionId).lean();
    assert(subscription, "subscription created");
    assert.strictEqual(subscription.premiumBalance[0].premiumKey, DYNAMIC_PREMIUM_KEY);
    assert.strictEqual(subscription.premiumBalance[0].nameI18n.en, ORIGINAL_NAME_EN);
    assert.strictEqual(subscription.premiumBalance[0].unitExtraFeeHalala, 1700);

    option.name.en = UPDATED_NAME_EN;
    option.extraPriceHalala = 9900;
    await option.save();
    await premiumUpgradeConfigService.updateConfig(dashboardConfig.id, {
      expectedRevision: dashboardConfig.revision,
      upgradeDeltaHalala: 9900,
    }, new mongoose.Types.ObjectId());

    subscription = await Subscription.findById(activation.subscriptionId).lean();
    assert.strictEqual(subscription.premiumBalance[0].nameI18n.en, ORIGINAL_NAME_EN);
    assert.strictEqual(subscription.premiumBalance[0].unitExtraFeeHalala, 1700);

    res = await api.get("/api/subscriptions/current/overview").set(auth);
    expectStatus(res, 200, "current overview after live catalog change");
    const purchasedSummary = (res.body.data.premiumSummary || []).find((item) => item.premiumKey === DYNAMIC_PREMIUM_KEY);
    assert(purchasedSummary, "current overview returns purchased premium from snapshot");
    assert.strictEqual(purchasedSummary.unitExtraFeeHalala, 1700);

    const updatedConfig = await premiumUpgradeConfigService.archiveConfig(dashboardConfig.id, {
      expectedRevision: dashboardConfig.revision + 1,
      reason: "dynamic premium archive test",
    }, new mongoose.Types.ObjectId());
    assert.strictEqual(updatedConfig.status, "archived");

    res = await api.get("/api/subscriptions/menu").set("Accept-Language", "en");
    expectStatus(res, 200, "public subscription menu after archive");
    assert.strictEqual(findPremiumInPublicCatalog(res.body, DYNAMIC_PREMIUM_KEY), null);

    res = await api.post("/api/subscriptions/quote").set(auth).send({
      ...quotePayload,
      premiumItems: [{ premiumKey: DYNAMIC_PREMIUM_KEY, qty: 1 }],
    });
    expectStatus(res, 422, "archived dynamic premium quote rejection");
    assert.strictEqual(res.body.error.code, "INVALID_PREMIUM_ITEM");

    res = await api.post("/api/subscriptions/checkout").set(auth).send({
      ...quotePayload,
      premiumItems: [{ premiumKey: DYNAMIC_PREMIUM_KEY, qty: 1 }],
      idempotencyKey: `dynamic_catalog_archived_${Date.now()}`,
    });
    expectStatus(res, 422, "archived dynamic premium checkout rejection");
    assert.strictEqual(res.body.error.code, "INVALID_PREMIUM_ITEM");

    subscription = await Subscription.findById(activation.subscriptionId).lean();
    assert.strictEqual(subscription.premiumBalance[0].nameI18n.en, ORIGINAL_NAME_EN);
    assert.strictEqual(subscription.premiumBalance[0].unitExtraFeeHalala, 1700);

    console.log("dynamic catalog premium dashboard-to-checkout test passed");
  } finally {
    await disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  await disconnect();
  process.exit(1);
});
