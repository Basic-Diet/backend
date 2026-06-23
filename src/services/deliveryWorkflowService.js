"use strict";

function createDeliveryWorkflowError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeDeliveryStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "cancelled") {
    return "canceled";
  }
  return normalized;
}

function isDeliveryCanceledStatus(status) {
  return normalizeDeliveryStatus(status) === "canceled";
}

function isDeliveryDeliveredStatus(status) {
  return normalizeDeliveryStatus(status) === "delivered";
}

function canSendArrivingSoonReminder(status) {
  const normalized = normalizeDeliveryStatus(status);
  return normalized === "scheduled" || normalized === "out_for_delivery";
}

const CANCELLATION_REASONS = {
  // Customer-related reasons
  customer_not_available: "customer_issue",
  customer_not_answering: "customer_issue",
  customer_refused_delivery: "customer_issue",
  invalid_customer_address: "customer_issue",
  customer_requested_cancellation: "customer_issue",

  // Delivery / operational reasons
  courier_issue: "delivery_issue",
  operational_delay: "delivery_issue",
  internal_delivery_problem: "delivery_issue",
  order_operational_issue: "delivery_issue",
};

const LEGACY_CANCELLATION_MAPPING = {
  customer_requested: "customer_requested_cancellation",
  admin_cancelled: "internal_delivery_problem",
  restaurant_cancelled: "order_operational_issue",
  restaurant_rejected: "order_operational_issue",
  stock_out: "order_operational_issue",
  customer_unreachable: "customer_not_answering",
  wrong_address: "invalid_customer_address",
  client_refused: "customer_refused_delivery",
  delivery_accident: "courier_issue",
  other: "internal_delivery_problem",
};

function parseDeliveryCancellationInput(payload = {}) {
  const reasonInput =
    typeof payload.reason === "string"
      ? payload.reason
      : (typeof payload.cancellationReason === "string" ? payload.cancellationReason : "");
  const noteInput =
    payload.note !== undefined
      ? payload.note
      : payload.cancellationNote;

  let reason = reasonInput.trim();
  const noteRaw = noteInput === undefined || noteInput === null ? "" : String(noteInput).trim();
  const note = noteRaw || null;

  if (!reason) {
    throw createDeliveryWorkflowError(400, "CANCELLATION_REASON_REQUIRED", "Cancellation reason is required");
  }

  if (LEGACY_CANCELLATION_MAPPING[reason]) {
    reason = LEGACY_CANCELLATION_MAPPING[reason];
  }

  const category = CANCELLATION_REASONS[reason];
  if (!category) {
    throw createDeliveryWorkflowError(400, "INVALID_CANCELLATION_REASON", "Invalid cancellation reason");
  }

  if (note && note.length > 500) {
    throw createDeliveryWorkflowError(400, "INVALID", "Cancellation note must be at most 500 characters");
  }

  return { reason, category, note };
}

module.exports = {
  canSendArrivingSoonReminder,
  createDeliveryWorkflowError,
  isDeliveryCanceledStatus,
  isDeliveryDeliveredStatus,
  normalizeDeliveryStatus,
  parseDeliveryCancellationInput,
  CANCELLATION_REASONS,
};
