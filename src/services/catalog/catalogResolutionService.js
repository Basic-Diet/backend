const mongoose = require("mongoose");

const Addon = require("../../models/Addon");
const BuilderCarb = require("../../models/BuilderCarb");
const BuilderProtein = require("../../models/BuilderProtein");
const MenuOption = require("../../models/MenuOption");
const MenuProduct = require("../../models/MenuProduct");
const Plan = require("../../models/Plan");
const PremiumUpgradeConfig = require("../../models/PremiumUpgradeConfig");
const Setting = require("../../models/Setting");
const Zone = require("../../models/Zone");

const LEGACY_PREMIUM_ALIASES = Object.freeze({
  custom_premium_salad: "premium_large_salad",
});

function createCatalogResolutionError(code, message, status = 422, details) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.statusCode = status;
  if (details !== undefined) err.details = details;
  return err;
}

function normalizeStableKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return LEGACY_PREMIUM_ALIASES[normalized] || normalized;
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function isActiveVisibleAvailable(doc = {}) {
  return Boolean(doc)
    && doc.isActive !== false
    && doc.active !== false
    && doc.isDeleted !== true
    && doc.isArchived !== true
    && doc.status !== "archived"
    && doc.isVisible !== false
    && doc.isAvailable !== false
    && doc.available !== false;
}

function applySession(query, session) {
  return session && query && typeof query.session === "function"
    ? query.session(session)
    : query;
}

async function findBuilderProteinByPremiumKey(premiumKey, { session = null, includeInactive = false } = {}) {
  const filter = {
    premiumKey,
    isPremium: true,
  };
  if (!includeInactive) {
    Object.assign(filter, {
      isActive: true,
      isArchived: { $ne: true },
      availableForSubscription: { $ne: false },
    });
  }
  const query = BuilderProtein.findOne(filter);
  return applySession(query, session).lean();
}

async function findMenuOptionByPremiumKey(premiumKey, { session = null, includeInactive = false } = {}) {
  const filter = {
    $or: [{ premiumKey }, { key: premiumKey }],
  };
  if (!includeInactive) {
    Object.assign(filter, {
      isActive: true,
      isVisible: { $ne: false },
      isAvailable: { $ne: false },
      availableForSubscription: { $ne: false },
    });
  }
  const query = MenuOption.findOne(filter);
  return applySession(query, session).lean();
}

async function findPremiumUpgradeConfig(premiumKey, { session = null, includeInactive = false, includeHidden = false } = {}) {
  const filter = { premiumKey };
  if (!includeInactive) {
    Object.assign(filter, {
      status: "active",
      isEnabled: true,
    });
  }
  if (!includeHidden) {
    filter.isVisible = { $ne: false };
  }
  const query = PremiumUpgradeConfig.findOne(filter);
  return applySession(query, session).lean();
}

async function findAnyPremiumUpgradeConfig(premiumKey, { session = null } = {}) {
  const query = PremiumUpgradeConfig.findOne({ premiumKey });
  return applySession(query, session).lean();
}

async function findMenuProductByPremiumKey(premiumKey, { session = null, includeInactive = false } = {}) {
  const filter = { key: premiumKey };
  if (!includeInactive) {
    Object.assign(filter, {
      isActive: true,
      isVisible: { $ne: false },
      isAvailable: { $ne: false },
    });
  }
  const query = MenuProduct.findOne(filter);
  return applySession(query, session).lean();
}

function buildSourceSnapshot({ doc, sourceType, key, entityType }) {
  const name = doc && doc.name ? doc.name : {};
  return {
    sourceId: doc && doc._id ? String(doc._id) : null,
    sourceModel: sourceType,
    key,
    entityType,
    name: {
      ar: String(name.ar || ""),
      en: String(name.en || ""),
    },
    imageUrl: String((doc && doc.imageUrl) || ""),
    currency: String((doc && doc.currency) || "SAR").toUpperCase(),
    updatedAt: doc && doc.updatedAt ? doc.updatedAt : null,
  };
}

