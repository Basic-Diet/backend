const CheckoutDraft = require("../../models/CheckoutDraft");
const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const Subscription = require("../../models/Subscription");
const SubscriptionDay = require("../../models/SubscriptionDay");

function createArchiveGuardError(message, code = "CATALOG_ITEM_IN_USE") {
  const err = new Error(message);
  err.code = code;
  err.status = 409;
  err.statusCode = 409;
  return err;
}

async function countCatalogReferences({ id, key }) {
  const idString = id ? String(id) : "";
  const keyString = key ? String(key) : "";
  const idOrNone = idString || "__none__";
  const keyOrNone = keyString || "__none__";

  const [
    subscriptions,
    days,
    orders,
    payments,
    drafts,
  ] = await Promise.all([
    Subscription.countDocuments({
      $or: [
        { "premiumBalance.proteinId": idOrNone },
        { "premiumBalance.premiumKey": keyOrNone },
        { "addonBalance.addonId": idOrNone },
        { "addonBalance.addonPlanId": idOrNone },
        { planId: idOrNone },
      ],
    }),
    SubscriptionDay.countDocuments({
      $or: [
        { "mealSlots.productId": idOrNone },
        { "mealSlots.premiumKey": keyOrNone },
        { "addonSelections.addonId": idOrNone },
      ],
    }),
    Order.countDocuments({
      $or: [
        { "items.productId": idOrNone },
        { "items.catalogRef.id": idOrNone },
        { "items.productSnapshot.key": keyOrNone },
      ],
    }),
    Payment.countDocuments({
      $or: [
        { "metadata.premiumItems.premiumKey": keyOrNone },
        { "metadata.oneTimeAddonSelections.addonId": idOrNone },
        { "metadata.addonId": idOrNone },
      ],
    }),
    CheckoutDraft.countDocuments({
      $or: [
        { "premiumItems.proteinId": idOrNone },
        { "premiumItems.premiumKey": keyOrNone },
        { "addonSubscriptions.addonId": idOrNone },
        { "addonSubscriptions.addonPlanId": idOrNone },
        { planId: idOrNone },
      ],
    }),
  ]);

  const total = subscriptions + days + orders + payments + drafts;
  return { total, subscriptions, days, orders, payments, drafts };
}

async function assertSafeHardDelete({ id, key, entityLabel = "catalog item" }) {
  const references = await countCatalogReferences({ id, key });
  if (references.total > 0) {
    throw createArchiveGuardError(`Cannot hard-delete ${entityLabel}; archive it because it is referenced by historical records`, "CATALOG_HARD_DELETE_BLOCKED");
  }
  return references;
}

async function archiveDocument(doc, { archivedAt = new Date() } = {}) {
  if (!doc) return null;
  doc.isActive = false;
  if ("isArchived" in doc || doc.schema?.path("isArchived")) doc.isArchived = true;
  if ("archivedAt" in doc || doc.schema?.path("archivedAt")) doc.archivedAt = archivedAt;
  if ("status" in doc && doc.status !== "archived") doc.status = "archived";
  await doc.save();
  return doc;
}

module.exports = {
  assertSafeHardDelete,
  archiveDocument,
  countCatalogReferences,
  createArchiveGuardError,
};
