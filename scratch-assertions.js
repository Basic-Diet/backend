require("dotenv").config();
const mongoose = require("mongoose");
const request = require("supertest");
const { createApp } = require("./src/app");

async function run() {
  process.env.NODE_ENV = "test";
  const { MongoMemoryReplSet } = require("mongodb-memory-server");
  const mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, dbName: "dashboard_contracts_verification" },
  });
  const uri = mongoServer.getUri("dashboard_contracts_verification");
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  console.log("Seeding catalog...");
  // run the seed catalog script programmatically or via child process
  const { execSync } = require("child_process");
  execSync("BOOTSTRAP_SYNC=true NODE_ENV=test node scripts/bootstrap/seed-catalog.js --sync", { env: { ...process.env, BOOTSTRAP_SYNC: "true" }, stdio: 'inherit' });

  const api = request(createApp());

  console.log("Testing endpoints...");
  
  // 1 & 2: /api/subscriptions/meal-planner-menu returns builderCatalog and plannerCatalog
  const menuRes = await api.get("/api/subscriptions/meal-planner-menu");
  if (menuRes.status !== 200) throw new Error(`Menu returned ${menuRes.status}`);
  const data = menuRes.body.data;
  
  if (!data.builderCatalog || data.builderCatalog.sections.length === 0) throw new Error("builderCatalog.sections is empty");
  if (!data.plannerCatalog || data.plannerCatalog.sections.length === 0) throw new Error("plannerCatalog.sections is empty");
  
  // 3: app-facing section keys
  const expectedSections = ["standard_meal", "premium_meal", "sandwich", "premium_large_salad"];
  const actualSections = data.builderCatalog.sections.map(s => s.key);
  const missing = expectedSections.filter(s => !actualSections.includes(s));
  if (missing.length > 0) throw new Error(`Missing sections in builderCatalog: ${missing}`);

  // 4: premium_meal
  const premiumMealSection = data.builderCatalog.sections.find(s => s.key === "premium_meal");
  const premiumProduct = premiumMealSection.products[0];
  const premiumProteins = premiumProduct.optionGroups.find(g => g.key === "proteins" || g.sourceKey === "proteins");
  const requiredPremiumProteins = ["beef_steak", "shrimp", "salmon"];
  const actualPremiumProteins = premiumProteins.options.map(o => o.key);
  if (requiredPremiumProteins.some(rp => !actualPremiumProteins.includes(rp))) throw new Error("Missing premium proteins");
  const allPremiumFees2000 = premiumProteins.options.filter(o => requiredPremiumProteins.includes(o.key)).every(o => o.extraFeeHalala === 2000);
  if (!allPremiumFees2000) throw new Error("Not all premium proteins have extraFeeHalala 2000");

  // 5: premium_large_salad
  const saladSection = data.builderCatalog.sections.find(s => s.key === "premium_large_salad");
  const saladProduct = saladSection.products[0];
  if (saladProduct.key !== "premium_large_salad") throw new Error("Salad product key mismatch");
  if (saladProduct.extraFeeHalala !== 2900 && saladProduct.priceHalala !== 2900) throw new Error("Salad extraFeeHalala/price mismatch: " + JSON.stringify(saladProduct));
  if (saladProduct.optionGroups.some(g => g.key === "extra_protein_50g")) throw new Error("Salad should not include extra_protein_50g");

  // 6: sandwich
  const sandwichSection = data.builderCatalog.sections.find(s => s.key === "sandwich");
  const sandwichProduct = sandwichSection.products[0];
  if (sandwichProduct.action?.type !== "direct_add") throw new Error("Sandwich action mismatch");
  if (sandwichProduct.action?.requiresBuilder !== false) throw new Error("Sandwich requiresBuilder mismatch");
  if (sandwichProduct.optionGroups && sandwichProduct.optionGroups.length > 0) throw new Error("Sandwich has option groups");

  // 7: addonCatalog
  if (data.addonCatalog.totalCount !== 6) throw new Error(`Addon catalog total count mismatch: ${data.addonCatalog.totalCount}`);
  const juices = data.addonCatalog.categories.find(c => c.key === "juices")?.items || [];
  const snacks = data.addonCatalog.categories.find(c => c.key === "snacks" || c.key === "desserts")?.items || [];
  if (juices.length !== 3) throw new Error(`Juices length mismatch: ${juices.length}`);
  if (snacks.length !== 3) throw new Error(`Snacks length mismatch: ${snacks.length}`);

  // 8: public plans
  const plansRes = await api.get("/api/subscriptions/plans");
  const plans = plansRes.body.data;
  const expectedPlans = ["subscription_7_days", "subscription_26_days", "subscription_30_days"];
  const actualPlans = plans.map(p => p.key);
  const diffPlans = actualPlans.filter(p => !expectedPlans.includes(p));
  if (diffPlans.length > 0) throw new Error("Unexpected public plans: " + diffPlans);

  // 9: addons/options
  const planId = plans[0].id;
  const addonsRes = await api.get(`/api/subscriptions/addons/options?planId=${planId}`);
  const addons = addonsRes.body.data;
  if (!addons || addons.length === 0) throw new Error("Addons options empty");
  if (!addons[0].menuProducts || !addons[0].menuProductIds) throw new Error("Addons missing menuProducts");

  console.log("All assertions passed!");
  await mongoose.disconnect();
  await mongoServer.stop();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
