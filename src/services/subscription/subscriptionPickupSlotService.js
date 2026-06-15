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

function stringifyId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value.toHexString === "function") return value.toHexString();
  if (value && value._id) return stringifyId(value._id);
  return String(value);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function localizedPair(value, fallback = null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const en = value.en || value.english || value.nameEn || value.titleEn || value.ar || value.name || fallback;
    const ar = value.ar || value.arabic || value.nameAr || value.titleAr || value.en || value.name || fallback;
    return { ar: ar || null, en: en || null };
  }
  const text = value === undefined || value === null ? fallback : String(value);
  return { ar: text || null, en: text || null };
}

function firstLocalizedPair(...values) {
  for (const value of values) {
    const pair = localizedPair(value);
    if (pair.ar || pair.en) return pair;
  }
  return { ar: null, en: null };
}

function moneyFromHalala(value) {
  const halala = Number(value || 0);
  return halala > 0 ? halala / 100 : 0;
}

function canonicalPaymentStatus({ required, paid }) {
  if (required) return "pending";
  if (paid) return "paid";
  return "not_required";
}

function resolveReasonCopy(reason) {
  const copies = {
    SLOT_ALREADY_RESERVED: {
      ar: "تم طلب استلام هذه الوجبة بالفعل",
      en: "This meal has already been requested for pickup",
    },
    SLOT_ALREADY_FULFILLED: {
      ar: "تم استلام هذه الوجبة",
      en: "This meal has already been picked up",
    },
    SLOT_ALREADY_CONSUMED: {
      ar: "تم استخدام هذه الوجبة بالفعل",
      en: "This meal has already been consumed",
    },
    PREMIUM_PAYMENT_REQUIRED: {
      ar: "يجب إتمام دفع ترقية الوجبة أولاً",
      en: "Premium upgrade payment must be completed first",
    },
    ADDON_PAYMENT_REQUIRED: {
      ar: "يجب إتمام دفع الإضافات أولاً",
      en: "Addon payment must be completed first",
    },
    PAYMENT_REQUIRED: {
      ar: "يجب إتمام الدفع أولاً",
      en: "Payment must be completed first",
    },
    PLANNING_INCOMPLETE: {
      ar: "يجب إكمال اختيار الوجبة أولاً",
      en: "Meal selection must be completed first",
    },
    INVALID_SLOT: {
      ar: "هذه الوجبة غير متاحة للاستلام",
      en: "This meal is not available for pickup",
    },
  };
  return copies[reason] || {
    ar: "هذه الوجبة غير متاحة للاستلام",
    en: "This meal is not available for pickup",
  };
}

function buildProductPayload(slot = {}) {
  const confirmation = asObject(slot.confirmationSnapshot);
  const display = asObject(slot.displaySnapshot);
  const fulfillment = asObject(slot.fulfillmentSnapshot);
  const product = asObject(confirmation.product || display.product || fulfillment.product);
  const macros = asObject(product.macros || display.macros || confirmation.macros || fulfillment.macros);
  const name = firstLocalizedPair(product.name, product.title, display.productName, fulfillment.productName, slot.productName, slot.productKey);
  const description = firstLocalizedPair(product.description, display.description, confirmation.description);
  return {
    id: stringifyId(slot.productId || product.id || product._id),
    key: slot.productKey || product.key || null,
    name,
    description,
    image: product.image || product.imageUrl || product.photo || display.image || confirmation.image || fulfillment.image || null,
    calories: Number(product.calories || display.calories || confirmation.calories || fulfillment.calories || 0),
    macros: {
      protein: Number(macros.protein || macros.proteinGrams || 0),
      carbs: Number(macros.carbs || macros.carbsGrams || 0),
      fat: Number(macros.fat || macros.fatGrams || 0),
    },
  };
}

function buildOptionPayload(option = {}) {
  const name = firstLocalizedPair(option.name, option.optionName, option.label, option.optionKey);
  const groupName = firstLocalizedPair(option.groupName, option.groupLabel, option.groupKey);
  return {
    id: stringifyId(option.optionId || option.id || option._id),
    key: option.optionKey || option.key || null,
    name,
    groupKey: option.groupKey || option.canonicalGroupKey || null,
    groupName,
    quantity: Number(option.quantity || option.qty || 1),
  };
}

function buildAddonPayload(addon = {}) {
  const paymentRequired = addon.source === "pending_payment";
  const paid = addon.source === "paid" || addon.source === "wallet" || addon.source === "subscription";
  return {
    id: stringifyId(addon.addonId || addon.id || addon._id),
    key: addon.key || addon.addonKey || null,
    name: firstLocalizedPair(addon.name, addon.addonName, addon.key || addon.addonKey),
    quantity: Number(addon.quantity || addon.qty || 1),
    price: moneyFromHalala(addon.priceHalala || addon.unitPriceHalala || addon.totalPriceHalala),
    paymentStatus: canonicalPaymentStatus({ required: paymentRequired, paid }),
    paymentRequired,
  };
}

