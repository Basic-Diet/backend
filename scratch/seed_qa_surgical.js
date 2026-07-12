const mongoose = require("mongoose");
const path = require("path");

// Load models
const CatalogItem = require("../src/models/CatalogItem");
const MenuOption = require("../src/models/MenuOption");
const MenuOptionGroup = require("../src/models/MenuOptionGroup");
const BuilderCategory = require("../src/models/BuilderCategory");
const BuilderProtein = require("../src/models/BuilderProtein");
const MenuProduct = require("../src/models/MenuProduct");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const PremiumUpgradeConfig = require("../src/models/PremiumUpgradeConfig");

// Load services
const { backfillPremiumUpgrades } = require("../scripts/backfill-premium-upgrades");
const { getReadiness } = require("../src/services/subscription/premiumUpgradeConfigService");

const prodUri = "mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  try {
    console.log("Connecting to production DB...");
    await mongoose.connect(prodUri);
    console.log("Connected successfully.\n");

    const nameI18n = {
      ar: "بروتين فحص الجودة آمن للتعديل",
      en: "QA Premium Protein (Safe to Mutate)"
    };

    // 1. Seed/Upsert CatalogItem
    console.log("Seeding CatalogItem...");
    const catalogItem = await CatalogItem.findOneAndUpdate(
      { key: "qa_premium_protein" },
      {
        $setOnInsert: { key: "qa_premium_protein" },
        $set: {
          nameI18n,
          itemKind: "protein",
          nutrition: { calories: 250 },
          isActive: true,
          isAvailable: true
        }
      },
      { upsert: true, new: true }
    );
    console.log(`CatalogItem id: ${catalogItem._id}`);

    // 2. Find MenuOptionGroup for "proteins"
    const proteinGroup = await MenuOptionGroup.findOne({ key: "proteins" });
    if (!proteinGroup) {
      throw new Error("Could not find MenuOptionGroup with key 'proteins'");
    }
    console.log(`MenuOptionGroup (proteins) id: ${proteinGroup._id}`);

    // 3. Seed/Upsert MenuOption
    console.log("Seeding MenuOption...");
    const menuOption = await MenuOption.findOneAndUpdate(
      { groupId: proteinGroup._id, key: "qa_premium_protein" },
      {
        $setOnInsert: { groupId: proteinGroup._id, key: "qa_premium_protein" },
        $set: {
          name: nameI18n,
          catalogItemId: catalogItem._id,
          availableFor: ["one_time", "subscription"],
          availableForSubscription: true,
          nutrition: {
            calories: 250,
            proteinGrams: 0,
            carbGrams: 0,
            fatGrams: 0
          },
          extraPriceHalala: 0,
          extraWeightPriceHalala: 0,
          extraWeightUnitGrams: 0,
          extraFeeHalala: 0,
          premiumKey: "",
          proteinFamilyKey: "beef",
          displayCategoryKey: "",
          selectionType: "",
          ruleTags: [],
          isActive: true,
          isVisible: true,
          isAvailable: true,
          publishedAt: new Date(),
          sortOrder: 260
        }
      },
      { upsert: true, new: true }
    );
    console.log(`MenuOption id: ${menuOption._id}`);

    // 4. Find BuilderCategory for "protein:premium"
    const builderCategory = await BuilderCategory.findOne({ dimension: "protein", key: "premium" });
    if (!builderCategory) {
      throw new Error("Could not find BuilderCategory for protein:premium");
    }
    console.log(`BuilderCategory id: ${builderCategory._id}`);

    // 5. Seed/Upsert BuilderProtein
    console.log("Seeding BuilderProtein...");
    const builderProtein = await BuilderProtein.findOneAndUpdate(
      { key: "qa_premium_protein" },
      {
        $setOnInsert: { key: "qa_premium_protein" },
        $set: {
          name: nameI18n,
          displayCategoryId: builderCategory._id,
          displayCategoryKey: "premium",
          proteinFamilyKey: "beef",
          selectionType: "premium_meal",
          isPremium: true,
          premiumKey: "qa_premium_protein",
          extraFeeHalala: 2000,
          isActive: true,
          isAvailable: true,
          sortOrder: 80,
          nutrition: {
            calories: 250,
            proteinGrams: 0,
            carbGrams: 0,
            fatGrams: 0
          }
        }
      },
      { upsert: true, new: true }
    );
    console.log(`BuilderProtein id: ${builderProtein._id}`);

    // 6. Find MenuProduct "basic_meal"
    const basicMealProduct = await MenuProduct.findOne({ key: "basic_meal" });
    if (!basicMealProduct) {
      throw new Error("Could not find MenuProduct basic_meal");
    }
    console.log(`MenuProduct (basic_meal) id: ${basicMealProduct._id}`);

    // 7. Seed/Upsert ProductGroupOption
    console.log("Seeding ProductGroupOption...");
    const productGroupOption = await ProductGroupOption.findOneAndUpdate(
      { productId: basicMealProduct._id, groupId: proteinGroup._id, optionId: menuOption._id },
      {
        $setOnInsert: { productId: basicMealProduct._id, groupId: proteinGroup._id, optionId: menuOption._id },
        $set: {
          extraPriceHalala: 2000, // Premium surcharge (20 SAR)
          extraWeightUnitGrams: 0,
          extraWeightPriceHalala: 0,
          isActive: true,
          isVisible: true,
          isAvailable: true,
          sortOrder: 80
        }
      },
      { upsert: true, new: true }
    );
    console.log(`ProductGroupOption id: ${productGroupOption._id}`);

    // 8. Run the config backfill script
    console.log("\nRunning backfillPremiumUpgrades()...");
    const backfillResult = await backfillPremiumUpgrades();
    console.log("Backfill result:", JSON.stringify(backfillResult, null, 2));

    // 9. Verify readiness
    console.log("\nChecking premium readiness...");
    const readiness = await getReadiness();
    console.log("Readiness result:", JSON.stringify(readiness, null, 2));

  } catch (err) {
    console.error("Error running surgical seed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from DB.");
  }
}

main();
