const MenuCategory = require("../../models/MenuCategory");
const MenuOption = require("../../models/MenuOption");
const MenuOptionGroup = require("../../models/MenuOptionGroup");
const MenuProduct = require("../../models/MenuProduct");
const ProductGroupOption = require("../../models/ProductGroupOption");
const ProductOptionGroup = require("../../models/ProductOptionGroup");

async function validateMenuCatalog() {
  const [categories, products, groups, options, groupRelations, optionRelations] = await Promise.all([
    MenuCategory.find({}).lean(),
    MenuProduct.find({}).lean(),
    MenuOptionGroup.find({}).lean(),
    MenuOption.find({}).lean(),
    ProductOptionGroup.find({}).lean(),
    ProductGroupOption.find({}).lean(),
  ]);

  const errors = [];
  const warnings = [];
  const summary = {
    categories: categories.length,
    products: products.length,
    groups: groups.length,
    options: options.length,
    activeProducts: products.filter((p) => p.isActive).length,
  };

  const productsByKey = new Map();
  const productsById = new Map();
  products.forEach((p) => {
    productsById.set(String(p._id), p);
    if (p.isActive) {
      if (productsByKey.has(p.key)) errors.push(`Duplicate active product key: ${p.key}`);
      productsByKey.set(p.key, p);
    }
  });

  const categoriesByKey = new Map();
  categories.forEach((c) => {
    if (c.isActive) {
      if (categoriesByKey.has(c.key)) errors.push(`Duplicate active category key: ${c.key}`);
      categoriesByKey.set(c.key, c);
    }
  });

  const groupsById = new Map(groups.map((g) => [String(g._id), g]));
  const optionsById = new Map(options.map((o) => [String(o._id), o]));

  const requiredCustomKeys = ["basic_salad", "basic_meal", "fruit_salad", "greek_yogurt"];
  requiredCustomKeys.forEach((key) => {
    const p = productsByKey.get(key);
    if (!p) {
      errors.push(`Missing required custom product: ${key}`);
    } else if (!p.isActive) {
      warnings.push(`Required custom product is inactive: ${key}`);
    } else if (key === "basic_salad" || key === "basic_meal") {
      if (p.pricingModel !== "per_100g") errors.push(`Product ${key} must have pricingModel per_100g`);
      if (!Number.isInteger(p.priceHalala) || p.priceHalala <= 0) errors.push(`Product ${key} must have integer priceHalala > 0`);
      if (p.baseUnitGrams <= 0) errors.push(`Product ${key} must have baseUnitGrams > 0`);
    } else {
      if (p.pricingModel !== "fixed") errors.push(`Product ${key} must have pricingModel fixed`);
      if (!Number.isInteger(p.priceHalala) || p.priceHalala <= 0) errors.push(`Product ${key} must have integer priceHalala > 0`);
    }
  });

  products.forEach((p) => {
    if (p.isActive) {
      if (p.pricingModel === "fixed" && p.priceHalala <= 0) {
        errors.push(`Active fixed product ${p.key} must have priceHalala > 0`);
      }
      if (p.pricingModel === "per_100g" && (p.priceHalala <= 0 || p.baseUnitGrams <= 0)) {
        errors.push(`Active per_100g product ${p.key} must have priceHalala > 0 and baseUnitGrams > 0`);
      }
    }
  });

  const groupRelationsByProduct = new Map();
  groupRelations.forEach((r) => {
    const p = productsById.get(String(r.productId));
    const g = groupsById.get(String(r.groupId));
    if (!p) errors.push(`ProductOptionGroup references non-existent product: ${r.productId}`);
    if (!g) errors.push(`ProductOptionGroup references non-existent group: ${r.groupId}`);
    if (p && g && r.isActive) {
      if (!p.isActive) errors.push(`Active group relation for inactive product: ${p.key}`);
      if (!g.isActive) errors.push(`Active group relation for inactive group: ${g.key}`);
      if (r.minSelections < 0) errors.push(`Group ${g.key} on ${p.key} has invalid minSelections: ${r.minSelections}`);
      if (r.maxSelections !== null && r.maxSelections < r.minSelections) {
        errors.push(`Group ${g.key} on ${p.key} has maxSelections < minSelections`);
      }
      if (r.isRequired && (r.maxSelections !== null && r.maxSelections <= 0)) {
        errors.push(`Group ${g.key} on ${p.key} isRequired but maxSelections <= 0`);
      }
      if (!groupRelationsByProduct.has(String(p._id))) groupRelationsByProduct.set(String(p._id), []);
      groupRelationsByProduct.get(String(p._id)).push(r);
    }
  });

  const optionsByGroup = new Map();
  options.forEach((o) => {
    if (o.isActive) {
      const groupId = String(o.groupId);
      if (!optionsByGroup.has(groupId)) optionsByGroup.set(groupId, new Set());
      if (optionsByGroup.get(groupId).has(o.key)) {
        errors.push(`Duplicate active option key ${o.key} in group ${groupId}`);
      }
      optionsByGroup.get(groupId).add(o.key);
    }
  });

  const optionRelationsByProductGroup = new Map();
  optionRelations.forEach((r) => {
    const key = `${r.productId}:${r.groupId}:${r.optionId}`;
    if (r.isActive) {
      if (optionRelationsByProductGroup.has(key)) errors.push(`Duplicate active ProductGroupOption for ${key}`);
      optionRelationsByProductGroup.set(key, r);
      const p = productsById.get(String(r.productId));
      const g = groupsById.get(String(r.groupId));
      const o = optionsById.get(String(r.optionId));
      if (!p) errors.push(`ProductGroupOption references non-existent product: ${r.productId}`);
      if (!g) errors.push(`ProductGroupOption references non-existent group: ${r.groupId}`);
      if (!o) errors.push(`ProductGroupOption references non-existent option: ${r.optionId}`);
      if (o && String(o.groupId) !== String(r.groupId)) {
        errors.push(`Option ${o.key} does not belong to group ${g ? g.key : r.groupId}`);
      }
      if (r.extraPriceHalala !== null && (!Number.isInteger(r.extraPriceHalala) || r.extraPriceHalala < 0)) {
        errors.push(`Option ${o ? o.key : r.optionId} on ${p ? p.key : r.productId} has invalid extraPriceHalala`);
      }
      if (r.extraWeightUnitGrams !== null && (!Number.isInteger(r.extraWeightUnitGrams) || r.extraWeightUnitGrams < 0)) {
        errors.push(`Option ${o ? o.key : r.optionId} on ${p ? p.key : r.productId} has invalid extraWeightUnitGrams`);
      }
      if (r.extraWeightPriceHalala !== null && (!Number.isInteger(r.extraWeightPriceHalala) || r.extraWeightPriceHalala < 0)) {
        errors.push(`Option ${o ? o.key : r.optionId} on ${p ? p.key : r.productId} has invalid extraWeightPriceHalala`);
      }
      const unit = r.extraWeightUnitGrams !== null ? r.extraWeightUnitGrams : (o ? o.extraWeightUnitGrams : 0);
      const price = r.extraWeightPriceHalala !== null ? r.extraWeightPriceHalala : (o ? o.extraWeightPriceHalala : 0);
      if (price > 0 && unit <= 0) {
        warnings.push(`Option ${o ? o.key : r.optionId} on ${p ? p.key : r.productId} has extraWeightPrice but unit is 0`);
      }
      if (unit > 0 && price <= 0) {
        warnings.push(`Option ${o ? o.key : r.optionId} on ${p ? p.key : r.productId} has extraWeightUnit but price is 0`);
      }
    }
  });

  groupRelations.filter((r) => r.isActive && r.isRequired).forEach((r) => {
    const activeOptionsCount = optionRelations.filter((relation) => (
      relation.isActive
      && String(relation.productId) === String(r.productId)
      && String(relation.groupId) === String(r.groupId)
    )).length;
    if (activeOptionsCount < r.minSelections) {
      const p = productsById.get(String(r.productId));
      const g = groupsById.get(String(r.groupId));
      errors.push(`Required group ${g ? g.key : r.groupId} on ${p ? p.key : r.productId} only has ${activeOptionsCount} active options, but minSelections is ${r.minSelections}`);
    }
  });

  return { ok: errors.length === 0, errors, warnings, summary };
}

module.exports = { validateMenuCatalog };
