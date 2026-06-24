"use strict";

const { getRestaurantBusinessDate } = require("../restaurantHoursService");
const { runMongoTransactionWithRetry } = require("../mongoTransactionRetryService");
const { MANUAL_DEDUCTION_ACTION } = require("./manualDeduction/constants");
const { ManualDeductionError, assertCashierOrAdminRole } = require("./manualDeduction/ManualDeductionError");
const {
  resolveAddonBalances,
  resolveBalances,
  validateBalances,
  validateCounts,
  validateSubscriptionCanDeduct,
} = require("./manualDeduction/manualDeductionPolicy");
const {
  buildDeductionLog,
  buildDeductionResponse,
  serializeManualDeductionLog,
} = require("./manualDeduction/manualDeductionPresenter");
const manualDeductionRepository = require("./manualDeduction/manualDeductionRepository");
const { createManualDeductionSearchService } = require("./manualDeduction/manualDeductionSearchService");

const { searchByPhone } = createManualDeductionSearchService({
  repository: manualDeductionRepository,
  getBusinessDate: getRestaurantBusinessDate,
});

async function validateSubscriptionCustomerExists(subscription, session) {
  const customer = await manualDeductionRepository.customerExists(subscription.userId, session);
  if (!customer) {
    throw new ManualDeductionError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
  }
}

async function deductAtomically({ subscription, counts, session }) {
  return manualDeductionRepository.deductAtomically({ subscription, counts, session });
}

async function ensureNoDeliveryDeductionToday(subscription, businessDate, session) {
  if (subscription.deliveryMode !== "delivery") return;
  const existing = await manualDeductionRepository.findLastManualDeduction(subscription._id, businessDate, session);
  if (existing) {
    throw new ManualDeductionError("DELIVERY_ALREADY_DEDUCTED_TODAY", "Delivery subscription already deducted today", 409);
  }
}

async function createDeductionLog({ subscription, counts, before, after, actorId, actorRole, reason, notes, businessDate, session }) {
  const log = buildDeductionLog({ subscription, counts, before, after, actorId, actorRole, reason, notes, businessDate });
  await manualDeductionRepository.createDeductionLog(log, session);
}

async function manualDeduction({ subscriptionId, body, actorId, actorRole }) {
  assertCashierOrAdminRole(actorRole);
  if (!manualDeductionRepository.isValidObjectId(subscriptionId)) {
    throw new ManualDeductionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found", 404);
  }

  const counts = validateCounts(body || {});
  const businessDate = await getRestaurantBusinessDate();

  try {
    return await runMongoTransactionWithRetry(async (session) => {
      const subscription = await manualDeductionRepository.findSubscriptionById(subscriptionId, session);
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
  if (!manualDeductionRepository.isValidObjectId(subscriptionId)) {
    throw new ManualDeductionError("SUBSCRIPTION_NOT_FOUND", "Subscription not found", 404);
  }

  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const logs = await manualDeductionRepository.listManualDeductionLogs(subscriptionId, cappedLimit);

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
