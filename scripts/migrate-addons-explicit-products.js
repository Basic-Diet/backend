const mongoose = require("mongoose");
const Addon = require("../src/models/Addon");
const Subscription = require("../src/models/Subscription");
const CheckoutDraft = require("../src/models/CheckoutDraft");
const MenuCategory = require("../src/models/MenuCategory");
const MenuProduct = require("../src/models/MenuProduct");

async function migrateAddons() {
  console.log("Starting addon explicit products migration...");

  // 1. Fetch all menu categories to build a key -> category mapping
  const categories = await MenuCategory.find({}).lean();
  const categoryMap = new Map();
  categories.forEach(cat => {
    categoryMap.set(cat.key, cat);
  });

  // 2. Fetch all menu products
  const products = await MenuProduct.find({ isActive: true }).lean();
  const productsByCategoryKey = new Map();
  products.forEach(p => {
    const categoryIdStr = String(p.categoryId);
    const matchingCat = categories.find(c => String(c._id) === categoryIdStr);
    if (matchingCat) {
      const list = productsByCategoryKey.get(matchingCat.key) || [];
      list.push(p._id);
      productsByCategoryKey.set(matchingCat.key, list);
    }
  });

  // Helper function to resolve products from category keys
  const resolveProductsForCategories = (keys) => {
    const resolvedSet = new Set();
    if (Array.isArray(keys)) {
      keys.forEach(k => {
        const prodIds = productsByCategoryKey.get(k) || [];
        prodIds.forEach(id => resolvedSet.add(String(id)));
      });
    }
    return Array.from(resolvedSet).map(id => new mongoose.Types.ObjectId(id));
  };

  // 3. Migrate Addon plans
  const addons = await Addon.find({
    kind: "plan",
    menuCategoryKeys: { $exists: true, $not: { $size: 0 } },
    menuProductIds: { $size: 0 }
  });
  console.log(`Found ${addons.length} Addon plans requiring migration.`);
  for (const addon of addons) {
    const resolvedIds = resolveProductsForCategories(addon.menuCategoryKeys);
    addon.menuProductIds = resolvedIds;
    addon.menuCategoryKeys = [];
    await addon.save();
    console.log(`Migrated Addon ${addon._id} (${addon.name?.en || ""}) with ${resolvedIds.length} products.`);
  }

  // 4. Migrate Subscriptions
  const subscriptions = await Subscription.find({
    "addonSubscriptions.menuCategoryKeys": { $exists: true, $not: { $size: 0 } }
  });
  console.log(`Found ${subscriptions.length} subscriptions requiring migration.`);
  for (const sub of subscriptions) {
    let modified = false;
    sub.addonSubscriptions.forEach(subAddon => {
      if (Array.isArray(subAddon.menuCategoryKeys) && subAddon.menuCategoryKeys.length > 0) {
        const resolvedIds = resolveProductsForCategories(subAddon.menuCategoryKeys);
        const existingSet = new Set((subAddon.menuProductIds || []).map(String));
        resolvedIds.forEach(id => existingSet.add(String(id)));
        subAddon.menuProductIds = Array.from(existingSet).map(id => new mongoose.Types.ObjectId(id));
        subAddon.menuCategoryKeys = [];
        modified = true;
      }
    });
    if (modified) {
      sub.markModified("addonSubscriptions");
      await sub.save();
      console.log(`Migrated subscription ${sub._id}.`);
    }
  }

  // 5. Migrate CheckoutDrafts
  const drafts = await CheckoutDraft.find({
    "addonSubscriptions.menuCategoryKeys": { $exists: true, $not: { $size: 0 } }
  });
  console.log(`Found ${drafts.length} CheckoutDrafts requiring migration.`);
  for (const draft of drafts) {
    let modified = false;
    draft.addonSubscriptions.forEach(subAddon => {
      if (Array.isArray(subAddon.menuCategoryKeys) && subAddon.menuCategoryKeys.length > 0) {
        const resolvedIds = resolveProductsForCategories(subAddon.menuCategoryKeys);
        const existingSet = new Set((subAddon.menuProductIds || []).map(String));
        resolvedIds.forEach(id => existingSet.add(String(id)));
        subAddon.menuProductIds = Array.from(existingSet).map(id => new mongoose.Types.ObjectId(id));
        subAddon.menuCategoryKeys = [];
        modified = true;
      }
    });
    if (modified) {
      draft.markModified("addonSubscriptions");
      await draft.save();
      console.log(`Migrated CheckoutDraft ${draft._id}.`);
    }
  }

  console.log("Migration complete.");
}

if (require.main === module) {
  require("dotenv").config();
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/basicdiet";
  mongoose.connect(MONGO_URI)
    .then(async () => {
      console.log("Connected to MongoDB");
      await migrateAddons();
      process.exit(0);
    })
    .catch(err => {
      console.error("Failed to connect to MongoDB", err);
      process.exit(1);
    });
}

module.exports = { migrateAddons };