async function resolvePremiumCatalogItem(input = {}, options = {}) {
  const {
    premiumKey: rawPremiumKey,
    proteinId,
    builderProteinDoc,
    optionDoc,
    includeInactive = false,
  } = input;
  const { session = null } = options;
  const premiumKey = normalizeStableKey(rawPremiumKey || (builderProteinDoc && builderProteinDoc.premiumKey) || (optionDoc && (optionDoc.premiumKey || optionDoc.key)));

  let resolvedProtein = builderProteinDoc || null;
  let resolvedOption = optionDoc || null;
  let resolvedProduct = null;

  if (!resolvedProtein && proteinId && isObjectId(proteinId)) {
    const query = BuilderProtein.findOne({
      _id: proteinId,
      isPremium: true,
      ...(includeInactive ? {} : { isActive: true, isArchived: { $ne: true }, availableForSubscription: { $ne: false } }),
    });
    resolvedProtein = await applySession(query, session).lean();
  }

  const normalizedKey = normalizeStableKey(premiumKey || (resolvedProtein && resolvedProtein.premiumKey));
  if (!normalizedKey) {
    throw createCatalogResolutionError("PREMIUM_KEY_REQUIRED", "premiumKey is required", 400);
  }

  const config = await findPremiumUpgradeConfig(normalizedKey, { session, includeInactive });
  const anyConfig = config || await findAnyPremiumUpgradeConfig(normalizedKey, { session });
  if (!resolvedProtein && normalizedKey) {
    resolvedProtein = await findBuilderProteinByPremiumKey(normalizedKey, { session, includeInactive });
  }
  if (!resolvedOption && normalizedKey) {
    resolvedOption = await findMenuOptionByPremiumKey(normalizedKey, { session, includeInactive });
  }
  if (!resolvedProtein && !resolvedOption && normalizedKey) {
    resolvedProduct = await findMenuProductByPremiumKey(normalizedKey, { session, includeInactive });
  }

  const primaryDoc = resolvedProtein || resolvedOption || resolvedProduct || null;
  if (!primaryDoc && !config) {
    throw createCatalogResolutionError("INVALID_PREMIUM_ITEM", `Premium item is not configured or available: ${normalizedKey}`, 422);
  }

  if (anyConfig && !config && !includeInactive) {
    throw createCatalogResolutionError("PREMIUM_UPGRADE_UNAVAILABLE", `Premium upgrade is unavailable: ${normalizedKey}`, 422);
  }

  if (primaryDoc && !includeInactive && !isActiveVisibleAvailable(primaryDoc)) {
    throw createCatalogResolutionError("PREMIUM_ITEM_UNAVAILABLE", `Premium item is unavailable: ${normalizedKey}`, 422);
  }

  if (config && !includeInactive && !isActiveVisibleAvailable(config)) {
    throw createCatalogResolutionError("PREMIUM_UPGRADE_UNAVAILABLE", `Premium upgrade is unavailable: ${normalizedKey}`, 422);
  }

  const sourceType = resolvedProtein ? "builder_protein" : resolvedOption ? "menu_option" : resolvedProduct ? "menu_product" : (config && config.sourceType) || "premium_upgrade";
  const sourceDoc = primaryDoc || config;
  return {
    premiumKey: normalizedKey,
    config,
    builderProteinDoc: resolvedProtein,
    menuOptionDoc: resolvedOption,
    menuProductDoc: resolvedProduct,
    sourceDoc,
    sourceType,
    sourceSnapshot: buildSourceSnapshot({
      doc: sourceDoc,
      sourceType,
      key: normalizedKey,
      entityType: normalizedKey === "premium_large_salad" ? "premium_large_salad" : "premium_meal",
    }),
  };
}

async function resolveSubscriptionPlan(planId, { session = null, includeInactive = false } = {}) {
  const filter = { _id: planId };
  if (!includeInactive) Object.assign(filter, Plan.getSellableQuery());
  const query = Plan.findOne(filter);
  const plan = await applySession(query, session).lean();
  if (!plan || !Plan.isViable(plan)) {
    throw createCatalogResolutionError("PLAN_UNAVAILABLE", "Plan not available", 422);
  }
  return plan;
}

async function resolveCatalogEntity(entityType, identifier, options = {}) {
  const key = normalizeStableKey(identifier);
  const byId = isObjectId(identifier) ? { _id: identifier } : null;
  const byKey = key ? { key } : null;
  const filter = byId || byKey;
  if (!filter) throw createCatalogResolutionError("INVALID_CATALOG_IDENTIFIER", "Invalid catalog identifier", 400);

  const { session = null, includeInactive = false } = options;
  const Model = {
    menu_product: MenuProduct,
    menu_option: MenuOption,
    builder_protein: BuilderProtein,
    builder_carb: BuilderCarb,
    addon_item: Addon,
    addon_plan: Addon,
    subscription_plan: Plan,
    delivery_zone: Zone,
    pickup_location: Setting,
  }[entityType];
  if (!Model) throw createCatalogResolutionError("UNSUPPORTED_CATALOG_ENTITY", `Unsupported catalog entity: ${entityType}`, 400);

  let query = Model.findOne(filter);
  if (session && typeof query.session === "function") query = query.session(session);
  const doc = await query.lean();
  if (!doc || (!includeInactive && !isActiveVisibleAvailable(doc))) {
    throw createCatalogResolutionError("CATALOG_ENTITY_UNAVAILABLE", `${entityType} is unavailable`, 422);
  }
  return doc;
}

module.exports = {
  createCatalogResolutionError,
  normalizeStableKey,
  resolveCatalogEntity,
  resolvePremiumCatalogItem,
  resolveSubscriptionPlan,
};
