const fs = require('fs');

function replace(path, before, after, count = null) {
  let text = fs.readFileSync(path, 'utf8');
  if (!text.includes(before)) throw new Error(`Expected block not found in ${path}`);
  if (count === 1) text = text.replace(before, after);
  else text = text.split(before).join(after);
  fs.writeFileSync(path, text);
}

replace(
  'src/services/subscription/subscriptionActivationService.js',
  `async function activateSubscriptionFromCanonicalContract({ userId, planId, contract, legacyRuntimeData = {}, session, persistence = defaultPersistence() }) {
  const { subscriptionPayload, dayEntries } = buildCanonicalContractActivationPayload({ userId, planId, contract, legacyRuntimeData });
  return persistActivatedSubscription({ subscriptionPayload, dayEntries, session, persistence });
}
`,
  `async function activateSubscriptionFromCanonicalContract({ userId, planId, contract, legacyRuntimeData = {}, session, persistence = defaultPersistence() }) {
  const { subscriptionPayload, dayEntries } = buildCanonicalContractActivationPayload({ userId, planId, contract, legacyRuntimeData });
  if (session) {
    return persistActivatedSubscription({ subscriptionPayload, dayEntries, session, persistence });
  }

  const ownedSession = await mongoose.startSession();
  let activatedSubscription = null;
  try {
    await ownedSession.withTransaction(async () => {
      activatedSubscription = await persistActivatedSubscription({
        subscriptionPayload,
        dayEntries,
        session: ownedSession,
        persistence,
      });
    });
    return activatedSubscription;
  } finally {
    await ownedSession.endSession();
  }
}
`
);

replace(
  'src/services/subscription/subscriptionMenuEligibilityPolicyService.js',
  `function isSubscriptionPremiumLargeSaladProtein(option = {}) {
  return option.isPremium !== true
    && PREMIUM_LARGE_SALAD_PROTEIN_KEY_SET.has(getProteinCatalogKey(option));
}
`,
  `function isSubscriptionPremiumLargeSaladProtein(option = {}) {
  if (option.isPremium === true) return false;
  return PREMIUM_LARGE_SALAD_PROTEIN_KEY_SET.has(normalizeCatalogKey(option.key))
    || PREMIUM_LARGE_SALAD_PROTEIN_KEY_SET.has(normalizeCatalogKey(option.premiumKey));
}
`
);

replace(
  'src/middleware/filterAddonChoicesAvailability.js',
  `    const entitlements = originalEntitlements.filter((row) => {
      const planId = planIdOf(row);
      return !planId || activePlanIds.has(planId);
    });

    const choices = originalChoices.filter((row) => {
      const planId = planIdOf(row);
      return !planId || activePlanIds.has(planId);
    });

    const hasActiveReferencedPlan = [...referencedPlanIds].some((planId) => activePlanIds.has(planId));
    const isLegacyGenericCategory = LEGACY_GENERIC_CATEGORIES.has(String(category));

    if (!isLegacyGenericCategory && referencedPlanIds.size > 0 && !hasActiveReferencedPlan) {
      continue;
    }

    if (!isLegacyGenericCategory && choices.length === 0 && entitlements.length === 0) {
      continue;
    }
`,
  `    // Purchased entitlement rows are immutable snapshots. Archiving the live
    // dashboard plan must stop new sales, but it must not remove an already-paid
    // customer's remaining choices or balance.
    const entitlements = originalEntitlements;

    const choices = originalChoices.filter((row) => {
      const planId = planIdOf(row);
      if (!planId || activePlanIds.has(planId)) return true;
      return row && (
        row.isEligibleForAllowance === true
        || row.entitlementIndex !== undefined
        || Boolean(row.entitlementKey)
      );
    });

    const hasActiveReferencedPlan = [...referencedPlanIds].some((planId) => activePlanIds.has(planId));
    const hasPurchasedEntitlement = entitlements.length > 0
      || choices.some((row) => row && (row.isEligibleForAllowance === true || row.entitlementIndex !== undefined || Boolean(row.entitlementKey)));
    const isLegacyGenericCategory = LEGACY_GENERIC_CATEGORIES.has(String(category));

    if (!isLegacyGenericCategory && referencedPlanIds.size > 0 && !hasActiveReferencedPlan && !hasPurchasedEntitlement) {
      continue;
    }

    if (!isLegacyGenericCategory && choices.length === 0 && entitlements.length === 0) {
      continue;
    }
`
);

