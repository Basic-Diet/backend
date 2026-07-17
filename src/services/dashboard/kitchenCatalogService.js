"use strict";

const BuilderProtein = require("../../models/BuilderProtein");
const BuilderCarb = require("../../models/BuilderCarb");
const MenuProduct = require("../../models/MenuProduct");
const MenuOption = require("../../models/MenuOption");
const SaladIngredient = require("../../models/SaladIngredient");
const Addon = require("../../models/Addon");
const Meal = require("../../models/Meal");
const Sandwich = require("../../models/Sandwich");

function collectCatalogRefsFromDays(days) {
  const refs = {
    proteinIds: new Set(),
    proteinKeys: new Set(),
    carbIds: new Set(),
    carbKeys: new Set(),
    productIds: new Set(),
    productKeys: new Set(),
    sandwichIds: new Set(),
    sandwichKeys: new Set(),
    optionIds: new Set(),
    optionKeys: new Set(),
    saladItemIds: new Set(),
    saladItemKeys: new Set(),
    addonIds: new Set(),
    addonKeys: new Set(),
    addonPlanIds: new Set(),
  };
  const isObjectId = (val) => /^[a-fA-F0-9]{24}$/.test(String(val || ""));
  const addIdRef = (set, value) => {
    if (value !== undefined && value !== null && value !== "") {
      const str = String(value).trim();
      if (isObjectId(str)) set.add(str);
    }
  };
  const addKeyRef = (set, value) => {
    if (value !== undefined && value !== null && value !== "") {
      set.add(String(value).trim());
    }
  };
  const collectOption = (option) => {
    if (!option || typeof option !== "object") return;
    addIdRef(refs.optionIds, option.optionId || option.id || option._id);
    addKeyRef(refs.optionKeys, option.optionKey || option.key);
  };
  const collectSalad = (salad) => {
    const groups = salad && typeof salad === "object" && salad.groups && typeof salad.groups === "object"
      ? salad.groups
      : {};
    for (const values of Object.values(groups)) {
      for (const item of Array.isArray(values) ? values : []) {
        if (item && typeof item === "object") {
          addIdRef(refs.saladItemIds, item.id || item._id || item.optionId || item.ingredientId);
          addKeyRef(refs.saladItemKeys, item.key || item.optionKey || item.ingredientKey);
          addIdRef(refs.optionIds, item.id || item._id || item.optionId || item.ingredientId);
          addKeyRef(refs.optionKeys, item.key || item.optionKey || item.ingredientKey);
          addIdRef(refs.proteinIds, item.id || item._id || item.optionId || item.ingredientId);
          addKeyRef(refs.proteinKeys, item.key || item.optionKey || item.ingredientKey);
        } else {
          addIdRef(refs.saladItemIds, item);
          addIdRef(refs.optionIds, item);
          addIdRef(refs.proteinIds, item);
        }
      }
    }
  };
  const collectAddon = (addon) => {
    if (!addon || typeof addon !== "object") return;
    addIdRef(refs.addonIds, addon.addonId || addon.id || addon._id || addon.productId || addon.menuProductId);
    addKeyRef(refs.addonKeys, addon.addonKey || addon.key || addon.productKey);
    addIdRef(refs.productIds, addon.productId || addon.menuProductId);
    addKeyRef(refs.productKeys, addon.productKey || addon.key || addon.addonKey);
    addIdRef(refs.addonPlanIds, addon.addonPlanId);
  };
  for (const day of Array.isArray(days) ? days : []) {
    const slots = []
      .concat(Array.isArray(day && day.mealSlots) ? day.mealSlots : [])
      .concat(day && day.snapshot && Array.isArray(day.snapshot.mealSlots) ? day.snapshot.mealSlots : []);
    for (const slot of slots) {
      addIdRef(refs.proteinIds, slot.proteinId);
      addKeyRef(refs.proteinKeys, slot.proteinFamilyKey);
      addIdRef(refs.productIds, slot.productId);
      addKeyRef(refs.productKeys, slot.productKey);
      addIdRef(refs.sandwichIds, slot.sandwichId);
      addKeyRef(refs.sandwichKeys, slot.sandwichKey);
      if (slot.selectionType === "premium_large_salad") {
        addKeyRef(refs.productKeys, "premium_large_salad");
      }
      collectSalad(slot.salad || slot.customSalad);
      for (const option of Array.isArray(slot.selectedOptions) ? slot.selectedOptions : []) collectOption(option);
      const confirmation = slot.confirmationSnapshot || {};
      const display = slot.displaySnapshot || {};
      const fulfillment = slot.fulfillmentSnapshot || {};
      addIdRef(refs.proteinIds, fulfillment.proteinId);
      addKeyRef(refs.proteinKeys, confirmation.proteinKey);
      addKeyRef(refs.proteinKeys, fulfillment.proteinKey);
      for (const product of [confirmation.product, display.product, fulfillment.product]) {
        if (!product) continue;
        addIdRef(refs.productIds, product.id || product._id);
        addKeyRef(refs.productKeys, product.key);
      }
      for (const carb of []
        .concat(Array.isArray(slot.carbSelections) ? slot.carbSelections : [])
        .concat(Array.isArray(slot.carbs) ? slot.carbs : [])
        .concat(slot.carbId ? [{ carbId: slot.carbId }] : [])) {
        if (carb && carb.carbId) addIdRef(refs.carbIds, carb.carbId);
        if (carb && carb.key) addKeyRef(refs.carbKeys, carb.key);
      }
    }
    for (const premiumSelection of Array.isArray(day && day.premiumUpgradeSelections) ? day.premiumUpgradeSelections : []) {
      addIdRef(refs.productIds, premiumSelection.sourceProductId || premiumSelection.sourceId);
      addKeyRef(refs.productKeys, premiumSelection.sourceKey);
    }
    for (const meal of Array.isArray(day && day.materializedMeals) ? day.materializedMeals : []) {
      addIdRef(refs.proteinIds, meal.proteinId);
      addKeyRef(refs.proteinKeys, meal.proteinFamilyKey);
      addIdRef(refs.carbIds, meal.carbId);
      addIdRef(refs.productIds, meal.productId);
      addKeyRef(refs.productKeys, meal.productKey);
      addIdRef(refs.sandwichIds, meal.sandwichId);
    }
    for (const addon of []
      .concat(Array.isArray(day && day.addonSelections) ? day.addonSelections : [])
      .concat(Array.isArray(day && day.oneTimeAddonSelections) ? day.oneTimeAddonSelections : [])
      .concat(Array.isArray(day && day.recurringAddons) ? day.recurringAddons : [])
      .concat(day && day.snapshot && Array.isArray(day.snapshot.addons) ? day.snapshot.addons : [])) collectAddon(addon);
    for (const item of Array.isArray(day && day.items) ? day.items : []) {
      const selections = item.selections || {};
      const itemType = String(item.itemType || item.type || "");
      if (itemType === "addon_item" || itemType === "drink" || itemType === "dessert") {
        collectAddon({
          id: (item.catalogRef && item.catalogRef.id) || item.productId || item.mealId,
          key: item.productKey || (item.productSnapshot && item.productSnapshot.key),
        });
        continue;
      }
      addIdRef(refs.productIds, item.productId || item.mealId || (item.catalogRef && item.catalogRef.id));
      addKeyRef(refs.productKeys, item.productKey || (item.productSnapshot && item.productSnapshot.key));
      addIdRef(refs.proteinIds, selections.proteinId);
      addKeyRef(refs.proteinKeys, selections.proteinKey);
      collectSalad(selections.salad);
      for (const option of []
        .concat(Array.isArray(item.selectedOptions) ? item.selectedOptions : [])
        .concat(Array.isArray(selections.selectedOptions) ? selections.selectedOptions : [])) collectOption(option);
      for (const carb of Array.isArray(selections.carbs) ? selections.carbs : []) {
        addIdRef(refs.carbIds, carb && carb.carbId);
        addKeyRef(refs.carbKeys, carb && carb.key);
      }
    }
    const selectedPickupItems = []
      .concat(Array.isArray(day && day.selectedPickupItems) ? day.selectedPickupItems : [])
      .concat(day && day.snapshot && Array.isArray(day.snapshot.selectedPickupItems) ? day.snapshot.selectedPickupItems : []);
    for (const item of selectedPickupItems) {
      if (!item) continue;
      const realId = (item.product && (item.product.id || item.product._id)) || item.addonId || item.sourceId;
      if (item.itemType === "sandwich") {
        addIdRef(refs.sandwichIds, realId);
      } else if (item.itemType !== "addon") {
        addIdRef(refs.productIds, realId);
      } else {
        addIdRef(refs.addonIds, realId);
      }
      for (const comp of Array.isArray(item.components) ? item.components : []) {
        if (!comp) continue;
        addIdRef(refs.optionIds, comp.id);
        addKeyRef(refs.optionKeys, comp.key);
      }
    }
  }
  return refs;
}

