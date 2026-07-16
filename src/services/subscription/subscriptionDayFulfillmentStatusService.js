"use strict";

/**
 * Lightweight fulfillment status service — Phase 5 (Status-based tracking, no WebSockets).
 *
 * Returns a compact payload for mobile to poll every N seconds.
 * Works for both pickup and delivery subscriptions.
 * Reuses buildFulfillmentReadFields to guarantee consistency with the timeline.
 */

const Subscription = require("../../models/Subscription");
const SubscriptionDay = require("../../models/SubscriptionDay");
const {
  buildFulfillmentReadFields,
  getPickupLocationsSetting,
} = require("./subscriptionFulfillmentSummaryService");
const {
  buildSubscriptionDayFulfillmentState,
} = require("./subscriptionDayFulfillmentStateService");
const { resolveReadLabel } = require("../../utils/subscription/subscriptionLocalizationCommon");
const { logger } = require("../../utils/logger");

const TERMINAL_STATUSES = new Set([
  "fulfilled",
  "delivery_canceled",
  "no_show",
  "consumed_without_preparation",
  "skipped",
  "frozen",
  "canceled_at_branch",
]);

function resolvePollingIntervalSeconds(status) {
  if (TERMINAL_STATUSES.has(status)) return null;
  if (["in_preparation", "out_for_delivery", "ready_for_pickup"].includes(status)) return 30;
  return 60;
}

function errorResult(err, fallbackCode = "FULFILLMENT_STATUS_UNAVAILABLE") {
  const code = String(err && err.code || fallbackCode);
  const knownStatus = Number(err && err.status);
  let status = Number.isInteger(knownStatus) && knownStatus >= 400 && knownStatus < 600 ? knownStatus : 500;
  if (status === 500) {
    if (["SUB_INACTIVE", "SUB_EXPIRED"].includes(code)) status = 422;
    else if (code === "NOT_FOUND" || code === "DAY_NOT_FOUND") status = 404;
    else if (code === "FORBIDDEN") status = 403;
    else if (code === "INVALID_DATE" || code === "VALIDATION_ERROR") status = 400;
  }
  return {
    ok: false,
    status,
    code,
    message: err && err.message ? err.message : "Fulfillment status is temporarily unavailable",
  };
}

function fallbackReadFields({ subscription, day, lang }) {
  const baseMode = subscription && subscription.deliveryMode === "pickup" ? "pickup" : "delivery";
  const effectiveMode = day && day.fulfillmentModeOverride ? day.fulfillmentModeOverride : baseMode;
  const rawStatus = String(day && day.status || "open");
  const statusLabel = resolveReadLabel("dayStatuses", rawStatus, lang) || rawStatus;
  return {
    deliveryMode: baseMode,
    fulfillmentModeOverride: day && day.fulfillmentModeOverride ? day.fulfillmentModeOverride : null,
    effectiveFulfillmentMode: effectiveMode,
    pickupLocationIdOverride: day && day.pickupLocationIdOverride ? day.pickupLocationIdOverride : null,
    firstDayFulfillmentOverride: Boolean(day && day.fulfillmentModeOverride),
    fulfillmentSummary: {
      status: rawStatus,
      statusLabel,
      message: "",
      nextAction: "",
      lockedReason: null,
      lockedMessage: null,
    },
    deliveryAddress: null,
    deliveryWindow: null,
    deliverySlot: null,
    pickupLocation: null,
    lockedReason: null,
    lockedMessage: null,
  };
}