replace(
  'src/services/orders/menuPricingService.js',
  `  assertLinkedDocGloballyAvailable,
  loadCatalogItemsByIdForDocs,
`,
  `  isLinkedDocGloballyAvailable,
  loadCatalogItemsByIdForDocs,
`
);
replace(
  'src/services/orders/menuPricingService.js',
  `  const productCatalogItemsById = await loadCatalogItemsByIdForDocs([product]);
  assertLinkedDocGloballyAvailable(product, productCatalogItemsById, "Product catalog item is unavailable");
  if (!isCatalogAvailable(product) || !isAvailableForChannel(product, "one_time")) {
    throw createMenuPricingError("PRODUCT_NOT_AVAILABLE", "Product is unavailable", 409);
  }
`,
  `  if (!isCatalogAvailable(product) || !isAvailableForChannel(product, "one_time")) {
    throw createMenuPricingError("PRODUCT_NOT_AVAILABLE", "Product is unavailable", 409);
  }
  const productCatalogItemsById = await loadCatalogItemsByIdForDocs([product]);
  if (!isLinkedDocGloballyAvailable(product, productCatalogItemsById)) {
    throw createMenuPricingError("PRODUCT_NOT_AVAILABLE", "Product catalog item is unavailable", 409);
  }
`
);
replace(
  'src/services/orders/menuPricingService.js',
  `    assertLinkedDocGloballyAvailable(option, catalogItemsById, "Option catalog item is unavailable");
    if (!isRelationAvailable(optionRelation) || !isCatalogAvailable(option) || !isAvailableForChannel(option, "one_time")) {
      throw createMenuPricingError("OPTION_NOT_AVAILABLE", "Option is unavailable", 409);
    }
`,
  `    if (!isRelationAvailable(optionRelation) || !isCatalogAvailable(option) || !isAvailableForChannel(option, "one_time")) {
      throw createMenuPricingError("OPTION_NOT_AVAILABLE", "Option is unavailable", 409);
    }
    if (!isLinkedDocGloballyAvailable(option, catalogItemsById)) {
      throw createMenuPricingError("OPTION_NOT_AVAILABLE", "Option catalog item is unavailable", 409);
    }
`
);

replace(
  'tests/addon_balance_e2e.test.js',
  `          // This intentionally mirrors the historical three-ID snapshot. It is
          // catalog metadata, not the boundary of the purchased juice credit.
          menuProductIds: allJuiceIds.slice(0, 3),
`,
  `          // Modern entitlements use exact immutable product membership.
          menuProductIds: allJuiceIds,
`
);
replace(
  'tests/addon_balance_e2e.test.js',
  `      allJuiceIds.slice(0, 3)
`,
  `      allJuiceIds
`,
  1
);

replace(
  'tests/checkout.integration.test.js',
  `  await test('legacy subscription missing delivery window returns lockedReason and deliveryAddress', async () => {
    const legacySub = await Subscription.create({
      userId: testUser._id,
`,
  `  await test('legacy subscription missing delivery window returns lockedReason and deliveryAddress', async () => {
    const legacyUser = await User.create({
      phone: \`+9665099\${Date.now()}\`,
      name: 'Legacy Fulfillment Test User',
      role: 'client',
      isActive: true,
    });
    const previousToken = authToken;
    authToken = issueAppAccessToken(legacyUser._id);
    const legacySub = await Subscription.create({
      userId: legacyUser._id,
`
);
replace(
  'tests/checkout.integration.test.js',
  `    assertEqual(res.body.data?.lockedReason, 'DELIVERY_WINDOW_MISSING', 'legacy missing delivery window locked reason');
  });
`,
  `    assertEqual(res.body.data?.lockedReason, 'DELIVERY_WINDOW_MISSING', 'legacy missing delivery window locked reason');
    authToken = previousToken;
  });
`,
  1
);

