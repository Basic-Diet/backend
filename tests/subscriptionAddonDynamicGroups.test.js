const assert = require("assert");
const {
  buildAddonChoiceGroups,
  buildAddonChoicesCompatibilityMap,
} = require("../src/services/subscription/subscriptionAddonChoicesService");

function queryResult(rows) {
  return {
    sort() { return this; },
    lean() { return Promise.resolve(rows); },
  };
}

function fixture(planCount, { purchased = false, collision = false } = {}) {
  const base = 0x100;
  const categories = [];
  const products = [];
  const plans = [];
  const entitlements = [];
  const balances = [];

  for (let index = 0; index < planCount; index++) {
    const suffix = (base + index).toString(16).padStart(3, "0");
    const categoryId = `507f191e810c19729de86${suffix}`;
    const productId = `507f191e810c19729de87${suffix}`;
    const planId = `507f191e810c19729de88${suffix}`;
    const displayKey = collision && index < 2 ? "same_key" : `dashboard_group_${index + 1}`;
    categories.push({
      _id: categoryId,
      key: `source_${index + 1}`,
      isActive: true,
      isVisible: true,
      isAvailable: true,
      publishedAt: new Date(),
    });
    products.push({
      _id: productId,
      categoryId,
      key: `product_${index + 1}`,
      name: { ar: `منتج ${index + 1}`, en: `Product ${index + 1}` },
      description: { ar: "", en: "" },
      itemType: `internal_type_${index + 1}`,
      priceHalala: 1000 + index,
      currency: "SAR",
      isActive: true,
      isVisible: true,
      isAvailable: true,
      publishedAt: new Date(),
    });
    plans.push({
      _id: planId,
      kind: "plan",
      type: "subscription",
      billingMode: "per_day",
      category: displayKey,
      name: { ar: `خطة ${index + 1}`, en: `Plan ${index + 1}` },
      sortOrder: planCount - index,
      menuProductIds: [productId],
      isActive: true,
      isArchived: false,
    });
    if (purchased) {
      const allowanceCategory = index === 2 || index === 3 ? "shared_internal_bucket" : `bucket_${index + 1}`;
      entitlements.push({
        addonPlanId: planId,
        addonId: planId,
        addonPlanName: `Plan ${index + 1}`,
        addonPlanNameI18n: plans[index].name,
        displayKey,
        displayCategory: displayKey,
        sortOrder: plans[index].sortOrder,
        category: allowanceCategory,
        includedTotalQty: 7,
        maxPerDay: 1,
        unitPriceHalala: products[index].priceHalala,
        currency: "SAR",
        menuProductIds: [productId],
        menuProductsSnapshot: [{
          id: productId,
          key: products[index].key,
          name: products[index].name,
          nameI18n: products[index].name,
          category: displayKey,
          categoryKey: displayKey,
          itemType: products[index].itemType,
          priceHalala: products[index].priceHalala,
          currency: "SAR",
        }],
      });
      balances.push({
        _id: `507f191e810c19729de89${suffix}`,
        addonPlanId: planId,
        addonId: planId,
        category: allowanceCategory,
        includedTotalQty: 7,
        purchasedQty: 7,
        consumedQty: 0,
        remainingQty: 7,
        currency: "SAR",
      });
    }
  }

  const subscription = purchased ? {
    _id: "507f191e810c19729de89999",
    userId: "507f191e810c19729de89998",
    status: "active",
    addonSubscriptions: entitlements,
    addonBalance: balances,
  } : null;

  function matchesIds(rows, query) {
    if (!query || !query._id || !query._id.$in) return rows;
    const ids = new Set(query._id.$in.map(String));
    return rows.filter((row) => ids.has(String(row._id)));
  }

  return {
    subscription,
    categories,
    entitlements,
    plans,
    products,
    models: {
      AddonModel: {
        find(query) {
          let rows = matchesIds(plans, query);
          if (query.kind) rows = rows.filter((row) => row.kind === query.kind);
          if (query.isActive === true) rows = rows.filter((row) => row.isActive === true);
          if (query.isArchived && query.isArchived.$ne === true) rows = rows.filter((row) => row.isArchived !== true);
          return queryResult(rows);
        },
      },
      MenuProductModel: {
        find(query) { return queryResult(matchesIds(products, query)); },
      },
      MenuCategoryModel: {
        find(query) { return queryResult(matchesIds(categories, query)); },
      },
      SubscriptionModel: {
        findById() { return { lean: () => Promise.resolve(subscription) }; },
        find() { return queryResult(subscription ? [subscription] : []); },
      },
    },
  };
}

