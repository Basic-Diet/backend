require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");

const Subscription = require("../src/models/Subscription");
const SubscriptionDay = require("../src/models/SubscriptionDay");
const Plan = require("../src/models/Plan");
const MenuProduct = require("../src/models/MenuProduct");
const Addon = require("../src/models/Addon");

const { performDaySelectionValidation } = require("../src/services/subscription/subscriptionSelectionService");
const { updateBulkDaySelectionsForClient } = require("../src/services/subscription/subscriptionSelectionClientService");
const { cancelDayPlanningForClient } = require("../src/services/subscription/subscriptionSelectionClientService");
// We need pickup request service
const { createPickupRequestForClient } = require("../src/services/subscription/subscriptionPickupRequestClientService");

const isTestTag = { isTestData: true };
let testUserId = new mongoose.Types.ObjectId();
let testSubId = null;

async function setupTestEnv() {
  const plan = new Plan({ name: { en: "Test Plan" }, priceHalala: 10000, daysCount: 30, ...isTestTag });
  await plan.save({ validateBeforeSave: false });

  const MenuCategory = require("../src/models/MenuCategory");
  const catProps = { isActive: true, isVisible: true, isAvailable: true, publishedAt: new Date() };
  const cJuice = await MenuCategory.findOneAndUpdate({ key: "juices" }, { name: { en: "Juices" }, ...catProps, ...isTestTag }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  const cSnack = await MenuCategory.findOneAndUpdate({ key: "desserts" }, { name: { en: "Snacks" }, ...catProps, ...isTestTag }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  const cSalad = await MenuCategory.findOneAndUpdate({ key: "light_options" }, { name: { en: "Salad" }, ...catProps, ...isTestTag }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();

  const activeProps = { isActive: true, isVisible: true, isAvailable: true, publishedAt: new Date(), availableFor: ["one_time"] };
  const pJuice = await MenuProduct.findOneAndUpdate({ key: "t_juice_" + Date.now() }, { name: { en: "T Juice" }, categoryId: cJuice._id, category: { key: "juices" }, priceHalala: 1000, currency: "SAR", ...activeProps, ...isTestTag }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  const pSnack = await MenuProduct.findOneAndUpdate({ key: "t_snack_" + Date.now() }, { name: { en: "T Snack" }, categoryId: cSnack._id, category: { key: "desserts" }, priceHalala: 1000, currency: "SAR", ...activeProps, ...isTestTag }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  const pSalad = await MenuProduct.findOneAndUpdate({ key: "fruit_salad_addon" }, { name: { en: "T Salad" }, categoryId: cSalad._id, category: { key: "light_options" }, priceHalala: 1000, currency: "SAR", ...activeProps, ...isTestTag }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();

  const aJuice = new Addon({ name: { en: "J Addon" }, category: "juice", priceHalala: 0, pricingMode: "fixed", kind: "item", isActive: true, menuProductIds: [pJuice._id], ...isTestTag });
  const aSnack = new Addon({ name: { en: "S Addon" }, category: "snack", priceHalala: 0, pricingMode: "fixed", kind: "item", isActive: true, menuProductIds: [pSnack._id], ...isTestTag });
  const aSalad = new Addon({ name: { en: "L Addon" }, category: "small_salad", priceHalala: 0, pricingMode: "fixed", kind: "item", isActive: true, menuProductIds: [pSalad._id], ...isTestTag });

  await Promise.all([aJuice.save({ validateBeforeSave: false }), aSnack.save({ validateBeforeSave: false }), aSalad.save({ validateBeforeSave: false })]);

  const sub = new Subscription({
    userId: testUserId,
    planId: plan._id,
    status: "active",
    totalMeals: 30,
    remainingMeals: 30,
    duration: 30,
    deliveryMode: "pickup",
    contractMode: "canonical",
    startDate: new Date("2026-07-01"),
    endDate: new Date("2026-07-30"),
    validityEndDate: new Date("2026-07-30"),
    addonBalance: [
      { addonId: aJuice._id, category: "juice", includedTotalQty: 10, remainingQty: 10, consumedQty: 0 },
      { addonId: aSnack._id, category: "snack", includedTotalQty: 10, remainingQty: 10, consumedQty: 0 },
      { addonId: aSalad._id, category: "small_salad", includedTotalQty: 10, remainingQty: 10, consumedQty: 0 }
    ],
    addonSubscriptions: [
      { addonId: aJuice._id, category: "juice", maxPerDay: 1, menuProductIds: [pJuice._id] },
      { addonId: aSnack._id, category: "snack", maxPerDay: 1, menuProductIds: [pSnack._id] },
      { addonId: aSalad._id, category: "small_salad", maxPerDay: 1, menuProductIds: [pSalad._id] }
    ],
    ...isTestTag
  });
  await sub.save({ validateBeforeSave: false });
  testSubId = sub._id;

  return { sub, pJuice, pSnack, pSalad, aJuice, aSnack, aSalad };
}

async function teardownTestEnv() {
  await Plan.deleteMany(isTestTag);
  await MenuProduct.deleteMany(isTestTag);
  const MenuCategory = require("../src/models/MenuCategory");
  await MenuCategory.deleteMany(isTestTag);
  await Addon.deleteMany(isTestTag);
  await Subscription.deleteMany(isTestTag);
  if (testSubId) await SubscriptionDay.deleteMany({ subscriptionId: testSubId });
}

const reports = {};

async function runScenario1(pJuice, pSnack, pSalad) {
  const s1Date = "2026-07-10";
  await new SubscriptionDay({ subscriptionId: testSubId, date: s1Date, status: "open" }).save({ validateBeforeSave: false });
  const s1ReqAddons = [ pJuice._id.toString(), pSnack._id.toString(), pSalad._id.toString() ]; 
  const s1Req = [{ date: s1Date, mealSlots: [], requestedOneTimeAddonIds: s1ReqAddons }];

  console.log("pJuice ID:", pJuice._id.toString());
  console.log("pSnack ID:", pSnack._id.toString());
  console.log("pSalad ID:", pSalad._id.toString());

  const preSub = await Subscription.findById(testSubId).lean();
  const res = await updateBulkDaySelectionsForClient({
      subscriptionId: testSubId,
      requests: s1Req,
      userId: testUserId.toString(),
      lang: "en",
      runtime: require("../src/services/subscription/runtime").sliceEDefaultRuntime,
      writeLogSafelyFn: () => {},
      loadWalletCatalogMapsSafelyFn: () => ({})
  });
  const postSub = await Subscription.findById(testSubId).lean();
  reports.scenario1 = { preSubBalance: preSub.addonBalance, response: res, postSubBalance: postSub.addonBalance };
}


async function runScenario2(pJuice, pSnack, pSalad) {
  const SubscriptionDay = require("../src/models/SubscriptionDay");
  const Subscription = require("../src/models/Subscription");
  const { updateBulkDaySelectionsForClient } = require("../src/services/subscription/subscriptionSelectionClientService");

  // 1. Manually mutate the subscription balance to simulate partial depletion
  const sub = await Subscription.findById(testSubId);
  sub.addonBalance.forEach(b => {
    if (b.category === "juice") b.remainingQty = 1; // Only 1 juice left
    if (b.category === "snack") b.remainingQty = 0; // No snacks left
    if (b.category === "small_salad") b.remainingQty = 0; // No salads left
  });
  await sub.save({ validateBeforeSave: false });

  const s2Date = "2026-07-11";
  await new SubscriptionDay({ subscriptionId: testSubId, date: s2Date, status: "open" }).save({ validateBeforeSave: false });
  
  // Request: 2 Juices, 1 Snack, 1 Salad
  const s2ReqAddons = [ 
    pJuice._id.toString(), pJuice._id.toString(), // 2 juices
    pSnack._id.toString(), // 1 snack
    pSalad._id.toString()  // 1 salad
  ]; 
  const s2Req = [{ date: s2Date, mealSlots: [], requestedOneTimeAddonIds: s2ReqAddons }];

  const preSub = await Subscription.findById(testSubId).lean();
  const res = await updateBulkDaySelectionsForClient({
      subscriptionId: testSubId,
      requests: s2Req,
      userId: testUserId.toString(),
      lang: "en",
      runtime: require("../src/services/subscription/runtime").sliceEDefaultRuntime,
      writeLogSafelyFn: () => {},
      loadWalletCatalogMapsSafelyFn: () => ({})
  });
  const postSub = await Subscription.findById(testSubId).lean();
  reports.scenario2 = { preSubBalance: preSub.addonBalance, response: res, postSubBalance: postSub.addonBalance };
}


async function runThresholdTest(pJuice) {
  const SubscriptionDay = require("../src/models/SubscriptionDay");
  const Subscription = require("../src/models/Subscription");
  const { updateBulkDaySelectionsForClient } = require("../src/services/subscription/subscriptionSelectionClientService");

  // Reset the balance to 20 juice
  const sub = await Subscription.findById(testSubId);
  sub.addonBalance.forEach(b => {
    if (b.category === "juice") {
      b.remainingQty = 20;
      b.totalUnits = 20;
    }
  });
  await sub.save({ validateBeforeSave: false });

  // Test 1: exactly 2 items
  const d2 = "2026-07-20";
  await new SubscriptionDay({ subscriptionId: testSubId, date: d2, status: "open" }).save({ validateBeforeSave: false });
  let req = [{ date: d2, mealSlots: [], requestedOneTimeAddonIds: Array(2).fill(pJuice._id.toString()) }];
  
  let res = await updateBulkDaySelectionsForClient({
      subscriptionId: testSubId,
      requests: req,
      userId: testUserId.toString(),
      lang: "en",
      runtime: require("../src/services/subscription/runtime").sliceEDefaultRuntime,
      writeLogSafelyFn: () => {},
      loadWalletCatalogMapsSafelyFn: () => ({})
  });
  reports.thresholdTest2 = res;

  // Test 2: exactly 3 items
  const d3 = "2026-07-21";
  await new SubscriptionDay({ subscriptionId: testSubId, date: d3, status: "open" }).save({ validateBeforeSave: false });
  req = [{ date: d3, mealSlots: [], requestedOneTimeAddonIds: Array(3).fill(pJuice._id.toString()) }];
  
  res = await updateBulkDaySelectionsForClient({
      subscriptionId: testSubId,
      requests: req,
      userId: testUserId.toString(),
      lang: "en",
      runtime: require("../src/services/subscription/runtime").sliceEDefaultRuntime,
      writeLogSafelyFn: () => {},
      loadWalletCatalogMapsSafelyFn: () => ({})
  });
  reports.thresholdTest3 = res;

  // Test 3: exactly 10 items
  const d10 = "2026-07-22";
  await new SubscriptionDay({ subscriptionId: testSubId, date: d10, status: "open" }).save({ validateBeforeSave: false });
  req = [{ date: d10, mealSlots: [], requestedOneTimeAddonIds: Array(10).fill(pJuice._id.toString()) }];
  
  res = await updateBulkDaySelectionsForClient({
      subscriptionId: testSubId,
      requests: req,
      userId: testUserId.toString(),
      lang: "en",
      runtime: require("../src/services/subscription/runtime").sliceEDefaultRuntime,
      writeLogSafelyFn: () => {},
      loadWalletCatalogMapsSafelyFn: () => ({})
  });
  reports.thresholdTest10 = res;
}

async function runScenarios() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGO_URI");
  
  try {
    await mongoose.connect(uri);
    await teardownTestEnv();
    const { sub, pJuice, pSnack, pSalad, aJuice, aSnack, aSalad } = await setupTestEnv();
    
    await runScenario1(pJuice, pSnack, pSalad);
    await runScenario2(pJuice, pSnack, pSalad);
    await runThresholdTest(pJuice);
    
    // Output reports
    fs.writeFileSync("scratch/e2e_report.json", JSON.stringify(reports, null, 2));
    
  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await teardownTestEnv();
    await mongoose.disconnect();
  }
}

runScenarios();