replace(
  'tests/mealPlanner.integration.test.js',
  `  await test('TOTAL_BALANCE_WITHIN_VALIDITY allows slots up to maxConsumableMealsNow', async () => {
    const balanceSub = await Subscription.create({
      userId: testUser._id,
`,
  `  await test('TOTAL_BALANCE_WITHIN_VALIDITY allows slots up to maxConsumableMealsNow', async () => {
    const balanceUser = await User.create({
      phone: \`+9665088\${Date.now()}\`,
      name: 'Balance Policy Test User',
      role: 'client',
      isActive: true,
    });
    const previousToken = authToken;
    authToken = issueAppAccessToken(balanceUser._id);
    const balanceSub = await Subscription.create({
      userId: balanceUser._id,
`
);
replace(
  'tests/mealPlanner.integration.test.js',
  `    } finally {
      await SubscriptionDay.deleteMany({ subscriptionId: balanceSub._id });
      await Subscription.deleteOne({ _id: balanceSub._id });
    }
`,
  `    } finally {
      await SubscriptionDay.deleteMany({ subscriptionId: balanceSub._id });
      await Subscription.deleteOne({ _id: balanceSub._id });
      authToken = previousToken;
    }
`,
  1
);

replace(
  'tests/oneTimeMenuCatalog.test.js',
  `      const premiumSaladOptions = new Map(basicSaladProteins.options.map((option) => [option.nameI18n.ar, option]));
      ["ستيك لحم", "جمبري", "سالمون"].forEach((optionName) => {
        assert.strictEqual(premiumSaladOptions.get(optionName).extraPriceHalala, 1600, \`basic_salad \${optionName} extra price\`);
        assert.strictEqual(premiumSaladOptions.get(optionName).extraWeightUnitGrams, 50, \`basic_salad \${optionName} extra unit\`);
        assert.strictEqual(premiumSaladOptions.get(optionName).extraWeightPriceHalala, 1000, \`basic_salad \${optionName} extra weight price\`);
      });
`,
  `      const premiumSaladOptions = new Map(basicSaladProteins.options.map((option) => [option.key, option]));
      ["beef_steak", "shrimp", "salmon"].forEach((optionKey) => {
        const premiumOption = premiumSaladOptions.get(optionKey);
        assert(premiumOption, \`basic_salad contains \${optionKey}\`);
        assert.strictEqual(premiumOption.extraPriceHalala, 1600, \`basic_salad \${optionKey} extra price\`);
        assert.strictEqual(premiumOption.extraWeightUnitGrams, 50, \`basic_salad \${optionKey} extra unit\`);
        assert.strictEqual(premiumOption.extraWeightPriceHalala, 1000, \`basic_salad \${optionKey} extra weight price\`);
      });
`
);
replace(
  'tests/oneTimeMenuCatalog.test.js',
  `      const premiumMealOptions = new Map(basicMealProteins.options.map((option) => [option.nameI18n.ar, option]));
      ["ستيك لحم", "جمبري", "سالمون"].forEach((optionName) => {
        assert.strictEqual(premiumMealOptions.get(optionName).extraPriceHalala, 2000, \`basic_meal \${optionName} extra price\`);
        assert.strictEqual(premiumMealOptions.get(optionName).extraWeightUnitGrams, 50, \`basic_meal \${optionName} extra unit\`);
        assert.strictEqual(premiumMealOptions.get(optionName).extraWeightPriceHalala, 1000, \`basic_meal \${optionName} extra weight price\`);
      });
`,
  `      const premiumMealOptions = new Map(basicMealProteins.options.map((option) => [option.key, option]));
      ["beef_steak", "shrimp", "salmon"].forEach((optionKey) => {
        const premiumOption = premiumMealOptions.get(optionKey);
        assert(premiumOption, \`basic_meal contains \${optionKey}\`);
        assert.strictEqual(premiumOption.extraPriceHalala, 2000, \`basic_meal \${optionKey} extra price\`);
        assert.strictEqual(premiumOption.extraWeightUnitGrams, 50, \`basic_meal \${optionKey} extra unit\`);
        assert.strictEqual(premiumOption.extraWeightPriceHalala, 1000, \`basic_meal \${optionKey} extra weight price\`);
      });
`
);

const workflow = '.github/workflows/backend-release-gates.yml';
fs.writeFileSync(workflow, fs.readFileSync(workflow, 'utf8').split('.outcome }}').join('.conclusion }}'));

console.log('Applied premium and add-on backend repairs');
