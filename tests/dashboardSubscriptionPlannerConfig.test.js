const process = require("process");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "supersecret";
process.env.DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || "dashboard-test-secret";
process.env.ALLOW_CATALOG_RESET = "true";
process.env.BOOTSTRAP_SYNC = "true";

const assert = require("assert");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { createApp } = require("../src/app");
const { dashboardAuth } = require("./helpers/dashboardAuthHelper");
const { seedCatalog } = require("../scripts/bootstrap/seed-catalog");

let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri(`dashboard_subscription_planner_config_${Date.now()}`);
  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

function expectStatus(res, status, label) {
  assert.strictEqual(res.status, status, `${label}: expected ${status}, got ${res.status} ${JSON.stringify(res.body)}`);
}

function findPremiumSection(sections) {
  return sections.find(s => s.key === "premium_meal" || s.selectionType === "premium_meal" || s.key === "premium");
}

function getPlannerSection(plannerCatalog, sectionKey) {
  return plannerCatalog.sections.find(s => s.key === sectionKey);
}

async function main() {
  await connect();
  try {
    await seedCatalog({ reset: true, sync: true });
    const app = createApp();
    const api = request(app);
    const { headers } = await dashboardAuth("admin", "planner-config");

    // 1. Create and get draft
    let res = await api.post("/api/dashboard/meal-builder/draft").set(headers).send({});
    expectStatus(res, 201, "create draft");

    res = await api.get("/api/dashboard/meal-builder/draft/hydrated").set(headers);
    expectStatus(res, 200, "get draft");
    let draft = res.body.data.draft;

    // --- TEST FALLBACK BEHAVIOR ---
    const fallbackDraft = JSON.parse(JSON.stringify(draft));
    const premiumSectionIdx = fallbackDraft.sections.findIndex(s => s.key === "premium");
    fallbackDraft.sections[premiumSectionIdx].rules = {}; // Remove all rules to test fallback

    res = await api.post("/api/dashboard/meal-builder/validate").set(headers).send({ sections: fallbackDraft.sections });
    expectStatus(res, 200, "validate fallback");
    assert.strictEqual(res.body.data.errors.length, 0, `fallback config is valid, got errors: ${JSON.stringify(res.body.data.errors)}`);

    await api.put("/api/dashboard/meal-builder/draft").set(headers).send({ sections: fallbackDraft.sections });
    await api.post("/api/dashboard/meal-builder/publish").set(headers).send({ notes: "fallback publish" });

    res = await api.get("/api/subscriptions/meal-planner-menu?includeLegacy=true&lang=en");
    expectStatus(res, 200, "get menu fallback");
    
    let menu = res.body.data;
    let plannerCatalog = menu.plannerCatalog;

    // missing premium_meal rules still falls back to legacy premium proteins
    const fallbackPmSection = plannerCatalog.sections.find(s => s.selectionType === "premium_meal" || s.key === "premium_meal" || s.key === "premium");
    const fallbackPmProduct = fallbackPmSection.products.find(p => p.key === "basic_meal");
    const fallbackPmGroup = fallbackPmProduct.optionGroups.find(g => g.key === "proteins" || g.sourceKey === "proteins" || g.key === "protein");
    const fallbackOpts = fallbackPmGroup.options;
    const fallbackBeefPl = fallbackOpts.find(o => o.key === "beef_steak" || o.premiumKey === "beef_steak");
    const fallbackShrimpPl = fallbackOpts.find(o => o.key === "shrimp" || o.premiumKey === "shrimp");
    const fallbackSalmonPl = fallbackOpts.find(o => o.key === "salmon" || o.premiumKey === "salmon");
    assert(fallbackBeefPl && fallbackShrimpPl && fallbackSalmonPl, "legacy premium proteins fallback works when rules are empty");
    
    // Check flutter compatibility
    const builderSections = menu.builderCatalogV2.sections;
    const sectionKeys = builderSections.map(s => s.key || s.selectionType);
    console.log("builderCatalogV2 sectionKeys:", sectionKeys);
    assert(sectionKeys.includes("standard_meal"), "has standard_meal");
    assert(sectionKeys.includes("premium_meal"), "has premium_meal");
    assert(sectionKeys.includes("sandwich"), "has sandwich");
    assert(sectionKeys.includes("premium_large_salad"), "has premium_large_salad");

    let pmSection = builderSections.find(s => s.selectionType === "premium_meal" || s.key === "premium_meal");
    let plsSection = builderSections.find(s => s.selectionType === "premium_large_salad" || s.key === "premium_large_salad");
    
    assert(pmSection, "premium_meal section exists");
    assert(plsSection, "premium_large_salad section exists");
    assert.strictEqual(plsSection.products[0].key, "premium_large_salad", "exact product key preserved");
    
    // Default fallback validations
    const fallbackBeefGroup = pmSection.products[0].optionGroups.find(g => g.key === "proteins" || g.sourceKey === "proteins" || g.key === "protein");
    const fallbackBeef = fallbackBeefGroup.options.find(o => o.key === "beef_steak" || o.premiumKey === "beef_steak");
    assert(fallbackBeef, "fallback beef exists");

    // --- TEST DYNAMIC CONFIG VALIDATION ---
    const invalidDraft = JSON.parse(JSON.stringify(draft));
    const invalidRules = {
      premium_meal: {
        linkedProductKey: "basic_meal",
        premiumProteinOptions: [{ optionKey: "invalid_opt", extraFeeHalala: -100, enabled: true }]
      },
      premium_large_salad: {
        linkedProductKey: "premium_large_salad",
        groups: [{ groupKey: "invalid_grp", allowedOptionKeys: ["fake"] }]
      }
    };
    invalidDraft.sections[premiumSectionIdx].rules = invalidRules;
    res = await api.post("/api/dashboard/meal-builder/validate").set(headers).send({ sections: invalidDraft.sections });
    const errors = res.body.data.errors;
    assert(errors.some(e => e.code === "MEAL_BUILDER_PREMIUM_MEAL_INVALID_FEE"), "negative fee rejected");
    assert(errors.some(e => e.code === "MEAL_BUILDER_PREMIUM_MEAL_INVALID_OPTION"), "invalid option rejected");
    assert(errors.some(e => e.code === "MEAL_BUILDER_PREMIUM_LARGE_SALAD_INVALID_GROUP"), "invalid group rejected");

    // Group is valid but option is invalid
    const invalidOptDraft = JSON.parse(JSON.stringify(draft));
    const invalidOptRules = {
      premium_large_salad: {
        linkedProductKey: "premium_large_salad",
        groups: [
          {
            groupKey: "vegetables_legumes",
            allowedOptionKeys: ["fake_option_key"]
          }
        ]
      }
    };
    invalidOptDraft.sections[premiumSectionIdx].rules = invalidOptRules;
    res = await api.post("/api/dashboard/meal-builder/validate").set(headers).send({ sections: invalidOptDraft.sections });
    const optErrors = res.body.data.errors;
    assert(optErrors.some(e => e.code === "MEAL_BUILDER_PREMIUM_LARGE_SALAD_INVALID_OPTION"), "invalid option under valid group rejected");

    // --- TEST DYNAMIC OVERRIDES ---
    const validDraft = JSON.parse(JSON.stringify(draft));
    const validRules = {
      premium_meal: {
        linkedProductKey: "basic_meal",
        premiumProteinOptions: [
          { optionKey: "beef_steak", extraFeeHalala: 5500, enabled: true },
          { optionKey: "shrimp", extraFeeHalala: 2000, enabled: false }, // Disabled
          { optionKey: "salmon", extraFeeHalala: 3000, enabled: true }
        ]
      },
      premium_large_salad: {
        linkedProductKey: "premium_large_salad",
        extraFeeHalala: 9900,
        blockedGroupKeys: ["extra_protein_50g", "leafy_greens"], // Block leafy greens to test
        groups: [
          {
            groupKey: "vegetables_legumes",
            minSelections: 3,
            maxSelections: 7,
            allowedOptionKeys: ["cucumber"] // Restrict to cucumber
          }
        ]
      }
    };
    validDraft.sections[premiumSectionIdx].rules = validRules;
    res = await api.post("/api/dashboard/meal-builder/validate").set(headers).send({ sections: validDraft.sections });
    assert.strictEqual(res.body.data.errors.length, 0, "valid draft has no errors");

    await api.put("/api/dashboard/meal-builder/draft").set(headers).send({ sections: validDraft.sections });
    await api.post("/api/dashboard/meal-builder/publish").set(headers).send({ notes: "dynamic publish" });

    res = await api.get("/api/subscriptions/meal-planner-menu?includeLegacy=true&lang=en");
    expectStatus(res, 200, "get menu dynamic");
    menu = res.body.data;
    plannerCatalog = menu.plannerCatalog;

    pmSection = plannerCatalog.sections.find(s => s.selectionType === "premium_meal" || s.key === "premium_meal" || s.key === "premium");
    plsSection = plannerCatalog.sections.find(s => s.selectionType === "premium_large_salad" || s.key === "premium_large_salad" || s.key === "premium");

    // Premium meal proofs
    const pmProduct = pmSection.products.find(p => p.key === "basic_meal");
    const pmGroup = pmProduct.optionGroups.find(g => g.key === "proteins" || g.sourceKey === "proteins" || g.key === "protein");
    const opts = pmGroup.options;
    const beef = opts.find(o => o.key === "beef_steak" || o.premiumKey === "beef_steak");
    const shrimp = opts.find(o => o.key === "shrimp" || o.premiumKey === "shrimp");
    const salmon = opts.find(o => o.key === "salmon" || o.premiumKey === "salmon");

    assert(beef && beef.extraFeeHalala === 5500, "fee override works");
    assert(!shrimp, "disabled protein removed");
    assert(salmon, "salmon enabled stays");

    // Premium large salad proofs
    const plsProduct = plsSection.products.find(p => p.key === "premium_large_salad");
    assert.strictEqual(plsProduct.pricing.extraFeeHalala, 9900, "fee override works for salad");
    
    const leafyGreensGroup = plsProduct.optionGroups.find(g => g.key === "leafy_greens" || g.key === "leafy_green");
    assert(!leafyGreensGroup, "blocked groups removed (leafy_greens)");

    const extraProteinGroup = plsProduct.optionGroups.find(g => g.key === "extra_protein_50g" || g.key === "extra_protein");
    assert(!extraProteinGroup, "blocked groups removed (extra_protein_50g)");

    const vegGroup = plsProduct.optionGroups.find(g => g.key === "vegetables_legumes" || g.key === "vegetables");
    assert(vegGroup, "vegetables group exists");
    assert.strictEqual(vegGroup.minSelections, 3, "min override works");
    assert.strictEqual(vegGroup.maxSelections, 7, "max override works");
    
    const vegKeys = vegGroup.options.map(o => o.key);
    assert(vegKeys.includes("cucumber"), "allowed option stays");
    assert(!vegKeys.includes("tomato"), "disallowed option removed");

    // --- TEST CONFIG ONLY LISTS beef_steak ---
    const onlyBeefDraft = JSON.parse(JSON.stringify(draft));
    const onlyBeefRules = {
      premium_meal: {
        linkedProductKey: "basic_meal",
        premiumProteinOptions: [
          { optionKey: "beef_steak", extraFeeHalala: 5500, enabled: true }
        ]
      }
    };
    onlyBeefDraft.sections[premiumSectionIdx].rules = onlyBeefRules;
    res = await api.post("/api/dashboard/meal-builder/validate").set(headers).send({ sections: onlyBeefDraft.sections });
    assert.strictEqual(res.body.data.errors.length, 0, "onlyBeefDraft has no errors");

    await api.put("/api/dashboard/meal-builder/draft").set(headers).send({ sections: onlyBeefDraft.sections });
    await api.post("/api/dashboard/meal-builder/publish").set(headers).send({ notes: "only beef publish" });

    res = await api.get("/api/subscriptions/meal-planner-menu?includeLegacy=true&lang=en");
    expectStatus(res, 200, "get menu only beef");
    const onlyBeefMenu = res.body.data;
    const onlyBeefPlannerCatalog = onlyBeefMenu.plannerCatalog;
    const onlyBeefPmSection = onlyBeefPlannerCatalog.sections.find(s => s.selectionType === "premium_meal" || s.key === "premium_meal" || s.key === "premium");
    const onlyBeefPmProduct = onlyBeefPmSection.products.find(p => p.key === "basic_meal");
    const onlyBeefPmGroup = onlyBeefPmProduct.optionGroups.find(g => g.key === "proteins" || g.sourceKey === "proteins" || g.key === "protein");
    const onlyBeefOpts = onlyBeefPmGroup.options;
    const onlyBeefBeef = onlyBeefOpts.find(o => o.key === "beef_steak" || o.premiumKey === "beef_steak");
    const onlyBeefShrimp = onlyBeefOpts.find(o => o.key === "shrimp" || o.premiumKey === "shrimp");
    const onlyBeefSalmon = onlyBeefOpts.find(o => o.key === "salmon" || o.premiumKey === "salmon");
    assert(onlyBeefBeef, "beef steak exists when only beef is configured");
    assert(!onlyBeefShrimp, "shrimp is absent when only beef is configured");
    assert(!onlyBeefSalmon, "salmon is absent when only beef is configured");

    console.log("All Subscription Planner Config Tests Passed!");

  } finally {
    await disconnect();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
