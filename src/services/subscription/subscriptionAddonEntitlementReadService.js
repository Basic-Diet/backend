const ADDON_ENTITLEMENT_CATEGORIES = Object.freeze(["juice", "snack", "small_salad"]);

function normalizeSelectedAddonItem(selection) {
  if (!selection) return null;
  return {
    id: selection.addonId ? String(selection.addonId) : null,
    menuProductId: selection.addonId ? String(selection.addonId) : null,
    name: selection.name || "",
    category: selection.category || "",
    source: selection.source || "",
    priceHalala: Number(selection.priceHalala || 0),
    currency: selection.currency || "SAR",
  };
}

function buildAddonEntitlementsReadModel(addonSubscriptions = [], addonSelections = []) {
  const subscriptions = Array.isArray(addonSubscriptions) ? addonSubscriptions : [];
  const selections = Array.isArray(addonSelections) ? addonSelections : [];

  return ADDON_ENTITLEMENT_CATEGORIES.reduce((accumulator, category) => {
    const entitlement = subscriptions.find((item) => item && item.category === category);
    const selection = selections.find((item) => item && item.category === category);
    const selectedItem = entitlement ? normalizeSelectedAddonItem(selection) : null;

    accumulator[category] = {
      category,
      subscribed: Boolean(entitlement),
      addonPlanId: entitlement && entitlement.addonId ? String(entitlement.addonId) : null,
      name: entitlement && entitlement.name ? entitlement.name : "",
      maxPerDay: entitlement ? Number(entitlement.maxPerDay || 1) : 0,
      selectedItem,
      status: entitlement ? (selectedItem ? "selected" : "pending_selection") : "not_subscribed",
    };
    return accumulator;
  }, {});
}

module.exports = {
  ADDON_ENTITLEMENT_CATEGORIES,
  buildAddonEntitlementsReadModel,
  normalizeSelectedAddonItem,
};
