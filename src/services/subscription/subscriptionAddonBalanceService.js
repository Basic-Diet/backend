"use strict";

const SubscriptionDay = require("../../models/SubscriptionDay");
const { toKSADateString } = require("../../utils/date");
const { logger } = require("../../utils/logger");

async function resolveSubscriptionAddonBalanceWithAudit(subscription) {
  if (!subscription) return null;

  // 1. Audit historical consumption from SubscriptionDay records
  const auditResult = await SubscriptionDay.aggregate([
    { $match: { subscriptionId: subscription._id, status: { $nin: ["skipped", "frozen", "canceled"] } } },
    { $unwind: "$addonSelections" },
    { $match: { "addonSelections.source": "subscription" } },
    { $group: { _id: "$addonSelections.category", consumed: { $sum: 1 } } }
  ]);

  const auditedConsumptionMap = {};
  for (const row of auditResult) {
    if (row._id) {
      auditedConsumptionMap[row._id] = Number(row.consumed || 0);
    }
  }

  // 2. Attach the audited map to the subscription object (in-memory)
  subscription._auditedAddonConsumption = auditedConsumptionMap;
  return auditedConsumptionMap;
}

function buildClientAddonBalance(subscription, businessDate, auditedConsumptionMap = null) {
  if (!subscription) return undefined;

  const isSubscriptionActive = subscription.status === "active";
  const validityEndDateStr = subscription.validityEndDate
    ? toKSADateString(subscription.validityEndDate)
    : (subscription.endDate ? toKSADateString(subscription.endDate) : null);
  const isInsideValidity = !validityEndDateStr || (businessDate && businessDate <= validityEndDateStr);

  const result = {};
  let needsReviewFlag = false;

  const balances = Array.isArray(subscription.addonBalance) ? subscription.addonBalance : [];
  const entitlements = Array.isArray(subscription.addonSubscriptions) ? subscription.addonSubscriptions : [];

  const categories = ["juice", "snack", "small_salad"];

  // Fallback to in-memory audit if not provided directly
  const auditMap = auditedConsumptionMap || subscription._auditedAddonConsumption || {};

  for (const category of categories) {
    // 1. Check if we have an explicit addonBalance bucket for this category
    const bucket = balances.find(b => b.category === category);
    
    if (bucket) {
      // Modern path: addonBalance array is populated
      const remainingMeals = Number(bucket.remainingQty || 0);
      result[category] = {
        totalUnits: Number(bucket.includedTotalQty || 0),
        remainingUnits: Math.max(0, remainingMeals),
        consumedUnits: Number(bucket.consumedQty || 0),
        canConsumeNow: isSubscriptionActive && isInsideValidity && remainingMeals > 0,
        unitPolicy: "TOTAL_BALANCE_WITHIN_VALIDITY",
      };
    } else {
      // 2. Missing Balance Path: An entitlement exists but NO cumulative balance bucket exists.
      const entitlement = entitlements.find(e => e.category === category);
      if (entitlement) {
        // This subscription requires administrative review to backfill the missing addonBalance.
        needsReviewFlag = true;
        
        result[category] = {
          totalUnits: 0,
          remainingUnits: 0,
          consumedUnits: auditMap[category] || 0,
          canConsumeNow: false,
          unitPolicy: "TOTAL_BALANCE_WITHIN_VALIDITY",
          missingBalance: true
        };
      }
    }
  }

  // If any category needs review, tag the whole object so we can block selections
  if (needsReviewFlag) {
    Object.defineProperty(result, "addonBalanceNeedsReview", {
      value: true,
      enumerable: false, // Don't expose to client directly unless we want to, but useful for validation logic
    });
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

module.exports = {
  resolveSubscriptionAddonBalanceWithAudit,
  buildClientAddonBalance,
};
