"use strict";

const { ManualDeductionError, assertCashierOrAdminRole } = require("./ManualDeductionError");
const { chooseDefaultSubscription } = require("./manualDeductionPolicy");
const { serializeCustomer, serializeSubscription } = require("./manualDeductionPresenter");

function createManualDeductionSearchService({ repository, getBusinessDate }) {
  async function buildTodaySummary(subscription, businessDate) {
    const lastToday = await repository.findLastManualDeduction(subscription._id, businessDate);
    const lastAny = lastToday || await repository.findLastManualDeduction(subscription._id);
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

    const user = await repository.findUserByPhone(normalizedPhone);
    if (!user) {
      throw new ManualDeductionError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
    }

    const activeSubscriptions = await repository.findActiveSubscriptionsByUserId(user._id);
    if (!activeSubscriptions.length) {
      throw new ManualDeductionError("SUBSCRIPTION_NOT_FOUND", "Active subscription not found", 404);
    }

    const businessDate = await getBusinessDate();
    const defaultSubscription = chooseDefaultSubscription(activeSubscriptions, businessDate);
    const planIds = [...new Set(activeSubscriptions.map((subscription) => String(subscription.planId)).filter(Boolean))];
    const plans = await repository.findPlansByIds(planIds);
    const planMap = new Map(plans.map((plan) => [String(plan._id), plan]));
    const today = await buildTodaySummary(defaultSubscription, businessDate);

    return {
      customer: serializeCustomer(user),
      subscription: serializeSubscription(defaultSubscription, planMap.get(String(defaultSubscription.planId)), lang),
      subscriptions: activeSubscriptions.map((subscription) => serializeSubscription(
        subscription,
        planMap.get(String(subscription.planId)),
        lang
      )),
      today,
    };
  }

  return { searchByPhone };
}

module.exports = { createManualDeductionSearchService };
