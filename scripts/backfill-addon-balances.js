#!/usr/bin/env node
"use strict";

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Subscription = require("../src/models/Subscription");
const Plan = require("../src/models/Plan");
const Addon = require("../src/models/Addon");

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL || "mongodb://localhost:27017/basicdiet";
}

function hasApplyFlag() {
  return process.argv.includes("--apply");
}

function isApplyEnabled() {
  return hasApplyFlag() && String(process.env.APPLY_ADDON_BALANCE_BACKFILL || "").toLowerCase() === "true";
}

function toId(value) {
  if (!value) return null;
  if (value._id) return String(value._id);
  return String(value);
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function buildExpectedRow({ entitlement, plan, addon }) {
  const quantityPerDay = Math.max(1, numberOrZero(entitlement.quantityPerDay || entitlement.purchasedDailyQty || 1));
  const daysCount = Math.max(0, numberOrZero(plan && (plan.daysCount || plan.durationDays)));
  const includedTotalQty = Math.max(0, numberOrZero(entitlement.includedTotalQty || daysCount * quantityPerDay));
  const unitPriceHalala = numberOrZero(entitlement.unitPlanPriceHalala != null ? entitlement.unitPlanPriceHalala : entitlement.priceHalala);
  const addonPlanId = entitlement.addonPlanId || entitlement.addonId;
  return {
    addonPlanId,
    addonId: entitlement.addonId || entitlement.addonPlanId,
    name: addon && addon.name ? addon.name : (entitlement.addonPlanName || entitlement.name || ""),
    category: entitlement.category || (addon && addon.category) || "",
    purchasedDailyQty: quantityPerDay,
    includedTotalQty,
    purchasedQty: includedTotalQty,
    consumedQty: 0,
    reservedQty: 0,
    remainingQty: includedTotalQty,
    extraPurchasedQty: 0,
    overageConsumedQty: 0,
    unitIncludedPriceHalala: unitPriceHalala,
    overageUnitPriceHalala: unitPriceHalala,
    unitPriceHalala,
    currency: entitlement.currency || "SAR",
    purchasedAt: new Date(),
  };
}

function mergeExistingRow(existing, expected) {
  if (!existing) return expected;
  const consumedQty = numberOrZero(existing.consumedQty);
  const reservedQty = numberOrZero(existing.reservedQty);
  const extraPurchasedQty = numberOrZero(existing.extraPurchasedQty);
  const purchasedQty = expected.includedTotalQty + extraPurchasedQty;
  const legacyRemainingWasFull = numberOrZero(existing.remainingQty) === numberOrZero(existing.purchasedQty);
  const remainingQty = legacyRemainingWasFull
    ? Math.max(0, purchasedQty - consumedQty - reservedQty)
    : numberOrZero(existing.remainingQty);
  return {
    ...expected,
    _id: existing._id,
    consumedQty,
    reservedQty,
    extraPurchasedQty,
    overageConsumedQty: numberOrZero(existing.overageConsumedQty),
    purchasedQty,
    remainingQty,
    purchasedAt: existing.purchasedAt || expected.purchasedAt,
  };
}

function comparable(row) {
  return {
    addonPlanId: toId(row.addonPlanId || row.addonId),
    addonId: toId(row.addonId || row.addonPlanId),
    category: row.category || "",
    purchasedDailyQty: numberOrZero(row.purchasedDailyQty),
    includedTotalQty: numberOrZero(row.includedTotalQty),
    purchasedQty: numberOrZero(row.purchasedQty),
    consumedQty: numberOrZero(row.consumedQty),
    reservedQty: numberOrZero(row.reservedQty),
    remainingQty: numberOrZero(row.remainingQty),
    extraPurchasedQty: numberOrZero(row.extraPurchasedQty),
    overageConsumedQty: numberOrZero(row.overageConsumedQty),
    unitIncludedPriceHalala: numberOrZero(row.unitIncludedPriceHalala),
    overageUnitPriceHalala: numberOrZero(row.overageUnitPriceHalala),
    unitPriceHalala: numberOrZero(row.unitPriceHalala),
    currency: row.currency || "SAR",
  };
}

function rowsEqual(a, b) {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}

async function main() {
  const apply = isApplyEnabled();
  const stats = {
    scanned: 0,
    alreadyCurrent: 0,
    wouldUpdate: 0,
    updated: 0,
    skipped: 0,
    ambiguous: 0,
    errors: 0,
  };

  await mongoose.connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 });
  console.log(`[addon-balance-backfill] mode=${apply ? "apply" : "dry-run"}`);

  const cursor = Subscription.find({
    addonSubscriptions: { $exists: true, $ne: [] },
  }).cursor();

  for await (const subscription of cursor) {
    stats.scanned += 1;
    try {
      const plan = await Plan.findById(subscription.planId).lean();
      if (!plan) {
        stats.skipped += 1;
        console.warn(`[skip] subscription=${subscription._id} missing plan=${subscription.planId}`);
        continue;
      }

      const addonIds = (subscription.addonSubscriptions || [])
        .map((entitlement) => entitlement && (entitlement.addonPlanId || entitlement.addonId))
        .filter(Boolean);
      const addons = addonIds.length ? await Addon.find({ _id: { $in: addonIds } }).lean() : [];
      const addonById = new Map(addons.map((addon) => [String(addon._id), addon]));

      const nextRows = [];
      for (const entitlement of subscription.addonSubscriptions || []) {
        const planId = entitlement && (entitlement.addonPlanId || entitlement.addonId);
        if (!planId) {
          stats.ambiguous += 1;
          continue;
        }
        const existing = (subscription.addonBalance || []).find((row) => {
          const existingPlanId = toId(row.addonPlanId || row.addonId);
          return existingPlanId === String(planId) || (row.category && entitlement.category && row.category === entitlement.category);
        });
        const expected = buildExpectedRow({
          entitlement,
          plan,
          addon: addonById.get(String(planId)),
        });
        nextRows.push(mergeExistingRow(existing, expected));
      }

      const currentRows = subscription.addonBalance || [];
      const currentComparable = currentRows.map(comparable).sort((a, b) => String(a.addonId).localeCompare(String(b.addonId)));
      const nextComparable = nextRows.map(comparable).sort((a, b) => String(a.addonId).localeCompare(String(b.addonId)));
      const current = JSON.stringify(currentComparable);
      const next = JSON.stringify(nextComparable);

      if (current === next) {
        stats.alreadyCurrent += 1;
        continue;
      }

      stats.wouldUpdate += 1;
      console.log(`[update${apply ? "" : ":dry-run"}] subscription=${subscription._id} addonRows=${nextRows.length}`);

      if (apply) {
        subscription.addonBalance = nextRows;
        await subscription.save();
        stats.updated += 1;
      }
    } catch (err) {
      stats.errors += 1;
      console.error(`[error] subscription=${subscription && subscription._id} ${err.message}`);
    }
  }

  console.log("[addon-balance-backfill] summary", stats);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[addon-balance-backfill] failed", err);
  try {
    await mongoose.disconnect();
  } catch (_disconnectErr) {
    // ignore
  }
  process.exit(1);
});
