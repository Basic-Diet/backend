"use strict";

const mongoose = require("mongoose");
const SubscriptionPickupRequest = require("../../models/SubscriptionPickupRequest");
const { consumeReservedPickupMeals } = require("./subscriptionPickupRequestBalanceService");

const OPEN_PICKUP_REQUEST_STATUSES = Object.freeze([
  "locked",
  "in_preparation",
  "ready_for_pickup",
]);

function normalizeDateString(date) {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function buildSettlementResult(date) {
  return {
    date,
    matchedCount: 0,
    settledCount: 0,
    skippedCount: 0,
    errors: [],
  };
}

async function settlePickupRequest({ pickupRequestId, now, actor, reason, session }) {
  const updatedRequest = await SubscriptionPickupRequest.findOneAndUpdate(
    {
      _id: pickupRequestId,
      status: { $in: OPEN_PICKUP_REQUEST_STATUSES },
    },
    {
      $set: {
        status: "no_show",
        pickupNoShowAt: now,
        settledAt: now,
        settlementReason: reason,
        settledBy: actor,
        cancellationReason: reason,
      },
    },
    { new: true, session }
  );

  if (!updatedRequest) {
    return { settled: false, skipped: true };
  }

  await consumeReservedPickupMeals({
    pickupRequestId: updatedRequest._id,
    session,
  });

  const settledRequest = await SubscriptionPickupRequest.findById(updatedRequest._id).session(session);
  return {
    settled: true,
    skipped: false,
    pickupRequest: settledRequest || updatedRequest,
  };
}

async function runWithOwnedTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let output;
    await session.withTransaction(async () => {
      output = await fn(session);
    });
    return output;
  } finally {
    session.endSession();
  }
}

async function settleOnePickupRequest(options) {
  if (options.session) {
    return settlePickupRequest(options);
  }
  return runWithOwnedTransaction((session) => settlePickupRequest({ ...options, session }));
}

async function settleOpenSubscriptionPickupRequestsForDate({
  date,
  session = null,
  now = new Date(),
  actor = "system",
  reason = "PICKUP_REQUEST_AUTO_NO_SHOW",
} = {}) {
  const dateStr = normalizeDateString(date);
  const result = buildSettlementResult(dateStr);
  if (!dateStr) {
    result.errors.push({ code: "INVALID_DATE", message: "date must be YYYY-MM-DD" });
    return result;
  }

  const query = {
    date: dateStr,
    status: { $in: OPEN_PICKUP_REQUEST_STATUSES },
  };
  const requestIds = await SubscriptionPickupRequest.find(query)
    .select("_id")
    .sort({ createdAt: 1 })
    .lean()
    .session(session);

  result.matchedCount = requestIds.length;

  for (const row of requestIds) {
    try {
      const settlement = await settleOnePickupRequest({
        pickupRequestId: row._id,
        now,
        actor,
        reason,
        session,
      });
      if (settlement.settled) {
        result.settledCount += 1;
      } else {
        result.skippedCount += 1;
      }
    } catch (err) {
      result.errors.push({
        requestId: String(row._id),
        code: err.code || "SETTLEMENT_FAILED",
        message: err.message || "Pickup request settlement failed",
      });
    }
  }

  return result;
}

module.exports = {
  OPEN_PICKUP_REQUEST_STATUSES,
  settleOpenSubscriptionPickupRequestsForDate,
};
