#!/usr/bin/env node

require("dotenv").config();
const mongoose = require("mongoose");
const Addon = require("../../src/models/Addon");
const { resolveMongoUri } = require("../../src/utils/mongoUriResolver");

const CANONICAL_ONETIME_ADDONS = [
  "orange_juice",
  "apple_juice",
  "mango_juice",
  "protein_snack",
  "healthy_dessert",
  "snack_box"
];

function getCanonicalAddonKey(addon) {
  if (addon.key) return addon.key;
  if (addon.product && addon.product.key) return addon.product.key;
  if (addon.menuProduct && addon.menuProduct.key) return addon.menuProduct.key;
  if (addon.name && addon.name.en) {
    return addon.name.en.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  return null;
}

async function cleanupPollutedAddons() {
  const addons = await Addon.find({ isActive: true, kind: "item", billingMode: "flat_once" });
  let matched = 0;

  for (const addon of addons) {
    const key = getCanonicalAddonKey(addon);
    const isPolluted = !key || !CANONICAL_ONETIME_ADDONS.includes(key);

    if (isPolluted) {
      console.log(`Deactivating polluted one-time addon: ${addon.name.en} (resolved key: ${key})`);
      addon.isActive = false;
      await addon.save();
      matched++;
    }
  }

  console.log(`Cleanup complete. Deactivated ${matched} polluted one-time addons.`);
}

async function main() {
  const uri = resolveMongoUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB for polluted addon cleanup.");

  try {
    await cleanupPollutedAddons();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(`[cleanup-polluted-addons] ${err.message}`);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  });
}

module.exports = {
  cleanupPollutedAddons,
};
