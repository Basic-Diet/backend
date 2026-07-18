const PLANNER_CATALOG_V3_VERSION = "meal_planner_menu.v3";

function hasSelectableOptionGroup(product) {
  return Array.isArray(product.optionGroups)
    && product.optionGroups.some((group) => Array.isArray(group?.options) && group.options.length > 0);
}

function isSelectablePlannerProduct(product) {
  if (!product || typeof product !== "object" || Array.isArray(product)) return false;
  return product.action?.type === "direct_add"
    || product.action?.treatAsFullMeal === true
    || hasSelectableOptionGroup(product);
}

function hasSelectablePlannerContent(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return false;
  if (catalog.contractVersion !== PLANNER_CATALOG_V3_VERSION) return false;
  if (!Array.isArray(catalog.sections) || catalog.sections.length === 0) return false;

  return catalog.sections.some((section) => (
    Array.isArray(section?.products) && section.products.some(isSelectablePlannerProduct)
  ));
}

module.exports = {
  PLANNER_CATALOG_V3_VERSION,
  hasSelectablePlannerContent,
};
