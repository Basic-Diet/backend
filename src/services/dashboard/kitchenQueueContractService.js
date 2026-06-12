"use strict";

const CONTRACT_VERSION = "dashboard_kitchen_queue.v2";
const QUEUE_SCREENS = new Set(["kitchen", "pickup", "courier"]);

function asId(value) {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sumQuantity(items) {
  return (Array.isArray(items) ? items : []).reduce((total, item) => {
    return total + Math.max(1, asNumber(item && item.quantity, 1));
  }, 0);
}

function buildReference(item) {
  if (item.reference) return String(item.reference);
  if (item.orderNumber) return String(item.orderNumber);
  const id = item.entityId || item.id || item.orderId || item.requestId;
  const prefix = item.entityType === "order"
    ? "ORD"
    : (item.entityType === "subscription_pickup_request" ? "PICK" : "SUB");
  return id ? `${prefix}-${String(id).slice(-6).toUpperCase()}` : null;
}

function sourceTypeFor(item) {
  if (item.entityType === "order" || item.source === "one_time_order") return "one_time_order";
  if (item.entityType === "subscription_pickup_request" || item.source === "subscription_pickup_request") return "pickup_request";
  return "subscription_day";
}

function normalizeMeal(slot = {}) {
  return {
    slotIndex: slot.slotIndex === undefined || slot.slotIndex === null ? null : asNumber(slot.slotIndex, null),
    slotKey: slot.slotKey || null,
    mealType: slot.selectionType || slot.mealType || null,
    product: {
      id: asId(slot.productId),
      key: slot.productKey || null,
      name: slot.productName || "",
    },
    protein: {
      id: asId(slot.proteinId),
      key: slot.proteinKey || slot.proteinFamilyKey || null,
      name: slot.proteinName || "",
      grams: slot.proteinGrams === undefined || slot.proteinGrams === null ? null : asNumber(slot.proteinGrams, null),
    },
    carbs: Array.isArray(slot.carbSelections) ? slot.carbSelections.map((carb) => ({
      id: asId(carb && (carb.carbId || carb.id)),
      key: carb && carb.key ? String(carb.key) : null,
      name: carb && carb.name ? String(carb.name) : "",
      grams: carb && carb.grams !== undefined && carb.grams !== null ? asNumber(carb.grams, null) : null,
    })) : [],
    salad: slot.salad || null,
    sauce: Array.isArray(slot.sauce) ? slot.sauce : [],
    sides: Array.isArray(slot.sides) ? slot.sides : [],
    options: Array.isArray(slot.selectedOptions) ? slot.selectedOptions : [],
    premium: {
      isPremium: Boolean(slot.isPremium),
      key: slot.premiumKey || null,
      source: slot.premiumSource || "none",
    },
    quantity: Math.max(1, asNumber(slot.quantity, 1)),
    notes: slot.notes || null,
  };
}

function normalizeAddon(addon = {}) {
  return {
    id: asId(addon.id || addon.addonId),
    key: addon.key || addon.addonKey || null,
    name: addon.name || "",
    quantity: Math.max(1, asNumber(addon.quantity || addon.qty, 1)),
  };
}

function buildActions(item, payment) {
  const allowed = Array.isArray(item.allowedActions) ? item.allowedActions : [];
  const ids = new Set(allowed.map((action) => action && action.id).filter(Boolean));
  const canFulfill = Boolean(ids.has("fulfill") && (!payment || payment.canFulfill !== false));

  return {
    allowed,
    disabled: [],
    canPrepare: Boolean(ids.has("prepare") && (!payment || payment.canPrepare !== false)),
    canDispatch: ids.has("dispatch"),
    canReadyForPickup: ids.has("ready_for_pickup") || ids.has("set_ready"),
    canFulfill,
    canCancel: ids.has("cancel"),
    canNoShow: ids.has("no_show"),
    canReopen: ids.has("reopen"),
  };
}

function fulfillmentTypeFor(item) {
  if (item.fulfillmentType === "branch_pickup" || item.fulfillmentType === "pickup_request") return "branch_pickup";
  if (item.fulfillmentType === "home_delivery" || item.fulfillmentType === "delivery") return "home_delivery";
  return item.mode === "pickup" || item.deliveryMode === "pickup" || item.deliveryMethod === "pickup"
    ? "branch_pickup"
    : "home_delivery";
}

function buildIds(item) {
  return {
    entityType: item.entityType || null,
    entityId: asId(item.entityId || item.id),
    subscriptionId: asId(item.subscriptionId || (item.meta && item.meta.subscriptionId)),
    subscriptionDayId: asId(item.subscriptionDayId || (item.meta && item.meta.dayId)),
    orderId: asId(item.orderId || (item.entityType === "order" ? item.entityId || item.id : null)),
    deliveryId: asId(item.delivery && item.delivery.deliveryId),
    pickupRequestId: asId(item.requestId || (item.entityType === "subscription_pickup_request" ? item.entityId || item.id : null) || (item.pickup && item.pickup.pickupRequestId)),
  };
}

function normalizeKitchenQueueItem(item, { includeRaw = false } = {}) {
  const ids = buildIds(item);
  const kitchenDetails = item.kitchenDetails || {};
  const meals = (Array.isArray(kitchenDetails.mealSlots) ? kitchenDetails.mealSlots : []).map(normalizeMeal);
  const addons = (Array.isArray(kitchenDetails.addons) ? kitchenDetails.addons : []).map(normalizeAddon);
  const payment = item.paymentValidity || {};
  const actions = buildActions(item, payment);
  const mealCount = sumQuantity(meals);
  const addonCount = sumQuantity(addons);
  const sourceType = sourceTypeFor(item);
  const delivery = item.delivery || {};
  const pickup = item.pickup || {};
  const timestamps = item.timestamps || {};

  const clean = {
    ids,
    customer: {
      id: asId((item.customer && item.customer.id) || (item.user && item.user.id) || item.userId),
      name: (item.customer && item.customer.name) || (item.user && item.user.name) || "",
      phone: (item.customer && item.customer.phone) || (item.user && item.user.phone) || "",
    },
    source: {
      type: sourceType,
      reference: buildReference(item),
      date: item.date || (item.context && item.context.date) || delivery.date || null,
      status: item.status || null,
    },
    subscription: {
      id: ids.subscriptionId,
      plan: item.plan ? {
        id: asId(item.plan.id),
        key: item.plan.key || null,
        name: item.plan.name || "",
        proteinGrams: item.plan.proteinGrams === undefined || item.plan.proteinGrams === null ? null : asNumber(item.plan.proteinGrams, null),
        portionSize: item.plan.portionSize || null,
        selectedMealsPerDay: item.plan.selectedMealsPerDay === undefined || item.plan.selectedMealsPerDay === null ? null : asNumber(item.plan.selectedMealsPerDay, null),
        totalMeals: asNumber(item.plan.totalMeals, 0),
        remainingMeals: asNumber(item.plan.remainingMeals, 0),
        deliveryMode: item.plan.deliveryMode || null,
      } : null,
    },
    orderSummary: {
      mealCount,
      itemCount: mealCount + addonCount,
      hasPremium: meals.some((meal) => meal.premium && meal.premium.isPremium),
      hasAddons: addonCount > 0,
      notes: item.notes || (item.context && item.context.notes) || null,
      allergies: item.allergies || (item.context && item.context.allergies) || null,
    },
    kitchen: { meals, addons },
    fulfillment: {
      type: fulfillmentTypeFor(item),
      delivery: {
        deliveryId: asId(delivery.deliveryId),
        date: delivery.date || item.date || null,
        status: delivery.status || null,
        address: delivery.address || null,
        window: delivery.window || delivery.deliveryWindow || (item.context && item.context.window) || null,
        zoneId: asId(delivery.zoneId),
        courierId: asId(delivery.courierId),
      },
      pickup: {
        pickupRequestId: asId(pickup.pickupRequestId || ids.pickupRequestId),
        branchId: asId(pickup.branchId || pickup.pickupLocationId),
        locationId: asId(pickup.locationId || pickup.pickupLocationId),
        mealCount: asNumber(pickup.mealCount || item.mealCount || (item.context && item.context.mealCount), 0),
        reserved: Boolean(pickup.reserved),
        consumed: Boolean(pickup.consumed),
        released: Boolean(pickup.released),
        pickupCodeState: pickup.pickupCodeState || null,
        remainingMeals: pickup.remainingMeals === undefined ? null : asNumber(pickup.remainingMeals, null),
      },
    },
    payment: {
      paymentRequired: Boolean(payment.paymentRequired),
      paymentStatus: payment.paymentStatus || null,
      paymentApplied: Boolean(payment.paymentApplied),
      pendingUnpaid: Boolean(payment.pendingUnpaid),
      superseded: Boolean(payment.superseded),
      revisionMismatch: Boolean(payment.revisionMismatch),
      canPrepare: Boolean(payment.canPrepare),
      canFulfill: Boolean(payment.canFulfill),
      reason: payment.reason || null,
    },
    actions,
    timestamps: {
      createdAt: timestamps.createdAt || item.createdAt || null,
      updatedAt: timestamps.updatedAt || item.updatedAt || null,
      preparedAt: item.preparedAt || item.pickupPreparedAt || null,
      fulfilledAt: timestamps.fulfilledAt || item.fulfilledAt || null,
    },

    // Lightweight compatibility aliases. Heavy raw/internal fields stay out of
    // the default response and are only attached under `raw` when requested.
    id: ids.entityId,
    entityId: ids.entityId,
    entityType: ids.entityType,
    subscriptionId: ids.subscriptionId,
    subscriptionDayId: ids.subscriptionDayId,
    orderId: ids.orderId,
    requestId: ids.pickupRequestId,
    date: item.date || (item.context && item.context.date) || null,
    status: item.status || null,
    allowedActions: actions.allowed,
  };

  if (includeRaw) clean.raw = item;
  return clean;
}

function normalizeKitchenQueueResponse(data = {}, { includeRaw = false, businessDate = null } = {}) {
  const items = (Array.isArray(data.items) ? data.items : []).map((item) => normalizeKitchenQueueItem(item, { includeRaw }));
  return {
    contractVersion: CONTRACT_VERSION,
    date: data.date || null,
    businessDate: data.businessDate || businessDate || data.date || null,
    count: items.length,
    items,
    filters: data.filters || {},
  };
}

function shouldUseCleanQueueContract(screen, query = {}) {
  return QUEUE_SCREENS.has(String(screen || ""))
    && String(query.view || "").trim().toLowerCase() !== "legacy";
}

function isTruthyQuery(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

module.exports = {
  CONTRACT_VERSION,
  isTruthyQuery,
  normalizeDashboardQueueItem: normalizeKitchenQueueItem,
  normalizeDashboardQueueResponse: normalizeKitchenQueueResponse,
  normalizeKitchenQueueItem,
  normalizeKitchenQueueResponse,
  shouldUseCleanQueueContract,
};
