"use strict";

const mongoose = require("mongoose");
const User = require("../../models/User");
const Plan = require("../../models/Plan");
const Subscription = require("../../models/Subscription");
const ActivityLog = require("../../models/ActivityLog");
const { pickLang } = require("../../utils/i18n");
const { getRestaurantBusinessDate } = require("../restaurantHoursService");
const { runMongoTransactionWithRetry } = require("../mongoTransactionRetryService");

const MANUAL_DEDUCTION_ACTION = "manual_subscription_meal_deduction";
const ACTIVE_STATUS = "active";

class ManualDeductionError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function assertCashierOrAdminRole(role) {
  if (!["admin", "superadmin", "cashier"].includes(String(role || ""))) {
    throw new ManualDeductionError("FORBIDDEN", "Dashboard admin or cashier permission is required", 403);
  }
}

function normalizeCount(value) {
  if (value === undefined || value === null || value === "") return 0;
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return NaN;
  return numeric;
}

function resolvePremiumRemaining(subscription) {
  return (Array.isArray(subscription && subscription.premiumBalance) ? subscription.premiumBalance : [])
    .reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row && row.remainingQty) || 0)), 0);
}

function resolveBalances(subscription) {
  const totalMeals = Math.max(0, Math.floor(Number(subscription && subscription.totalMeals) || 0));
  const remainingMeals = Math.max(0, Math.floor(Number(subscription && subscription.remainingMeals) || 0));
  const remainingPremiumMeals = resolvePremiumRemaining(subscription);
  const remainingRegularMeals = Math.max(0, remainingMeals - remainingPremiumMeals);
  return {
    totalMeals,
    consumedMeals: Math.max(0, totalMeals - remainingMeals),
    remainingMeals,
    remainingRegularMeals,
    remainingPremiumMeals,
  };
}

function resolveAddonBalances(subscription) {
  if (!subscription || !Array.isArray(subscription.addonBalance)) return [];
  const entitlements = Array.isArray(subscription.addonSubscriptions) ? subscription.addonSubscriptions : [];

  return subscription.addonBalance.map(row => {
    const entitlement = entitlements.find(e => String(e.addonId) === String(row.addonId));
    const name = entitlement ? (entitlement.name || entitlement.addonPlanName || "") : "";
    const remainingQty = Math.max(0, Math.floor(Number(row.remainingQty) || 0));
    const totalQty = Math.max(0, Math.floor(Number(row.purchasedQty) || 0));
    return {
      addonId: String(row.addonId),
      name,
      remainingQty,
      totalQty,
      consumedQty: Math.max(0, totalQty - remainingQty),
    };
  });
}

function serializeCustomer(user) {
  return {
    id: String(user._id),
    name: user.name || "",
    phone: user.phone || "",
  };
}

function serializeSubscription(subscription, plan, lang = "en") {
  const balances = resolveBalances(subscription);
  const addonBalances = resolveAddonBalances(subscription);
  return {
    id: String(subscription._id),
    planName: plan ? pickLang(plan.name, lang) || pickLang(plan.name, "en") || "" : "",
    status: subscription.status,
    fulfillmentMethod: subscription.deliveryMode === "pickup" ? "pickup" : "delivery",
    totalMeals: balances.totalMeals,
    consumedMeals: balances.consumedMeals,
    remainingMeals: balances.remainingMeals,
    remainingRegularMeals: balances.remainingRegularMeals,
    remainingPremiumMeals: balances.remainingPremiumMeals,
    addonBalances,
  };
}

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