function productionGroupingFixture() {
  const current = fixture(2, { purchased: true });
  const [snackPlan, iceCreamPlan] = current.plans;
  const [snackProduct, iceCreamProduct] = current.products;
  const [snackCategory, iceCreamCategory] = current.categories;
  const [snackEntitlement, iceCreamEntitlement] = current.entitlements;

  snackPlan.category = "snack";
  snackPlan.name = { ar: "اشتراك السناك", en: "Snack Subscription" };
  snackPlan.menuCategoryKeys = [];
  snackCategory.key = "desserts";
  snackProduct.itemType = "dessert";

  iceCreamPlan.category = "snack";
  iceCreamPlan.displayKey = "ice_cream";
  iceCreamPlan.name = { ar: "ايس كريم", en: "ice cream" };
  iceCreamPlan.menuCategoryKeys = [];
  // Production catalogs may keep Ice Cream under a generic source category;
  // the unanimous product itemType is the more specific plan-owned identity.
  iceCreamCategory.key = "desserts";
  iceCreamProduct.itemType = "ice_cream";

  for (const entitlement of [snackEntitlement, iceCreamEntitlement]) {
    entitlement.category = "snack";
    entitlement.allowanceCategory = "snack";
    entitlement.entitlementCategory = "snack";
    entitlement.displayKey = "snack";
    entitlement.displayCategory = "snack";
    entitlement.menuCategoryKeys = ["snack"];
    entitlement.addonPlanName = "Wrong entitlement label";
    entitlement.addonPlanNameI18n = { ar: "تسمية استحقاق خاطئة", en: "Wrong entitlement label" };
    for (const snapshot of entitlement.menuProductsSnapshot) {
      snapshot.category = "snack";
      snapshot.categoryKey = "snack";
    }
  }

  const paidProduct = {
    _id: "507f191e810c19729de87fff",
    categoryId: iceCreamCategory._id,
    key: "ice_cream_paid_extra",
    name: { ar: "إضافة ايس كريم مدفوعة", en: "Paid Ice Cream Extra" },
    description: { ar: "", en: "" },
    itemType: "ice_cream",
    priceHalala: 1700,
    currency: "SAR",
    isActive: true,
    isVisible: true,
    isAvailable: true,
    publishedAt: new Date(),
  };
  current.products.push(paidProduct);
  iceCreamPlan.menuProductIds.push(paidProduct._id);

  return { ...current, paidProduct };
}

