"use strict";

const mongoose = require("mongoose");
const User = require("../../models/User");
const Plan = require("../../models/Plan");
const Subscription = require("../../models/Subscription");
const ActivityLog = require("../../models/ActivityLog");
const { getRestaurantBusinessDate } = require("../restaurantHoursService");
const { runMongoTransactionWithRetry } = require("../mongoTransactionRetryService");
const { ACTIVE_STATUS, MANUAL_DEDUCTION_ACTION } = require("./manualDeduction/constants");
const { ManualDeductionError, assertCashierOrAdminRole } = require("./manualDeduction/ManualDeductionError");
const {
  buildPremiumAllocation,
  chooseDefaultSubscription,
  resolveAddonBalances,
  resolveBalances,
  validateBalances,
  validateCounts,
  validateSubscriptionCanDeduct,
} = require("./manualDeduction/manualDeductionPolicy");
const {
  buildDeductionLog,
  buildDeductionResponse,
  serializeCustomer,
  serializeManualDeductionLog,
  serializeSubscription,
} = require("./manualDeduction/manualDeductionPresenter");

async function findLastManualDeduction(subscriptionId, businessDate = null, session = null) {
  const query = {
    entityType: "subscription",
    entityId: subscriptionId,
    action: MANUAL_DEDUCTION_ACTION,
  };
  if (businessDate) {
    query["meta.businessDate"] = businessDate;
  }
  let cursor = ActivityLog.findOne(query).sort({ createdAt: -1 });
  if (session) cursor = cursor.session(session);
  return cursor.lean();
}

async function buildTodaySummary(subscription, businessDate) {
  const lastToday = await findLastManualDeduction(subscription._id, businessDate);
  const lastAny = lastToday || await findLastManualDeduction(subscription._id);
  return {
    businessDate,
    hasDeliveryDeductionToday: subscription.deliveryMode === "delivery" && Boolean(lastToday),
    lastDeductionAt: lastAny ? lastAny.createdAt || null : null,
  };
}

async function searchByPhone({ phone, role, lang = "en" }) {
  assertCashierOrAdminRole(role);
  const normalizedPhone = String(phone || "").trim();
  if (!normalizedPhone) {
    throw new ManualDeductionError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
  }

  const user = await User.findOne({ phone: normalizedPhone }).lean();
  if (!user) {
    throw new ManualDeductionError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
  }

  const activeSubscriptions = await Subscription.find({
    userId: user._id,
    status: ACTIVE_STATUS,
  }).sort({ createdAt: -1 }).lean();

  if (!activeSubscriptions.length) {
    throw new ManualDeductionError("SUBSCRIPTION_NOT_FOUND", "Active subscription not found", 404);
  }

  const businessDate = await getRestaurantBusinessDate();
  const defaultSubscription = chooseDefaultSubscription(activeSubscriptions, businessDate);
  const planIds = [...new Set(activeSubscriptions.map((sub) => String(sub.planId)).filter(Boolean))];
  const plans = await Plan.find({ _id: { $in: planIds } }).lean();
  const planMap = new Map(plans.map((plan) => [String(plan._id), plan]));
  const today = await buildTodaySummary(defaultSubscription, businessDate);

  return {
    customer: serializeCustomer(user),
    subscription: serializeSubscription(defaultSubscription, planMap.get(String(defaultSubscription.planId)), lang),
    subscriptions: activeSubscriptions.map((sub) => serializeSubscription(sub, planMap.get(String(sub.planId)), lang)),
    today,
  };
}

async function validateSubscriptionCustomerExists(subscription, session) {
  const customer = await User.exists({ _id: subscription.userId }).session(session);
  if (!customer) {
    throw new ManualDeductionError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
  }
}