function chooseDefaultSubscription(subscriptions, businessDate) {
  const current = subscriptions.find((sub) => {
    const start = sub.startDate ? String(sub.startDate.toISOString()).slice(0, 10) : null;
    const endDate = sub.validityEndDate || sub.endDate || null;
    const end = endDate ? String(endDate.toISOString()).slice(0, 10) : null;
    return (!start || start <= businessDate) && (!end || end >= businessDate);
  });
  return current || subscriptions[0] || null;
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

function validateCounts({ regularMeals, premiumMeals, addons }) {
  const regular = normalizeCount(regularMeals);
  const premium = normalizeCount(premiumMeals);

  let validAddons = [];
  let addonsTotal = 0;
  if (addons && Array.isArray(addons)) {
    validAddons = addons.map(a => {
      const qty = normalizeCount(a.qty);
      if (!a.addonId || qty < 0) {
        throw new ManualDeductionError("INVALID_ADDON_COUNT", "Invalid addon count or missing addonId", 400);
      }
      addonsTotal += qty;
      return { addonId: String(a.addonId), qty };
    }).filter(a => a.qty > 0);
  }

  if (
    !Number.isInteger(regular)
    || !Number.isInteger(premium)
    || regular < 0
    || premium < 0
    || (regular + premium + addonsTotal) <= 0
  ) {
    throw new ManualDeductionError("INVALID_MEAL_COUNT", "Invalid meal or addon count", 400);
  }
  return { regularMeals: regular, premiumMeals: premium, total: regular + premium, addons: validAddons };
}

function validateSubscriptionCanDeduct(subscription) {
  if (!subscription) {
    throw new ManualDeductionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found", 404);
  }
  if (subscription.status !== ACTIVE_STATUS) {
    throw new ManualDeductionError("SUBSCRIPTION_NOT_ACTIVE", "Subscription is not active", 409);
  }
}

async function validateSubscriptionCustomerExists(subscription, session) {
  const customer = await User.exists({ _id: subscription.userId }).session(session);
  if (!customer) {
    throw new ManualDeductionError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
  }
}

function validateBalances(subscription, counts) {
  const balances = resolveBalances(subscription);
  if (counts.total > balances.remainingMeals) {
    throw new ManualDeductionError("INSUFFICIENT_REMAINING_MEALS", "Not enough remaining meals", 409);
  }
  if (counts.regularMeals > balances.remainingRegularMeals) {
    throw new ManualDeductionError("INSUFFICIENT_REGULAR_MEALS", "Not enough regular meals", 409);
  }
  if (counts.premiumMeals > balances.remainingPremiumMeals) {
    throw new ManualDeductionError("INSUFFICIENT_PREMIUM_MEALS", "Not enough premium meals", 409);
  }

  const addonBalances = resolveAddonBalances(subscription);
  const beforeAddons = [];
  for (const addonReq of counts.addons) {
    const balance = addonBalances.find(b => String(b.addonId) === String(addonReq.addonId));
    if (!balance) {
      throw new ManualDeductionError("UNKNOWN_ADDON", `Unknown addon: ${addonReq.addonId}`, 404);
    }
    if (addonReq.qty > balance.remainingQty) {
      throw new ManualDeductionError("INSUFFICIENT_ADDON_BALANCE", `Not enough balance for addon: ${addonReq.addonId}`, 409);
    }
    beforeAddons.push({
      addonId: addonReq.addonId,
      qty: addonReq.qty,
      remainingBefore: balance.remainingQty
    });
  }

  return { ...balances, beforeAddons };
}

function buildPremiumAllocation(subscription, premiumMeals) {
  let remaining = premiumMeals;
  const rows = (Array.isArray(subscription.premiumBalance) ? subscription.premiumBalance : [])
    .filter((row) => row && row._id && Number(row.remainingQty || 0) > 0)
    .sort((a, b) => {
      const dateA = a.purchasedAt ? new Date(a.purchasedAt).getTime() : 0;
      const dateB = b.purchasedAt ? new Date(b.purchasedAt).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      return String(a._id).localeCompare(String(b._id));
    });

  const allocations = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const qty = Math.min(remaining, Math.max(0, Math.floor(Number(row.remainingQty) || 0)));
    if (qty > 0) {
      allocations.push({ rowId: row._id, qty });
      remaining -= qty;
    }
  }
  if (remaining > 0) {
    throw new ManualDeductionError("INSUFFICIENT_PREMIUM_MEALS", "Not enough premium meals", 409);
  }
  return allocations;
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
  const deductedAddons = before.beforeAddons ? before.beforeAddons.map(b => ({
    addonId: String(b.addonId),
    qty: b.qty,
    remainingBefore: b.remainingBefore,
    remainingAfter: Math.max(0, b.remainingBefore - b.qty)
  })) : [];

  const log = {
    entityType: "subscription",
    entityId: subscription._id,
    action: MANUAL_DEDUCTION_ACTION,
    byUserId: actorId,
    byRole: actorRole,
    meta: {
      subscriptionId: String(subscription._id),
      customerId: String(subscription.userId),
      deductedRegularMeals: counts.regularMeals,
      deductedPremiumMeals: counts.premiumMeals,
      deductedTotalMeals: counts.total,
      deductedAddons,
      before: {
        remainingRegularMeals: before.remainingRegularMeals,
        remainingPremiumMeals: before.remainingPremiumMeals,
        remainingMeals: before.remainingMeals,
      },
      after: {
        remainingRegularMeals: after.remainingRegularMeals,
        remainingPremiumMeals: after.remainingPremiumMeals,
        remainingMeals: after.remainingMeals,
      },
      actorId: actorId ? String(actorId) : null,
      actorRole,
      reason: String(reason || ""),
      notes: String(notes || ""),
      fulfillmentMethod: subscription.deliveryMode === "pickup" ? "pickup" : "delivery",
      isPickup: subscription.deliveryMode === "pickup",
      isDelivery: subscription.deliveryMode === "delivery",
      businessDate,
    },
  };
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

      return {
        subscriptionId: String(updated._id),
        deducted: {
          regularMeals: counts.regularMeals,
          premiumMeals: counts.premiumMeals,
          total: counts.total,
          addons: counts.addons.map(a => ({ addonId: a.addonId, qty: a.qty })),
        },
        remaining: {
          regularMeals: after.remainingRegularMeals,
          premiumMeals: after.remainingPremiumMeals,
          totalMeals: after.remainingMeals,
          addons: afterAddonBalances.map(a => ({ addonId: String(a.addonId), remainingQty: a.remainingQty })),
        },
        businessDate,
        fulfillmentMethod: updated.deliveryMode === "pickup" ? "pickup" : "delivery",
      };
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

function serializeManualDeductionLog(log) {
  const meta = log && log.meta && typeof log.meta === "object" ? log.meta : {};
  return {
    id: log && log._id ? String(log._id) : null,
    subscriptionId: meta.subscriptionId || (log && log.entityId ? String(log.entityId) : null),
    customerId: meta.customerId || null,
    businessDate: meta.businessDate || null,
    deducted: {
      regularMeals: Number(meta.deductedRegularMeals || 0),
      premiumMeals: Number(meta.deductedPremiumMeals || 0),
      total: Number(meta.deductedTotalMeals || 0),
      addons: Array.isArray(meta.deductedAddons) ? meta.deductedAddons : [],
    },
    before: {
      remainingRegularMeals: meta.before ? Number(meta.before.remainingRegularMeals || 0) : null,
      remainingPremiumMeals: meta.before ? Number(meta.before.remainingPremiumMeals || 0) : null,
      remainingMeals: meta.before ? Number(meta.before.remainingMeals || 0) : null,
    },
    after: {
      remainingRegularMeals: meta.after ? Number(meta.after.remainingRegularMeals || 0) : null,
      remainingPremiumMeals: meta.after ? Number(meta.after.remainingPremiumMeals || 0) : null,
      remainingMeals: meta.after ? Number(meta.after.remainingMeals || 0) : null,
    },
    fulfillmentMethod: meta.fulfillmentMethod || null,
    actor: {
      id: meta.actorId || (log && log.byUserId ? String(log.byUserId) : null),
      role: meta.actorRole || (log && log.byRole ? String(log.byRole) : null),
    },
    reason: meta.reason || "",
    notes: meta.notes || "",
    createdAt: log && log.createdAt ? log.createdAt : null,
  };
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
