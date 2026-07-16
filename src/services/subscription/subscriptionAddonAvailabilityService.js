"use strict";

function booleanOrFallback(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function resolveCatalogStatus(product = {}, overrides = {}) {
  const liveCatalogMissing = booleanOrFallback(
    overrides.liveCatalogMissing,
    product._liveCatalogMissing === true
  );
  const catalogActive = booleanOrFallback(
    overrides.catalogActive,
    booleanOrFallback(product._catalogActive, !liveCatalogMissing && product.isActive !== false)
  );
  const catalogAvailable = booleanOrFallback(
    overrides.catalogAvailable,
    booleanOrFallback(product._catalogAvailable, !liveCatalogMissing && product.isAvailable !== false)
  );
  const liveCatalogActive = booleanOrFallback(overrides.liveCatalogActive, catalogActive);
  const liveCatalogAvailable = booleanOrFallback(overrides.liveCatalogAvailable, catalogAvailable);

  return {
    catalogActive,
    catalogAvailable,
    liveCatalogActive,
    liveCatalogAvailable,
    liveCatalogMissing,
  };
}

/**
 * Mobile selection availability is intentionally separate from new-sale
 * catalog availability. An immutable, allowance-covered subscription snapshot
 * remains selectable even after its live product is archived or disabled.
 */
function buildAddonSelectionAvailability({
  product = {},
  pricing = {},
  ownedSnapshot = false,
  snapshotMissing = false,
  availableForNewSale,
  ...catalogOverrides
} = {}) {
  const catalog = resolveCatalogStatus(product, catalogOverrides);
  const newSaleAvailable = booleanOrFallback(
    availableForNewSale,
    product.availableForNewSale !== false
  );
  const isOwnedSnapshot = ownedSnapshot === true;
  const isCoveredOwnedSnapshot = isOwnedSnapshot
    && pricing.source === "subscription"
    && pricing.pricingMode === "allowance_covered"
    && Number(pricing.coveredQty || 0) > 0;

  let selectionAvailable = false;
  let disableReason = null;

  if (snapshotMissing === true) {
    disableReason = "OWNED_SNAPSHOT_MISSING";
  } else if (isCoveredOwnedSnapshot) {
    // The purchased snapshot is the authority for entitlement usage. Live
    // catalog status only controls whether the same product can be sold again.
    selectionAvailable = true;
  } else if (isOwnedSnapshot) {
    // Paid overage for a known owned product still follows live operational
    // status, but availableForNewSale=false alone must not disable ownership.
    selectionAvailable = catalog.liveCatalogActive && catalog.liveCatalogAvailable;
  } else {
    selectionAvailable = catalog.liveCatalogActive
      && catalog.liveCatalogAvailable
      && newSaleAvailable;
  }

  if (!selectionAvailable && !disableReason) {
    if (!catalog.liveCatalogActive) disableReason = "LIVE_CATALOG_INACTIVE";
    else if (!catalog.liveCatalogAvailable) disableReason = "LIVE_CATALOG_UNAVAILABLE";
    else if (!newSaleAvailable && !isOwnedSnapshot) disableReason = "NOT_AVAILABLE_FOR_NEW_SALE";
    else disableReason = "SELECTION_UNAVAILABLE";
  }

  return {
    available: selectionAvailable,
    active: selectionAvailable,
    availableForNewSale: newSaleAvailable,
    catalogAvailable: catalog.catalogAvailable,
    catalogActive: catalog.catalogActive,
    liveCatalogAvailable: catalog.liveCatalogAvailable,
    liveCatalogActive: catalog.liveCatalogActive,
    selectable: selectionAvailable,
    selectionAvailable,
    disabled: !selectionAvailable,
    disableReason,
  };
}

module.exports = {
  buildAddonSelectionAvailability,
  resolveCatalogStatus,
};
