"use strict";

const crypto = require("crypto");

const SubscriptionPickupRequest = require("../../models/SubscriptionPickupRequest");
const { buildDayCommercialState } = require("./subscriptionDayCommercialStateService");

const ACTIVE_OR_CONSUMING_PICKUP_STATUSES = ["locked", "in_preparation", "ready_for_pickup", "fulfilled", "no_show"];

function createServiceError(code, message, status = 400, details = undefined) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  if (details !== undefined) err.details = details;
  return err;
}

function normalizeSlotId(value) {
  const raw = value === undefined || value === null ? "" : String(value).trim();
  return raw || "";
}

function resolveSlotId(slot = {}) {
  return normalizeSlotId(slot.slotKey || slot.slotIndex);
}

function normalizeSelectedMealSlotIds(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw createServiceError("INVALID_SELECTED_MEAL_SLOT_IDS", "selectedMealSlotIds must be an array", 400);
  }
  const ids = value.map(normalizeSlotId).filter(Boolean);
  if (ids.length !== value.length) {
    throw createServiceError("INVALID_SELECTED_MEAL_SLOT_IDS", "selectedMealSlotIds must contain non-empty values", 400);
  }
  if (new Set(ids).size !== ids.length) {
    throw createServiceError("DUPLICATE_SELECTED_MEAL_SLOT_IDS", "selectedMealSlotIds must not contain duplicates", 400);
  }
  return ids;
}

function buildPickupRequestPayloadHash({ date, mealCount, selectedMealSlotIds = [] }) {
  const normalized = {
    date: String(date || ""),
    mealCount: Number(mealCount || 0),
    selectedMealSlotIds: normalizeSelectedMealSlotIds(selectedMealSlotIds).sort(),
  };
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function slotHasUnpaidPremium(slot = {}) {
  return Boolean(slot && slot.isPremium && slot.premiumSource === "pending_payment");
}

function dayHasUnpaidAddons(day = {}) {
  return (Array.isArray(day && day.addonSelections) ? day.addonSelections : [])
    .some((addon) => addon && addon.source === "pending_payment");
}

function resolveCanonicalPaymentReason(day = {}) {
  const commercial = buildDayCommercialState(day || {});
  return (commercial.paymentRequirement && commercial.paymentRequirement.blockingReason)
    || (commercial.paymentRequirement && commercial.paymentRequirement.requiresPayment ? "PAYMENT_REQUIRED" : null);
}

function buildSlotReservationMap(pickupRequests = []) {
  const map = new Map();
  for (const request of pickupRequests) {
    const ids = Array.isArray(request && request.selectedMealSlotIds) ? request.selectedMealSlotIds : [];
    for (const id of ids.map(normalizeSlotId).filter(Boolean)) {
      map.set(id, {
        requestId: String(request._id),
        status: request.status,
        consumed: Boolean(request.creditsConsumedAt || request.status === "fulfilled" || request.status === "no_show"),
      });
    }
  }
  return map;
}

function buildAvailabilityFromDay({ day, pickupRequests = [] }) {
  const selectedIds = new Set();
  const reservationMap = buildSlotReservationMap(pickupRequests);
  const addonPaymentReason = dayHasUnpaidAddons(day) ? resolveCanonicalPaymentReason(day) || "ADDON_PAYMENT_REQUIRED" : null;
  const slots = (Array.isArray(day && day.mealSlots) ? day.mealSlots : []).map((slot) => {
    const slotId = resolveSlotId(slot);
    const reservation = reservationMap.get(slotId);
    const paymentReason = slotHasUnpaidPremium(slot) ? resolveCanonicalPaymentReason(day) || "PREMIUM_PAYMENT_REQUIRED" : addonPaymentReason;
    const reasons = [];
    if (!slotId) reasons.push("INVALID_SLOT");
    if (String(slot.status || "complete") !== "complete") reasons.push("PLANNING_INCOMPLETE");
    if (paymentReason) reasons.push(paymentReason);
    if (reservation) reasons.push(reservation.consumed ? "SLOT_ALREADY_CONSUMED" : "SLOT_ALREADY_RESERVED");
    const available = reasons.length === 0;
    selectedIds.add(slotId);
    return {
      slotId,
      slotKey: slot.slotKey || null,
      slotIndex: Number(slot.slotIndex || 0),
      selectionType: slot.selectionType || null,
      isPremium: Boolean(slot.isPremium),
      premiumSource: slot.premiumSource || "none",
      available,
      unavailableReason: available ? null : reasons[0],
      reasons,
      reservedByPickupRequestId: reservation ? reservation.requestId : null,
    };
  });

  return {
    date: day ? day.date : null,
    subscriptionDayId: day && day._id ? String(day._id) : null,
    paymentReason: addonPaymentReason || resolveCanonicalPaymentReason(day),
    slots,
    availableSlotIds: slots.filter((slot) => slot.available).map((slot) => slot.slotId),
    unavailableSlotIds: slots.filter((slot) => !slot.available).map((slot) => slot.slotId),
  };
}

async function findBlockingPickupRequests({ subscriptionId, date, session = null }) {
  const query = SubscriptionPickupRequest.find({
    subscriptionId,
    date,
    status: { $in: ACTIVE_OR_CONSUMING_PICKUP_STATUSES },
    selectedMealSlotIds: { $exists: true, $ne: [] },
  });
  if (session) query.session(session);
  return query.lean();
}

async function assertSelectedSlotsAvailableForPickup({
  subscriptionId,
  day,
  selectedMealSlotIds,
  session = null,
}) {
  const normalizedIds = normalizeSelectedMealSlotIds(selectedMealSlotIds);
  if (normalizedIds.length === 0) {
    throw createServiceError("SELECTED_MEAL_SLOT_IDS_REQUIRED", "selectedMealSlotIds is required", 400);
  }
  if (!day) {
    throw createServiceError("DAY_NOT_FOUND", "Subscription day not found", 404);
  }
  const pickupRequests = await findBlockingPickupRequests({ subscriptionId, date: day.date, session });
  const availability = buildAvailabilityFromDay({ day, pickupRequests });
  const byId = new Map(availability.slots.map((slot) => [slot.slotId, slot]));
  const invalid = [];
  const blocked = [];
  for (const id of normalizedIds) {
    const slot = byId.get(id);
    if (!slot) {
      invalid.push(id);
      continue;
    }
    if (!slot.available) blocked.push(slot);
  }
  if (invalid.length) {
    throw createServiceError("MEAL_SLOT_NOT_FOUND", "Selected meal slot was not found", 422, { selectedMealSlotIds: invalid });
  }
  if (blocked.length) {
    const firstReason = blocked[0].unavailableReason || "MEAL_SLOT_UNAVAILABLE";
    const code = firstReason === "PREMIUM_PAYMENT_REQUIRED" || firstReason === "ADDON_PAYMENT_REQUIRED" || firstReason === "PAYMENT_REQUIRED"
      ? firstReason
      : "MEAL_SLOT_UNAVAILABLE";
    throw createServiceError(code, "Selected meal slot is unavailable for pickup", 422, { slots: blocked });
  }
  return {
    selectedMealSlotIds: normalizedIds,
    selectedSlots: normalizedIds.map((id) => byId.get(id)),
    availability,
  };
}

module.exports = {
  ACTIVE_OR_CONSUMING_PICKUP_STATUSES,
  assertSelectedSlotsAvailableForPickup,
  buildAvailabilityFromDay,
  buildPickupRequestPayloadHash,
  createServiceError,
  findBlockingPickupRequests,
  normalizeSelectedMealSlotIds,
  resolveCanonicalPaymentReason,
  resolveSlotId,
};