async function run() {
  for (const count of [2, 10]) {
    const current = fixture(count);
    const groups = await buildAddonChoiceGroups({ lang: "ar", models: current.models });
    assert.strictEqual(groups.length, count, `dashboard ${count}-plan fixture returns ${count} groups`);
    assert.deepStrictEqual(
      groups.map((group) => group.addonPlanId),
      [...current.plans].sort((left, right) => left.sortOrder - right.sortOrder).map((plan) => String(plan._id)),
      "groups follow dashboard sortOrder"
    );
    assert(groups.every((group) => group.label.startsWith("خطة ")), "Arabic labels come from dashboard plan names");
    assert(groups.every((group) => !group.label.startsWith("dashboard_group_")), "raw display keys are not Arabic labels");
    assert(groups.every((group) => group.choices[0].pricingMode === "paid_no_entitlement"));
  }

  const purchased = fixture(4, { purchased: true });
  purchased.plans[3].isActive = false;
  const purchasedGroups = await buildAddonChoiceGroups({
    lang: "ar",
    subscription: purchased.subscription,
    userId: purchased.subscription.userId,
    models: purchased.models,
  });
  assert.strictEqual(purchasedGroups.length, 4, "inactive purchased plans remain in the active-or-purchased union");
  assert.deepStrictEqual(
    new Set(purchasedGroups.map((group) => group.addonPlanId)),
    new Set(purchased.plans.map((plan) => String(plan._id)))
  );
  assert(purchasedGroups.every((group) => group.isPurchased === true));
  assert(purchasedGroups.every((group) => group.source === "subscription"));
  assert(purchasedGroups.every((group) => group.choices[0].pricingMode === "allowance_covered"));
  assert(purchasedGroups.every((group) => group.choices[0].coveredQty === 1));
  assert(purchasedGroups.every((group) => group.choices[0].paidQty === 0));
  assert(purchasedGroups.every((group) => group.choices[0].availableForNewSale === false));
  const sharedBucketGroups = purchasedGroups.filter((group) => group.allowanceCategory === "shared_internal_bucket");
  assert.strictEqual(sharedBucketGroups.length, 2);
  assert.notStrictEqual(sharedBucketGroups[0].addonPlanId, sharedBucketGroups[1].addonPlanId);
  assert.notStrictEqual(sharedBucketGroups[0].displayKey, sharedBucketGroups[1].displayKey);
  assert.notStrictEqual(sharedBucketGroups[0].choices[0].productId, sharedBucketGroups[1].choices[0].productId);

  const production = productionGroupingFixture();
  const productionGroups = await buildAddonChoiceGroups({
    lang: "ar",
    subscription: production.subscription,
    userId: production.subscription.userId,
    models: production.models,
  });
  assert.strictEqual(productionGroups.length, 2);
  const snackGroup = productionGroups.find((group) => group.displayKey === "snack");
  const iceCreamGroup = productionGroups.find((group) => group.displayKey === "ice_cream");
  assert(snackGroup, JSON.stringify(productionGroups));
  assert(iceCreamGroup, JSON.stringify(productionGroups));
  assert.strictEqual(snackGroup.addonPlanId, String(production.plans[0]._id));
  assert.strictEqual(snackGroup.groupId, String(production.plans[0]._id));
  assert.strictEqual(snackGroup.displayCategory, "snack");
  assert.strictEqual(snackGroup.category, "snack");
  assert.strictEqual(snackGroup.allowanceCategory, "snack");
  assert.strictEqual(iceCreamGroup.addonPlanId, String(production.plans[1]._id));
  assert.strictEqual(iceCreamGroup.groupId, String(production.plans[1]._id));
  assert.strictEqual(iceCreamGroup.displayCategory, "ice_cream");
  assert.strictEqual(iceCreamGroup.category, "ice_cream");
  assert.strictEqual(iceCreamGroup.allowanceCategory, "snack");
  assert.strictEqual(iceCreamGroup.entitlementCategory, "snack");
  assert.strictEqual(iceCreamGroup.label, "ايس كريم");
  assert.strictEqual(iceCreamGroup.labelText, "ايس كريم");
  assert.strictEqual(iceCreamGroup.labelAr, "ايس كريم");
  assert.strictEqual(iceCreamGroup.labelEn, "ice cream");
  assert(iceCreamGroup.choices.every((choice) => choice.category === "ice_cream"));
  assert(iceCreamGroup.choices.every((choice) => choice.displayCategory === "ice_cream"));
  assert(iceCreamGroup.choices.every((choice) => choice.allowanceCategory === "snack"));
  const includedIceCreamChoice = iceCreamGroup.choices.find((choice) => (
    choice.productId === String(production.products[1]._id)
  ));
  const paidIceCreamChoice = iceCreamGroup.choices.find((choice) => (
    choice.productId === String(production.paidProduct._id)
  ));
  assert.strictEqual(includedIceCreamChoice.pricingMode, "allowance_covered");
  assert.strictEqual(includedIceCreamChoice.coveredQty, 1);
  assert.strictEqual(includedIceCreamChoice.paidQty, 0);
  assert.strictEqual(paidIceCreamChoice.pricingMode, "paid_no_entitlement");
  assert.strictEqual(paidIceCreamChoice.coveredQty, 0);
  assert.strictEqual(paidIceCreamChoice.paidQty, 1);
  assert.strictEqual(
    snackGroup.choices.some((choice) => iceCreamGroup.choices.some((iceChoice) => iceChoice.productId === choice.productId)),
    false,
    "Snack and Ice Cream remain separate despite sharing the Snack allowance bucket"
  );

  const explicitIdentity = productionGroupingFixture();
  explicitIdentity.plans[1].displayKey = "frozen_treats";
  explicitIdentity.plans[1].displayCategory = "ignored_display_category";
  const explicitIdentityGroups = await buildAddonChoiceGroups({
    lang: "en",
    subscription: explicitIdentity.subscription,
    userId: explicitIdentity.subscription.userId,
    models: explicitIdentity.models,
  });
  const explicitIdentityGroup = explicitIdentityGroups.find((group) => (
    group.addonPlanId === String(explicitIdentity.plans[1]._id)
  ));
  assert.strictEqual(explicitIdentityGroup.displayKey, "frozen_treats");
  assert.strictEqual(explicitIdentityGroup.displayCategory, "frozen_treats");
  assert.strictEqual(explicitIdentityGroup.category, "frozen_treats");
  assert.strictEqual(explicitIdentityGroup.allowanceCategory, "snack");
  assert(explicitIdentityGroup.choices.every((choice) => choice.displayCategory === "frozen_treats"));

  const categoryPriority = productionGroupingFixture();
  delete categoryPriority.plans[1].displayKey;
  categoryPriority.plans[1].category = "dashboard_category";
  const categoryPriorityGroups = await buildAddonChoiceGroups({
    lang: "en",
    subscription: categoryPriority.subscription,
    userId: categoryPriority.subscription.userId,
    models: categoryPriority.models,
  });
  assert.strictEqual(
    categoryPriorityGroups.find((group) => group.addonPlanId === String(categoryPriority.plans[1]._id)).displayKey,
    "dashboard_category",
    "plan.category keeps priority over product metadata"
  );

  const productFallback = productionGroupingFixture();
  delete productFallback.plans[1].displayKey;
  delete productFallback.plans[1].category;
  const productFallbackGroups = await buildAddonChoiceGroups({
    lang: "en",
    subscription: productFallback.subscription,
    userId: productFallback.subscription.userId,
    models: productFallback.models,
  });
  assert.strictEqual(
    productFallbackGroups.find((group) => group.addonPlanId === String(productFallback.plans[1]._id)).displayKey,
    "ice_cream",
    "unanimous product itemType is used only after plan identity fields are absent"
  );

  const collision = fixture(2, { collision: true });
  const collisionGroups = await buildAddonChoiceGroups({ lang: "en", models: collision.models });
  const compatibility = buildAddonChoicesCompatibilityMap(collisionGroups);
  assert.strictEqual(collisionGroups.length, 2);
  assert.strictEqual(Object.keys(compatibility).length, 2, "legacy map does not overwrite colliding display keys");
  assert.deepStrictEqual(
    Object.keys(compatibility).sort(),
    collisionGroups.map((group) => `same_key:${group.addonPlanId}`).sort()
  );
  assert.deepStrictEqual(
    new Set(Object.values(compatibility).map((group) => group.addonPlanId)),
    new Set(collisionGroups.map((group) => group.addonPlanId))
  );
  const reversedCompatibility = buildAddonChoicesCompatibilityMap([...collisionGroups].reverse());
  assert.deepStrictEqual(Object.keys(reversedCompatibility).sort(), Object.keys(compatibility).sort());

  const missingPlan = fixture(1, { purchased: true });
  const missingPlanId = String(missingPlan.plans[0]._id);
  missingPlan.plans.splice(0, 1);
  const missingPlanGroups = await buildAddonChoiceGroups({
    lang: "en",
    subscription: missingPlan.subscription,
    userId: missingPlan.subscription.userId,
    models: missingPlan.models,
  });
  assert.strictEqual(missingPlanGroups.length, 1);
  assert.strictEqual(missingPlanGroups[0].displayKey, missingPlanId);
  assert.strictEqual(missingPlanGroups[0].displayCategory, missingPlanId);
  assert.strictEqual(missingPlanGroups[0].category, missingPlanId);
  assert.strictEqual(missingPlanGroups[0].allowanceCategory, "bucket_1");

  const dashboardDessert = fixture(2);
  dashboardDessert.plans[0].category = "snack";
  dashboardDessert.plans[0].name = { ar: "سناك", en: "Snack" };
  dashboardDessert.plans[1].category = "dessert";
  dashboardDessert.plans[1].name = { ar: "حلويات", en: "Dessert" };
  const dashboardDessertGroups = await buildAddonChoiceGroups({
    lang: "ar",
    models: dashboardDessert.models,
  });
  assert(dashboardDessertGroups.some((group) => group.displayKey === "dessert" && group.label === "حلويات"));
  const noDessert = fixture(2);
  const noDessertGroups = await buildAddonChoiceGroups({ lang: "ar", models: noDessert.models });
  assert(!noDessertGroups.some((group) => group.displayKey === "dessert"), "no hardcoded Dessert group is created");

  console.log("subscriptionAddonDynamicGroups tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
