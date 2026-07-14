const { assertSystemCurrencyOrThrow, SYSTEM_CURRENCY } = require("../../utils/currency");
const {
  createCatalogResolutionError,
  resolvePremiumCatalogItem,
} = require("./catalogResolutionService");
const {
  resolveSubscriptionPremiumUpgradePricing,
} = require("../subscription/premiumUpgradeConfigService");

function normalizeHalala(value, fieldName = "priceHalala", { allowZero = true } = {}) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || (!allowZero && amount === 0)) {
    throw createCatalogResolutionError("INVALID_CATALOG_PRICE", `${fieldName} must be a valid integer halala amount`, 422);
  }
  return amount;
}

async function resolvePremiumPrice(premiumKey, options = {}) {
  const resolved = await resolvePremiumCatalogItem({ premiumKey, ...options }, options);
  const upgrade = await resolveSubscriptionPremiumUpgradePricing(resolved.premiumKey, {
    fallbackPriceHalala:
      resolved.menuOptionDoc && resolved.menuOptionDoc.extraPriceHalala !== undefined
        ? resolved.menuOptionDoc.extraPriceHalala
        : resolved.builderProteinDoc
          ? resolved.builderProteinDoc.extraFeeHalala
          : undefined,
    optionDoc: resolved.menuOptionDoc,
    builderProteinDoc: resolved.builderProteinDoc,
    session: options.session || null,
  });
  const priceHalala = normalizeHalala(upgrade.priceHalala, "premium price", { allowZero: Boolean(upgrade.isConfigured) });
  const currency = assertSystemCurrencyOrThrow(upgrade.currency || SYSTEM_CURRENCY, "Premium currency");
  return {
    ...resolved,
    priceHalala,
    unitPriceHalala: priceHalala,
    currency,
    priceSource: upgrade.priceSource,
    configId: upgrade.configId || null,
    revision: upgrade.revision || 0,
    isConfigured: Boolean(upgrade.isConfigured),
  };
}

function resolveDocumentPrice(doc, fieldName = "priceHalala", options = {}) {
  const priceHalala = normalizeHalala(doc && doc[fieldName], fieldName, options);
  const currency = assertSystemCurrencyOrThrow((doc && doc.currency) || SYSTEM_CURRENCY, "Catalog currency");
  return {
    priceHalala,
    currency,
    sourceId: doc && doc._id ? String(doc._id) : null,
    sourceKey: doc && doc.key ? String(doc.key) : "",
    sourceUpdatedAt: doc && doc.updatedAt ? doc.updatedAt : null,
  };
}

module.exports = {
  normalizeHalala,
  resolveDocumentPrice,
  resolvePremiumPrice,
};