async function deductAtomically({ subscription, counts, session }) {
  const allocations = buildPremiumAllocation(subscription, counts.premiumMeals);
  const filter = {
    _id: subscription._id,
    status: ACTIVE_STATUS,
    remainingMeals: { $gte: counts.total },
  };
  
  const andClauses = [];
  if (allocations.length) {
    andClauses.push(...allocations.map((allocation) => ({
      premiumBalance: {
        $elemMatch: {
          _id: allocation.rowId,
          remainingQty: { $gte: allocation.qty },
        },
      },
    })));
  }

  if (counts.addons && counts.addons.length > 0) {
    andClauses.push(...counts.addons.map((addonReq) => ({
      addonBalance: {
        $elemMatch: {
          addonId: new mongoose.Types.ObjectId(addonReq.addonId),
          remainingQty: { $gte: addonReq.qty },
        },
      },
    })));
  }

  if (andClauses.length > 0) {
    filter.$and = andClauses;
  }

  const update = {};
  if (counts.total > 0) {
    update.$inc = { remainingMeals: -counts.total };
  }
  
  const options = { new: true, session };
  const arrayFilters = [];
  
  if (allocations.length) {
    if (!update.$inc) update.$inc = {};
    allocations.forEach((allocation, index) => {
      update.$inc[`premiumBalance.$[p${index}].remainingQty`] = -allocation.qty;
      arrayFilters.push({ [`p${index}._id`]: allocation.rowId });
    });
  }

  if (counts.addons && counts.addons.length > 0) {
    if (!update.$inc) update.$inc = {};
    counts.addons.forEach((addonReq, index) => {
      update.$inc[`addonBalance.$[a${index}].remainingQty`] = -addonReq.qty;
      arrayFilters.push({ [`a${index}.addonId`]: new mongoose.Types.ObjectId(addonReq.addonId) });
    });
  }

  if (arrayFilters.length > 0) {
    options.arrayFilters = arrayFilters;
  }

  const updated = await Subscription.findOneAndUpdate(filter, update, options);
  if (!updated) {
    throw new ManualDeductionError("INSUFFICIENT_REMAINING_MEALS", "Subscription balance changed; not enough remaining balance", 409);
  }
  return updated;
}

async function ensureNoDeliveryDeductionToday(subscription, businessDate, session) {
  if (subscription.deliveryMode !== "delivery") return;
  const existing = await findLastManualDeduction(subscription._id, businessDate, session);
  if (existing) {
    throw new ManualDeductionError("DELIVERY_ALREADY_DEDUCTED_TODAY", "Delivery subscription already deducted today", 409);
  }
}

async function createDeductionLog({ subscription, counts, before, after, actorId, actorRole, reason, notes, businessDate, session }) {
  const log = buildDeductionLog({ subscription, counts, before, after, actorId, actorRole, reason, notes, businessDate });
  await ActivityLog.create([log], { session });
}

async function manualDeduction({ subscriptionId, body, actorId, actorRole }) {
  assertCashierOrAdminRole(actorRole);
  if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
    throw new ManualDeductionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found", 404);
  }

  const counts = validateCounts(body || {});
  const businessDate = await getRestaurantBusinessDate();

  try {
    return await runMongoTransactionWithRetry(async (session) => {
      const subscription = await Subscription.findById(subscriptionId).session(session);
      validateSubscriptionCanDeduct(subscription);
      await validateSubscriptionCustomerExists(subscription, session);
      await ensureNoDeliveryDeductionToday(subscription, businessDate, session);
      const before = validateBalances(subscription, counts);
      const updated = await deductAtomically({ subscription, counts, session });
      const after = resolveBalances(updated);
      const afterAddonBalances = resolveAddonBalances(updated);

      await createDeductionLog({
        subscription: updated,
        counts,
        before,
        after,
        actorId,
        actorRole,
        reason: body && body.reason,
        notes: body && body.notes,
        businessDate,
        session,
      });

      return buildDeductionResponse({
        subscription: updated,
        counts,
        balances: after,
        addonBalances: afterAddonBalances,
        businessDate,
      });
    }, {
      label: "manual_subscription_deduction",
      context: { subscriptionId: String(subscriptionId) },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ManualDeductionError("DELIVERY_ALREADY_DEDUCTED_TODAY", "Delivery subscription already deducted today", 409);
    }
    throw err;
  }
}

async function listManualDeductions({ subscriptionId, role, limit = 50 }) {
  assertCashierOrAdminRole(role);
  if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
    throw new ManualDeductionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found", 404);
  }

  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const logs = await ActivityLog.find({
    entityType: "subscription",
    entityId: subscriptionId,
    action: MANUAL_DEDUCTION_ACTION,
  }).sort({ createdAt: -1 }).limit(cappedLimit).lean();

  return {
    contractVersion: "dashboard_manual_deductions.v1",
    subscriptionId: String(subscriptionId),
    count: logs.length,
    items: logs.map(serializeManualDeductionLog),
  };
}

module.exports = {
  MANUAL_DEDUCTION_ACTION,
  ManualDeductionError,
  listManualDeductions,
  resolveBalances,
  searchByPhone,
  manualDeduction,
  serializeManualDeductionLog,
};
