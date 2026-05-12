"use strict";

/**
 * Automation Service
 *
 * NOTE (2026-05-04): The daily cutoff job that previously auto-settled past
 * subscription days and auto-consumed legacy pickup-mode days has been DISABLED
 * as part of the new meal balance policy.
 *
 * Old behavior (removed):
 *   1. settlePastSubscriptionDaysForRange() — marked past days as
 *      consumed_without_preparation and deducted remainingMeals.
 *   2. Pickup-day loop — deducted meals for today's pickup days that did not
 *      have pickupRequested=true when the window ended.
 *
 * New policy:
 *   - Legacy SubscriptionDay calendar passage does not consume meals.
 *   - Multi-request pickup orders reserve meals at creation. At cutoff, active
 *     SubscriptionPickupRequest documents are marked no_show and their reserved
 *     credits are consumed, without decrementing remainingMeals again.
 */

const { logger } = require("../utils/logger");
const { toKSADateString } = require("../utils/date");
const {
  settleOpenSubscriptionPickupRequestsForDate,
} = require("./subscription/subscriptionPickupRequestSettlementService");

let isCutoffJobRunning = false;

async function processDailyCutoff({ date = null, now = new Date() } = {}) {
  if (isCutoffJobRunning) {
    const err = new Error("Cutoff job is already running");
    err.code = "JOB_RUNNING";
    throw err;
  }
  isCutoffJobRunning = true;
  try {
    // Legacy SubscriptionDay auto-consumption remains disabled. The only cutoff
    // work now is request-level settlement for pickup credits already reserved
    // when the client created the pickup request.
    const settlement = await settleOpenSubscriptionPickupRequestsForDate({
      date: date || toKSADateString(now),
      now,
      actor: "system",
      reason: "PICKUP_REQUEST_CUTOFF_NO_SHOW",
    });
    logger.info("processDailyCutoff: pickup request settlement completed", {
      policyVersion: "TOTAL_BALANCE_WITHIN_VALIDITY",
      pickupRequests: settlement,
    });
    return {
      status: true,
      pickupRequestSettlement: settlement,
    };
  } finally {
    isCutoffJobRunning = false;
  }
}

module.exports = { processDailyCutoff };
