const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const BuilderProtein = require("../src/models/BuilderProtein");
const MenuOption = require("../src/models/MenuOption");
const MenuProduct = require("../src/models/MenuProduct");
const PremiumUpgradeConfig = require("../src/models/PremiumUpgradeConfig");
const Meal = require("../src/models/Meal");
const { resolvePremiumLargeSaladPricing } = require("../src/services/catalog/premiumLargeSaladPricingService");
const {
  PREMIUM_LARGE_SALAD_KEY,
  resolvePremiumKeyFromName,
} = require("../src/utils/subscription/premiumIdentity");

const REQUIRED_CONFIGS = ["beef_steak", "shrimp", "salmon", "qa_premium_protein", "premium_large_salad"];

async function processProteinConfig(premiumKey) {
  let createdCount = 0;
  let repairedCount = 0;
  let skippedCount = 0;
  
  const option = await MenuOption.findOne({ key: premiumKey, isActive: true });
  if (!option) {
    throw new Error(`Could not find active MenuOption for ${premiumKey}.`);
  }
  
  const expectedDelta = option.extraPriceHalala || option.extraFeeHalala || 2000;

  let existing = await PremiumUpgradeConfig.findOne({ premiumKey });
  if (!existing) {
    try {
      const config = new PremiumUpgradeConfig({
        sourceType: "menu_option",
        sourceId: option._id,
        selectionType: "premium_meal",
        premiumKey,
        displayGroupKey: "premium",
        upgradeDeltaHalala: expectedDelta,
        isEnabled: true,
        isVisible: true,
        status: "active",
        sourceSnapshot: {
          key: option.key,
          name: option.name,
          context: {}
        }
      });
      await config.save();
      createdCount++;
      return { createdCount, repairedCount, skippedCount };
    } catch (err) {
      if (err.code === 11000) {
        existing = await PremiumUpgradeConfig.findOne({ premiumKey });
      } else {
        throw err;
      }
    }
  }

  // Repair
  let needsRepair = false;
  if (existing.status !== "active" || !existing.isEnabled || !existing.isVisible || 
      existing.sourceType !== "menu_option" || String(existing.sourceId) !== String(option._id) || 
      Number(existing.upgradeDeltaHalala) !== Number(expectedDelta)) {
    needsRepair = true;
  }

  if (needsRepair) {
    existing.status = "active";
    existing.isEnabled = true;
    existing.isVisible = true;
    existing.sourceType = "menu_option";
    existing.sourceId = option._id;
    existing.upgradeDeltaHalala = expectedDelta;
    existing.revision = (existing.revision || 0) + 1;
    await existing.save();
    repairedCount++;
  } else {
    skippedCount++;
  }

  return { createdCount, repairedCount, skippedCount };
}

async function processSaladConfig() {
  let createdCount = 0;
  let repairedCount = 0;
  let skippedCount = 0;

  const saladPricing = await resolvePremiumLargeSaladPricing();
  if (!saladPricing || !saladPricing.productId) {
    throw new Error("Could not resolve premium large salad pricing.");
  }
  const product = await MenuProduct.findById(saladPricing.productId);
  if (!product) {
    throw new Error("Could not find MenuProduct for premium large salad.");
  }

  let existingSalad = await PremiumUpgradeConfig.findOne({ premiumKey: PREMIUM_LARGE_SALAD_KEY });
  const expectedDelta = saladPricing.extraFeeHalala || 2900;

  if (!existingSalad) {
    try {
      const saladConfig = new PremiumUpgradeConfig({
        sourceType: "menu_product",
        sourceId: product._id,
        selectionType: "premium_large_salad",
        premiumKey: PREMIUM_LARGE_SALAD_KEY,
        displayGroupKey: "premium",
        upgradeDeltaHalala: expectedDelta,
        isEnabled: true,
        isVisible: true,
        status: "active",
        sourceSnapshot: {
          key: product.key,
          name: product.name,
          context: {}
        }
      });
      await saladConfig.save();
      createdCount++;
      return { createdCount, repairedCount, skippedCount };
    } catch (err) {
      if (err.code === 11000) {
        existingSalad = await PremiumUpgradeConfig.findOne({ premiumKey: PREMIUM_LARGE_SALAD_KEY });
      } else {
        throw err;
      }
    }
  }

  let needsRepair = false;
  if (existingSalad.status !== "active" || !existingSalad.isEnabled || !existingSalad.isVisible || 
      existingSalad.sourceType !== "menu_product" || String(existingSalad.sourceId) !== String(product._id) || 
      Number(existingSalad.upgradeDeltaHalala) !== Number(expectedDelta)) {
    needsRepair = true;
  }

  if (needsRepair) {
    existingSalad.status = "active";
    existingSalad.isEnabled = true;
    existingSalad.isVisible = true;
    existingSalad.sourceType = "menu_product";
    existingSalad.sourceId = product._id;
    existingSalad.upgradeDeltaHalala = expectedDelta;
    existingSalad.revision = (existingSalad.revision || 0) + 1;
    await existingSalad.save();
    repairedCount++;
  } else {
    skippedCount++;
  }

  return { createdCount, repairedCount, skippedCount };
}

async function backfillPremiumUpgrades() {
  console.log("Starting Premium Upgrade Config backfill...");

  let totalCreated = 0;
  let totalRepaired = 0;
  let totalSkipped = 0;
  const unresolvedSources = [];

  // Clean up any invalid standard proteins that might have been configured as premium manually (e.g. during testing)
  const cleanupResult = await PremiumUpgradeConfig.deleteMany({ premiumKey: "chicken_fajita" });
  if (cleanupResult.deletedCount > 0) {
    console.log(`Cleaned up ${cleanupResult.deletedCount} invalid chicken_fajita configs.`);
  }

  for (const key of REQUIRED_CONFIGS) {
    try {
      let res;
      if (key === PREMIUM_LARGE_SALAD_KEY) {
        res = await processSaladConfig();
      } else {
        res = await processProteinConfig(key);
      }
      totalCreated += res.createdCount;
      totalRepaired += res.repairedCount;
      totalSkipped += res.skippedCount;
    } catch (err) {
      unresolvedSources.push({ premiumKey: key, error: err.message });
    }
  }

  // legacy meals compatibility migration
  let mealIdentityBackfilledCount = 0;
  const legacyPremiumMeals = await Meal.find({
    type: "premium",
    $or: [{ premiumKey: null }, { premiumKey: "" }, { premiumKey: { $exists: false } }],
  });
  for (const meal of legacyPremiumMeals) {
    const premiumKey = resolvePremiumKeyFromName(meal.name?.en || meal.name?.ar || "");
    if (!premiumKey) {
      // not adding to unresolvedSources to not fail script for legacy meal name mismatch
      continue;
    }
    meal.premiumKey = premiumKey;
    await meal.save();
    mealIdentityBackfilledCount++;
  }

  console.log(`Backfill complete. Created: ${totalCreated}, Repaired: ${totalRepaired}, Skipped: ${totalSkipped}, Meal identities: ${mealIdentityBackfilledCount}`);
  if (unresolvedSources.length > 0) {
    console.error("Unresolved premium upgrade sources (failing loudly):", JSON.stringify(unresolvedSources, null, 2));
    throw new Error("Failed to ensure all required premium configs.");
  }
  return { createdCount: totalCreated, repairedCount: totalRepaired, skippedCount: totalSkipped, mealIdentityBackfilledCount, unresolvedSources };
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await backfillPremiumUpgrades();
    process.exit(0);
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { backfillPremiumUpgrades };