function buildPaymentPayload({ slot = {}, day = {}, reason = null, addons = [] }) {
  const premiumRequired = reason === "PREMIUM_PAYMENT_REQUIRED";
  const addonRequired = reason === "ADDON_PAYMENT_REQUIRED" || addons.some((addon) => addon.paymentRequired);
  const required = premiumRequired || addonRequired || reason === "PAYMENT_REQUIRED";
  const reasonLabel = reason ? localizedPair(resolveReasonCopy(reason)) : { ar: null, en: null };
  const premiumDue = premiumRequired
    ? moneyFromHalala(slot.premiumExtraFeeHalala || (day.premiumExtraPayment && day.premiumExtraPayment.amountHalala))
    : 0;
  const addonDue = addonRequired
    ? addons.filter((addon) => addon.paymentRequired).reduce((sum, addon) => sum + Number(addon.price || 0), 0)
    : 0;
  return {
    required,
    status: required ? "pending" : (slot.isPremium && ["paid", "paid_extra", "balance"].includes(slot.premiumSource) ? "paid" : "not_required"),
    reason: required ? reason : null,
    reasonLabel,
    amountDue: premiumDue + addonDue,
    currency: (day.premiumExtraPayment && day.premiumExtraPayment.currency) || "SAR",
    premiumRequired,
    addonRequired,
  };
}

function buildDisplayPayload({ product, meal, slot = {}, available, unavailableReason, payment }) {
  const titleAr = meal.title.ar || product.name.ar || slot.slotKey || "وجبة";
  const titleEn = meal.title.en || product.name.en || slot.slotKey || "Meal";
  const subtitleAr = meal.subtitle.ar || product.description.ar || null;
  const subtitleEn = meal.subtitle.en || product.description.en || null;
  const unavailableCopy = unavailableReason ? resolveReasonCopy(unavailableReason) : { ar: null, en: null };
  const badgesAr = [];
  const badgesEn = [];
  if (slot.isPremium) {
    badgesAr.push("وجبة مميزة");
    badgesEn.push("Premium");
  }
  if (payment.required) {
    badgesAr.push("بانتظار الدفع");
    badgesEn.push("Payment pending");
  } else if (slot.isPremium && ["balance", "paid", "paid_extra"].includes(slot.premiumSource)) {
    badgesAr.push("مدفوعة");
    badgesEn.push("Paid");
  }
  return {
    titleAr,
    titleEn,
    subtitleAr,
    subtitleEn,
    image: meal.image || product.image || null,
    badgesAr,
    badgesEn,
    statusTextAr: available ? "متاحة للاستلام" : unavailableCopy.ar,
    statusTextEn: available ? "Available for pickup" : unavailableCopy.en,
    selectionTextAr: available ? "اختر هذه الوجبة للاستلام" : null,
    selectionTextEn: available ? "Select this meal for pickup" : null,
    unavailableTextAr: available ? null : unavailableCopy.ar,
    unavailableTextEn: available ? null : unavailableCopy.en,
  };
}

function buildClientSlotDetails({ slot = {}, day = {}, available, unavailableReason }) {
  const product = buildProductPayload(slot);
  const mealTitle = firstLocalizedPair(
    asObject(slot.displaySnapshot).title,
    asObject(slot.confirmationSnapshot).title,
    product.name,
    slot.productKey
  );
  const mealSubtitle = firstLocalizedPair(
    asObject(slot.displaySnapshot).subtitle,
    asObject(slot.confirmationSnapshot).subtitle,
    product.description
  );
  const meal = {
    title: mealTitle,
    subtitle: mealSubtitle,
    image: product.image,
    mealType: slot.selectionType || "standard_meal",
    quantity: 1,
  };
  const options = (Array.isArray(slot.selectedOptions) ? slot.selectedOptions : []).map(buildOptionPayload);
  const addons = (Array.isArray(day && day.addonSelections) ? day.addonSelections : []).map(buildAddonPayload);
  const payment = buildPaymentPayload({ slot, day, reason: unavailableReason, addons });
  return {
    canSelect: Boolean(available),
    product,
    meal,
    options,
    addons,
    payment,
    display: buildDisplayPayload({ product, meal, slot, available, unavailableReason, payment }),
  };
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
    if (reservation) {
      reasons.push(reservation.status === "fulfilled"
        ? "SLOT_ALREADY_FULFILLED"
        : (reservation.consumed ? "SLOT_ALREADY_CONSUMED" : "SLOT_ALREADY_RESERVED"));
    }
    const available = reasons.length === 0;
    selectedIds.add(slotId);
    const unavailableReason = available ? null : reasons[0];
    return {
      slotId,
      slotKey: slot.slotKey || null,
      slotIndex: Number(slot.slotIndex || 0),
      selectionType: slot.selectionType || null,
      isPremium: Boolean(slot.isPremium),
      premiumSource: slot.premiumSource || "none",
      available,
      unavailableReason,
      reasons,
      reservedByPickupRequestId: reservation ? reservation.requestId : null,
      ...buildClientSlotDetails({ slot, day, available, unavailableReason }),
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