function mapBy(rows, field) {
  return new Map((Array.isArray(rows) ? rows : [])
    .map((row) => row && row[field] ? [String(row[field]), row] : null)
    .filter(Boolean));
}

async function buildKitchenCatalogMaps(days) {
  const refs = collectCatalogRefsFromDays(days);
  const [proteins, carbs, products, meals, sandwiches, menuOptions, saladIngredients, addons, addonProducts, addonPlans] = await Promise.all([
    (refs.proteinIds.size || refs.proteinKeys.size)
      ? BuilderProtein.find({
        $or: [
          refs.proteinIds.size ? { _id: { $in: [...refs.proteinIds] } } : null,
          refs.proteinKeys.size ? { key: { $in: [...refs.proteinKeys] } } : null,
          refs.proteinKeys.size ? { proteinFamilyKey: { $in: [...refs.proteinKeys] } } : null,
        ].filter(Boolean),
      }).select("_id key proteinFamilyKey name").lean()
      : Promise.resolve([]),
    (refs.carbIds.size || refs.carbKeys.size)
      ? BuilderCarb.find({
        $or: [
          refs.carbIds.size ? { _id: { $in: [...refs.carbIds] } } : null,
          refs.carbKeys.size ? { key: { $in: [...refs.carbKeys] } } : null,
        ].filter(Boolean),
      }).select("_id key name").lean()
      : Promise.resolve([]),
    (refs.productIds.size || refs.productKeys.size || refs.sandwichIds.size || refs.sandwichKeys.size)
      ? MenuProduct.find({
        $or: [
          refs.productIds.size ? { _id: { $in: [...refs.productIds] } } : null,
          refs.productKeys.size ? { key: { $in: [...refs.productKeys] } } : null,
          refs.sandwichIds.size ? { _id: { $in: [...refs.sandwichIds] } } : null,
          refs.sandwichKeys.size ? { key: { $in: [...refs.sandwichKeys] } } : null,
        ].filter(Boolean),
      }).select("_id key name imageUrl priceHalala itemType").lean()
      : Promise.resolve([]),
    refs.sandwichIds.size
      ? Meal.find({ _id: { $in: [...refs.sandwichIds] } }).select("_id name").lean()
      : Promise.resolve([]),
    refs.sandwichIds.size
      ? Sandwich.find({ _id: { $in: [...refs.sandwichIds] } }).select("_id name").lean()
      : Promise.resolve([]),
    (refs.optionIds.size || refs.optionKeys.size || refs.saladItemIds.size || refs.saladItemKeys.size)
      ? MenuOption.find({
        $or: [
          (refs.optionIds.size || refs.saladItemIds.size) ? { _id: { $in: [...refs.optionIds, ...refs.saladItemIds] } } : null,
          (refs.optionKeys.size || refs.saladItemKeys.size) ? { key: { $in: [...refs.optionKeys, ...refs.saladItemKeys] } } : null,
        ].filter(Boolean),
      }).select("_id key name proteinFamilyKey displayCategoryKey selectionType").lean()
      : Promise.resolve([]),
    refs.saladItemIds.size
      ? SaladIngredient.find({ _id: { $in: [...refs.saladItemIds] } }).select("_id name groupKey").lean()
      : Promise.resolve([]),
    refs.addonIds.size
      ? Addon.find({ _id: { $in: [...refs.addonIds] } }).select("_id name menuProductId category").lean()
      : Promise.resolve([]),
    (refs.addonIds.size || refs.addonKeys.size)
      ? MenuProduct.find({
        $or: [
          refs.addonIds.size ? { _id: { $in: [...refs.addonIds] } } : null,
          refs.addonKeys.size ? { key: { $in: [...refs.addonKeys] } } : null,
        ].filter(Boolean),
      }).select("_id key name imageUrl priceHalala itemType").lean()
      : Promise.resolve([]),
    refs.addonPlanIds.size
      ? Addon.find({ _id: { $in: [...refs.addonPlanIds] } })
        .select("_id name displayKey category imageUrl")
        .lean()
      : Promise.resolve([]),
  ]);
  const sandwichRows = [...products, ...meals, ...sandwiches];
  const optionById = mapBy(menuOptions, "_id");
  const optionByKey = mapBy(menuOptions, "key");
  const addonProductById = mapBy(addonProducts, "_id");
  const saladRows = saladIngredients.map((ingredient) => ({
    ...ingredient,
    key: ingredient.key || (optionById.get(String(ingredient._id)) || {}).key || null,
  }));
  const addonRows = [
    ...addons.map((addon) => {
      const linkedProduct = addon.menuProductId ? addonProductById.get(String(addon.menuProductId)) : null;
      return {
        ...addon,
        key: addon.key || (linkedProduct && linkedProduct.key) || null,
        name: addon.name || (linkedProduct && linkedProduct.name),
      };
    }),
    ...addonProducts,
  ];
  return {
    proteinById: mapBy(proteins, "_id"),
    proteinByKey: new Map(proteins.flatMap((protein) => [
      protein.key ? [String(protein.key), protein] : null,
      protein.proteinFamilyKey ? [String(protein.proteinFamilyKey), protein] : null,
    ].filter(Boolean))),
    carbById: mapBy(carbs, "_id"),
    carbByKey: mapBy(carbs, "key"),
    productById: mapBy(products, "_id"),
    productByKey: mapBy(products, "key"),
    sandwichById: mapBy(sandwichRows, "_id"),
    sandwichByKey: mapBy(sandwichRows, "key"),
    optionById,
    optionByKey,
    saladItemById: mapBy(saladRows, "_id"),
    saladItemByKey: mapBy(saladRows, "key"),
    addonById: mapBy(addonRows, "_id"),
    addonByKey: mapBy(addonRows, "key"),
    addonPlanById: mapBy(addonPlans, "_id"),
  };
}

module.exports = {
  buildKitchenCatalogMaps
};