async function getDayFulfillmentStatusForClient({
  subscriptionId,
  date,
  userId,
  lang = "ar",
  ensureActiveFn,
}) {
  let sub;
  try {
    sub = await Subscription.findById(subscriptionId).lean();
  } catch (err) {
    return errorResult(err);
  }
  if (!sub) return { ok: false, status: 404, code: "NOT_FOUND", message: "Subscription not found" };
  if (String(sub.userId) !== String(userId)) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "Forbidden" };
  }

  if (ensureActiveFn) {
    try {
      const activeCheck = await ensureActiveFn(sub, date);
      if (activeCheck && activeCheck.ok === false) return activeCheck;
    } catch (err) {
      return errorResult(err);
    }
  }

  let day;
  try {
    day = await SubscriptionDay.findOne({ subscriptionId, date }).lean();
  } catch (err) {
    return errorResult(err);
  }
  if (!day) return { ok: false, status: 404, code: "DAY_NOT_FOUND", message: "Day not found" };

  let fulfillmentState = {};
  try {
    fulfillmentState = buildSubscriptionDayFulfillmentState({ subscription: sub, day }) || {};
  } catch (err) {
    logger.warn("Fulfillment state fallback used", {
      subscriptionId: String(subscriptionId),
      date,
      error: err.message,
    });
  }

  let pickupLocations = [];
  const effectiveMode = day.fulfillmentModeOverride || sub.deliveryMode;
  if (effectiveMode === "pickup") {
    try {
      pickupLocations = await getPickupLocationsSetting();
    } catch (err) {
      logger.warn("Pickup locations unavailable for fulfillment status", {
        subscriptionId: String(subscriptionId),
        date,
        error: err.message,
      });
    }
  }

  let readFields;
  try {
    readFields = buildFulfillmentReadFields({
      subscription: sub,
      day,
      pickupLocations,
      lang,
      fulfillmentState,
      statusLabel: resolveReadLabel("dayStatuses", day.status, lang) || "",
    });
  } catch (err) {
    logger.warn("Fulfillment read fields fallback used", {
      subscriptionId: String(subscriptionId),
      date,
      error: err.message,
    });
    readFields = fallbackReadFields({ subscription: sub, day, lang });
  }

  const status = String(day.status || "open");
  const deliveryMode = readFields.deliveryMode || (sub.deliveryMode === "pickup" ? "pickup" : "delivery");
  const effectiveFulfillmentMode = readFields.effectiveFulfillmentMode || deliveryMode;
  const summary = readFields.fulfillmentSummary || {};

  return {
    ok: true,
    status: 200,
    data: {
      subscriptionId: String(subscriptionId),
      date,
      deliveryMode,
      fulfillmentModeOverride: readFields.fulfillmentModeOverride || null,
      effectiveFulfillmentMode,
      pickupLocationIdOverride: readFields.pickupLocationIdOverride || null,
      firstDayFulfillmentOverride: Boolean(readFields.firstDayFulfillmentOverride),
      status,
      statusLabel: summary.statusLabel || "",
      message: summary.message || "",
      nextAction: summary.nextAction || "",
      isTerminal: TERMINAL_STATUSES.has(status),
      pollingIntervalSeconds: resolvePollingIntervalSeconds(status),
      lastUpdatedAt: day.updatedAt ? new Date(day.updatedAt).toISOString() : null,
      fulfillmentSummary: summary,
      deliveryAddress: readFields.deliveryAddress || null,
      deliveryWindow: readFields.deliveryWindow || null,
      deliverySlot: readFields.deliverySlot || null,
      pickupLocation: readFields.pickupLocation || null,
      lockedReason: readFields.lockedReason || summary.lockedReason || null,
      lockedMessage: readFields.lockedMessage || summary.lockedMessage || null,
      pickupCode: effectiveFulfillmentMode === "pickup" && status === "ready_for_pickup"
        ? (day.pickupCode || null)
        : null,
      pickupCodeIssuedAt: effectiveFulfillmentMode === "pickup" && day.pickupCodeIssuedAt
        ? new Date(day.pickupCodeIssuedAt).toISOString()
        : null,
      planningReady: Boolean(fulfillmentState.planningReady),
      fulfillmentReady: Boolean(fulfillmentState.fulfillmentReady),
      isFulfillable: Boolean(fulfillmentState.isFulfillable),
      canBePrepared: Boolean(fulfillmentState.canBePrepared),
    },
  };
}

module.exports = {
  getDayFulfillmentStatusForClient,
  TERMINAL_STATUSES,
};
