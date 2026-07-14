#!/usr/bin/env node
"use strict";

require("dotenv").config();
const mongoose = require("mongoose");
const Addon = require("../src/models/Addon");
const MenuCategory = require("../src/models/MenuCategory");
const MenuProduct = require("../src/models/MenuProduct");
const Subscription = require("../src/models/Subscription");
const {
  resolveDisplayCategoryForProduct,
} = require("../src/services/subscription/subscriptionAddonChoicesService");

function localizedName(row) {
  if (!row || !row.name) return "";
  if (typeof row.name === "string") return row.name;
  return String(row.name.ar || row.name.en || "").trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { planName: "اشتراك وجبات" };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--plan-name" && args[index + 1]) {
      result.planName = args[index + 1];
      index += 1;
    }
  }
  return result;
}

async function resolveProducts(productIds) {
  const ids = (Array.isArray(productIds) ? productIds : []).map(String);
  const products = await MenuProduct.find({ _id: { $in: ids } }).lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const categoryIds = [...new Set(products.map((product) => String(product.categoryId || "")).filter(Boolean))];
  const categories = await MenuCategory.find({ _id: { $in: categoryIds } }).lean();
  const categoryById = new Map(categories.map((category) => [String(category._id), category]));
  return {
    missingProductIds: ids.filter((id) => !byId.has(id)),
    products: ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((product) => {
        const sourceCategory = categoryById.get(String(product.categoryId));
        return {
          productId: String(product._id),
          key: product.key || "",
          itemType: product.itemType || "",
          sourceCategoryKey: sourceCategory ? sourceCategory.key : "",
          displayCategory: resolveDisplayCategoryForProduct(product, sourceCategory, {
            entitlementCategory: null,
          }),
        };
      }),
  };
}

function summarizeCategoryIssue({ storedCategory, products, missingProductIds }) {
  const displayCategories = [...new Set(products.map((product) => product.displayCategory).filter(Boolean))];
  return {
    storedCategory,
    sourceCategoryKeys: [...new Set(products.map((product) => product.sourceCategoryKey).filter(Boolean))],
    displayCategories,
    missingProductIds,
    conflictsWithStoredCategory: displayCategories.length > 0 && !displayCategories.includes(storedCategory),
    hasMultipleDisplayCategories: displayCategories.length > 1,
  };
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is required");
  const { planName } = parseArgs();

  await mongoose.connect(mongoUri);

  const plans = await Addon.find({ kind: "plan" }).lean();
  const planReports = [];
  for (const plan of plans) {
    const resolved = await resolveProducts(plan.menuProductIds);
    const summary = summarizeCategoryIssue({
      storedCategory: plan.category,
      products: resolved.products,
      missingProductIds: resolved.missingProductIds,
    });
    if (
      summary.conflictsWithStoredCategory
      || summary.hasMultipleDisplayCategories
      || summary.missingProductIds.length > 0
      || localizedName(plan) === planName
    ) {
      planReports.push({
        planId: String(plan._id),
        name: localizedName(plan),
        ...summary,
        products: resolved.products,
      });
    }
  }

  const subscriptions = await Subscription.find({
    "addonSubscriptions.menuProductIds.0": { $exists: true },
  })
    .select("_id addonSubscriptions")
    .lean();
  const entitlementReports = [];
  for (const subscription of subscriptions) {
    for (const entitlement of subscription.addonSubscriptions || []) {
      const resolved = await resolveProducts(entitlement.menuProductIds);
      const summary = summarizeCategoryIssue({
        storedCategory: entitlement.category,
        products: resolved.products,
        missingProductIds: resolved.missingProductIds,
      });
      if (summary.conflictsWithStoredCategory || summary.hasMultipleDisplayCategories || summary.missingProductIds.length > 0) {
        entitlementReports.push({
          subscriptionId: String(subscription._id),
          addonPlanId: String(entitlement.addonPlanId || entitlement.addonId || ""),
          addonPlanName: entitlement.addonPlanName || entitlement.name || "",
          ...summary,
        });
      }
    }
  }

  console.log(JSON.stringify({
    mode: "read_only",
    inspectedPlanName: planName,
    planIssues: planReports,
    entitlementIssues: entitlementReports,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.stack || err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
