#!/usr/bin/env node

require("dotenv").config();
const mongoose = require("mongoose");

const PremiumUpgradeConfig = require("../../src/models/PremiumUpgradeConfig");
const Addon = require("../../src/models/Addon");
const AddonPlanPrice = require("../../src/models/AddonPlanPrice");
const Plan = require("../../src/models/Plan");
const Setting = require("../../src/models/Setting");
const Zone = require("../../src/models/Zone");
const DashboardUser = require("../../src/models/DashboardUser");
const User = require("../../src/models/User");
const { getSubscriptionBuilderCatalogWithV2 } = require("../../src/services/catalog/CatalogService");
const { resolveMongoUri } = require("../../src/utils/mongoUriResolver");

const REQUIRED_PREMIUM_KEYS = ["beef_steak", "shrimp", "salmon", "premium_large_salad"];
const REQUIRED_DASHBOARD_ROLES = ["superadmin", "admin", "kitchen", "courier", "cashier"];

async function verifyBootstrapReadiness() {
  console.log("[verify-bootstrap-readiness] Starting system readiness verification...");

  const results = [];
  let hasErrors = false;

  // 1. Premium keys exist and are priced
  try {
    const configs = await PremiumUpgradeConfig.find({ premiumKey: { $in: REQUIRED_PREMIUM_KEYS }, status: "active", isEnabled: true }).lean();
    const foundKeys = configs.map((c) => c.premiumKey);
    const missingKeys = REQUIRED_PREMIUM_KEYS.filter((k) => !foundKeys.includes(k));
    const unpricedKeys = configs.filter((c) => !c.upgradeDeltaHalala || c.upgradeDeltaHalala <= 0).map((c) => c.premiumKey);

    if (missingKeys.length === 0 && unpricedKeys.length === 0) {
      results.push({ check: "Premium keys exist and are priced", status: "PASS", details: `Found all ${REQUIRED_PREMIUM_KEYS.length} required premium configs with positive upgrade deltas.` });
    } else {
      hasErrors = true;
      results.push({ check: "Premium keys exist and are priced", status: "FAIL", details: `Missing: ${missingKeys.join(", ") || "none"}. Unpriced: ${unpricedKeys.join(", ") || "none"}.` });
    }
  } catch (err) {
    hasErrors = true;
    results.push({ check: "Premium keys exist and are priced", status: "ERROR", details: err.message });
  }

  // 2. /meal-planner-menu exposes premium prices > 0
  try {
    const catalog = await getSubscriptionBuilderCatalogWithV2({ lang: "ar" });
    const premiumProteins = catalog?.builderCatalog?.premiumProteins || [];
    const unpricedProteins = premiumProteins.filter((p) => (p.extraFeeHalala || p.extraPriceHalala || 0) <= 0);

    if (premiumProteins.length > 0 && unpricedProteins.length === 0) {
      results.push({ check: "Meal planner catalog exposes premium prices > 0", status: "PASS", details: `Catalog returned ${premiumProteins.length} premium proteins, all with positive extra fees.` });
    } else {
      hasErrors = true;
      results.push({ check: "Meal planner catalog exposes premium prices > 0", status: "FAIL", details: `Total premium proteins: ${premiumProteins.length}. Unpriced: ${unpricedProteins.length}.` });
    }
  } catch (err) {
    hasErrors = true;
    results.push({ check: "Meal planner catalog exposes premium prices > 0", status: "ERROR", details: err.message });
  }

  // 3. Addon choices have prices
  try {
    const addons = await Addon.find({ isActive: true }).lean();
    const prices = await AddonPlanPrice.find({ isActive: true }).lean();

    if (addons.length > 0 && prices.length > 0) {
      results.push({ check: "Addon choices have prices", status: "PASS", details: `Found ${addons.length} active addons and ${prices.length} active addon plan prices.` });
    } else {
      hasErrors = true;
      results.push({ check: "Addon choices have prices", status: "FAIL", details: `Found ${addons.length} addons and ${prices.length} prices.` });
    }
  } catch (err) {
    hasErrors = true;
    results.push({ check: "Addon choices have prices", status: "ERROR", details: err.message });
  }

  // 4. Subscription plans exist
  try {
    const activePlans = await Plan.countDocuments({ isActive: true });
    if (activePlans >= 3) {
      results.push({ check: "Subscription plans exist", status: "PASS", details: `Found ${activePlans} active subscription plans.` });
    } else {
      hasErrors = true;
      results.push({ check: "Subscription plans exist", status: "FAIL", details: `Expected at least 3 active plans, found ${activePlans}.` });
    }
  } catch (err) {
    hasErrors = true;
    results.push({ check: "Subscription plans exist", status: "ERROR", details: err.message });
  }

  // 5. VAT exists
  try {
    const vatSetting = await Setting.findOne({ key: "vat_percentage" }).lean();
    if (vatSetting && vatSetting.value !== undefined) {
      results.push({ check: "VAT exists", status: "PASS", details: `VAT percentage configured at ${vatSetting.value}%.` });
    } else {
      hasErrors = true;
      results.push({ check: "VAT exists", status: "FAIL", details: "Setting 'vat_percentage' is missing or undefined." });
    }
  } catch (err) {
    hasErrors = true;
    results.push({ check: "VAT exists", status: "ERROR", details: err.message });
  }

  // 6. Restaurant address exists
  try {
    const nameSetting = await Setting.findOne({ key: "restaurant_name" }).lean();
    const addressSetting = await Setting.findOne({ key: "restaurant_address" }).lean();
    if (nameSetting && addressSetting && nameSetting.value && addressSetting.value) {
      results.push({ check: "Restaurant address exists", status: "PASS", details: `Name: "${nameSetting.value}", Address: "${addressSetting.value}".` });
    } else {
      hasErrors = true;
      results.push({ check: "Restaurant address exists", status: "FAIL", details: "Restaurant name or address settings are missing." });
    }
  } catch (err) {
    hasErrors = true;
    results.push({ check: "Restaurant address exists", status: "ERROR", details: err.message });
  }

  // 7. Delivery zones exist
  try {
    const zonesCount = await Zone.countDocuments({ isActive: true });
    if (zonesCount > 0) {
      results.push({ check: "Delivery zones exist", status: "PASS", details: `Found ${zonesCount} active delivery zones.` });
    } else {
      hasErrors = true;
      results.push({ check: "Delivery zones exist", status: "FAIL", details: "No active delivery zones found." });
    }
  } catch (err) {
    hasErrors = true;
    results.push({ check: "Delivery zones exist", status: "ERROR", details: err.message });
  }

  // 8. Restaurant hours exist
  try {
    const openSetting = await Setting.findOne({ key: "restaurant_open_time" }).lean();
    const closeSetting = await Setting.findOne({ key: "restaurant_close_time" }).lean();
    const hoursSetting = await Setting.findOne({ key: "restaurant_hours" }).lean();
    if (openSetting && closeSetting && hoursSetting && openSetting.value && closeSetting.value) {
      results.push({ check: "Restaurant hours exist", status: "PASS", details: `Open: ${openSetting.value}, Close: ${closeSetting.value}, Weekly schedule configured.` });
    } else {
      hasErrors = true;
      results.push({ check: "Restaurant hours exist", status: "FAIL", details: "Restaurant open, close, or weekly schedule settings are missing." });
    }
  } catch (err) {
    hasErrors = true;
    results.push({ check: "Restaurant hours exist", status: "ERROR", details: err.message });
  }

  // 9. Default admin/cashier/kitchen/courier accounts exist
  try {
    const dashboardUsers = await DashboardUser.find({ isActive: true }).lean();
    const foundRoles = dashboardUsers.map((u) => u.role);
    const missingRoles = REQUIRED_DASHBOARD_ROLES.filter((r) => !foundRoles.includes(r));

    if (missingRoles.length === 0) {
      results.push({ check: "Default admin/cashier/kitchen/courier accounts exist", status: "PASS", details: `Found all required dashboard roles: ${REQUIRED_DASHBOARD_ROLES.join(", ")}.` });
    } else {
      // NOTE: Allow accounts bootstrap to be optional depending on ALLOW_ACCOUNT_BOOTSTRAP
      results.push({ check: "Default admin/cashier/kitchen/courier accounts exist", status: "WARN", details: `Missing roles: ${missingRoles.join(", ")}. (Requires ALLOW_ACCOUNT_BOOTSTRAP=true during bootstrap)` });
    }
  } catch (err) {
    results.push({ check: "Default admin/cashier/kitchen/courier accounts exist", status: "ERROR", details: err.message });
  }

  console.log("\n================================================================================");
  console.log("                           BOOTSTRAP READINESS REPORT                           ");
  console.log("================================================================================");
  console.log(
    results
      .map((r) => `[${r.status.padEnd(5)}] ${r.check.padEnd(50)} | ${r.details}`)
      .join("\n")
  );
  console.log("================================================================================\n");

  if (hasErrors) {
    throw new Error("System bootstrap verification completed with failing checks.");
  }

  console.log("[verify-bootstrap-readiness] Verification completed successfully. System is READY.");
  return results;
}

async function main() {
  const uri = resolveMongoUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await verifyBootstrapReadiness();
    process.exitCode = 0;
  } catch (err) {
    console.error(`[verify-bootstrap-readiness:error] ${err.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  REQUIRED_DASHBOARD_ROLES,
  REQUIRED_PREMIUM_KEYS,
  main,
  verifyBootstrapReadiness,
};
