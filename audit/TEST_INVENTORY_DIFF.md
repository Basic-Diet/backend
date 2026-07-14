# Test Inventory Diff

Generated: 2026-07-14 19:50 EEST. Source: repository test files, `scripts/test-runner-dispatcher.js --manifest-tsv`, `package.json`, CI workflow commands, and preserved 154-run logs in `audit/raw-test-output/`.

## Count Reconciliation

- Test files on disk: 155.
- Git-tracked test files: 153.
- Current `test:all` executable manifest: 153.
- Wrapper aliases excluded from direct execution: 2.
- Previous preserved 154-run executable count: 154.
- Current executable count: 153.

The 154-to-153 discrepancy is accounted for: the previous runner counted two wrapper aliases, `tests/dashboardAccountingContract.test.js` and `tests/dashboardAddonCrudContract.test.js`, as standalone executions. The current dispatcher excludes both wrappers, and the new dispatcher self-test `tests/testRunnerDispatcher.test.js` is included. Net: 154 - 2 + 1 = 153. The named missing executable from the 154-run inventory is `tests/dashboardAccountingContract.test.js`; it is intentionally excluded because it only requires `tests/dashboardAccountingDailyReport.test.js`. The second removed direct wrapper is `tests/dashboardAddonCrudContract.test.js`, which only requires `tests/dashboardAddonPlanCrudContract.test.js`.

Previous 154 entries no longer direct-run:

- tests/dashboardAccountingContract.test.js
- tests/dashboardAddonCrudContract.test.js

Current entries absent from preserved 154-run inventory:

- tests/testRunnerDispatcher.test.js

## Package And CI Coverage

- `npm run test:all`: executes the current dispatcher manifest.
- `npm run test:release-gates`: npm test && npm run test:security && npm run test:checkout-concurrency && npm run test:checkout && npm run test:orders && npm run test:subscriptions && npm run test:payment-init-logging && npm run test:builder-catalog-v2-contract.
- CI workflow also runs selected contract/add-on/mobile and commerce/security scripts; those commands are script-level gates, not the full dispatcher manifest.

## Inventory

| Test file | Git tracked | Framework | Expected runner | Included in test:all | Included in release gates | Previously discovered | Currently discovered | Reason for inclusion/exclusion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/accountDeletion.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/addonBootstrapAndReadModels.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/addonDashboardMobileParity.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/addonPricingMatrix.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/addonPublicContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/addon_and_payment_e2e.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/addon_balance_e2e.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/adminUserRegistrationAndReset.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/authPasswordBackendContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/bootstrapModuleResolution.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/bootstrapOrchestrator.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/branchPickupMealWalletSlotAppendPayment.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/branchPickupOperationalGuard.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/builderCatalogV2Contract.test.js | yes | Plain Node script | node | yes | yes: via npm run test:builder-catalog-v2-contract | yes | yes | executable test file |
| tests/canonicalAuthority.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/catalogAllowlistParity.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/catalogItemArchitecture.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/catalogItemLinkMigration.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/catalogValidatorConsistency.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/checkout.integration.test.js | yes | Plain Node script | node | yes | yes: via npm run test:checkout | yes | yes | executable test file |
| tests/controllers/adminController.concurrency.test.js | yes | Jest | jest | yes | no | yes | yes | executable test file |
| tests/corsPreflight.test.js | yes | Plain Node script | node | yes | yes: via npm run test:security | yes | yes | executable test file |
| tests/courierDeliveryContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardAccountingContract.test.js | yes | Suite wrapper | wrapper | no | no | yes | no | suite wrapper alias; underlying suite is executed elsewhere to avoid duplicate fixture mutation |
| tests/dashboardAccountingDailyReport.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardAddonCrudContract.test.js | yes | Suite wrapper | wrapper | no | no | yes | no | suite wrapper alias; underlying suite is executed elsewhere to avoid duplicate fixture mutation |
| tests/dashboardAddonPlanCrudContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardAdminEndpoints.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardCashSubscriptionContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardContracts.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardKitchenArabicHydration.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardKitchenQueueActions.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardManualDeductionAddons.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardManualDeductionAndOrderPickup.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMealBuilderComposer.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMealBuilderDefaultTemplate.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMealBuilderFullCycle.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMealBuilderHydratedDraft.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMealBuilderPickers.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMealBuilderPublishValidation.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMealBuilderRegression.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMenuIdentity.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMenuProductCenteredContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardMenuRolePolicy.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardPremiumUpgrades.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardPromoCodes.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardSubscriptionMenuReadiness.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardSubscriptionPlannerConfig.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dashboardSubscriptionsContractPhase1.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/db_isolation.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/defaultAccountsBootstrap.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/deliveryMapperAllowedActions.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/deliverySelectionCutoffContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/dynamicCatalogPremium.test.js | no | Plain Node script | node | yes | no | yes | yes | executable test file; untracked in current worktree |
| tests/firstDayFulfillmentOverride.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/fulfillmentContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/fulfillmentLifecyclePostmanSimulation.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/fulfillmentStatusEndpoint.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/guestAccess.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/homeDeliveryAndBranchPickupRules.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/homeDeliveryPostmanContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/indexDefinitions.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/kitchen_operations_mapper.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/ksaBusinessDateContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/manual_verify_allow_applied_reconciliation.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/mealBuilderDashboardMobileParity.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/mealPlanner.integration.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/mealPlannerCanonicalContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/mealPlannerCanonicalV3Write.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/mealPlannerFullMealProductContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/mealPlannerPaymentContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/meal_planner_types.test.js | yes | Plain Node script | node | yes | yes: via npm run test | yes | yes | executable test file |
| tests/menuDashboardMobileParity.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/menuIdentityMapping.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/menuIdentitySuggestions.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/menuIdentitySuggestionsApproval.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/mobileApiContracts.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/mobileAuthPasswordRefresh.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/moyasar_retry.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/oneTimeAddonVerifyAlias.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/oneTimeMenuCatalog.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/oneTimeOrderDeliveryGate.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/oneTimeOrderFullFlow.test.js | yes | Plain Node script | node | yes | yes: via npm run test:orders | yes | yes | executable test file |
| tests/oneTimeOrderOps.test.js | yes | Plain Node script | node | yes | yes: via npm run test:orders | yes | yes | executable test file |
| tests/oneTimeOrderPremiumUpgradeIsolation.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/oneTimeOrders.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/operationsDeliveryFlowContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/operationsHistoricalMutationContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/operationsTransactionRetryContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/opsPayloadService.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/opsSearchService.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/orderDeliveryLifecycleFixes.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/orderPaymentIdempotency.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/orderQueryParity.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/pastSubscriptionDaySettlement.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/paymentInitLogging.test.js | yes | Plain Node script | node | yes | yes: via npm run test:payment-init-logging | yes | yes | executable test file |
| tests/premiumLargeSaladEligibilityPolicy.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/premiumLargeSaladV3Allowlist.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/premium_extra_day_update_guard.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/productCardSizeContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/publicApiSurface.test.js | yes | Plain Node script | node | yes | yes: via npm run test:security | yes | yes | executable test file |
| tests/publicPolicyPages.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/repro_meal_balance.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/repro_restaurant_closed.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/securityHardening.test.js | yes | Plain Node script | node | yes | yes: via npm run test:security | yes | yes | executable test file |
| tests/seedCatalogCanonicalV3Contract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/seedCatalogProteinCanonical.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/seedCatalogRebuild.integration.test.js | yes | Jest | jest | yes | no | yes | yes | executable test file |
| tests/seedMealBuilderConfig.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/seedSubscriptionPlans.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/services/dashboard/opsTransitionService.addonRollback.test.js | yes | Jest | jest | yes | no | yes | yes | executable test file |
| tests/services/subscription/subscriptionCancellationService.concurrency.test.js | yes | Jest | jest | yes | no | yes | yes | executable test file |
| tests/smoke/integrity.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionAddonBalanceModel.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionAddonCreditAllocation.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionAuditDashboard.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionBalanceConcurrency.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionBalancePolicy.test.js | yes | Plain Node script | node | yes | yes: via npm run test:subscriptions | yes | yes | executable test file |
| tests/subscriptionCheckoutHardening.test.js | yes | Plain Node script | node | yes | yes: via npm run test:security | yes | yes | executable test file |
| tests/subscriptionCheckoutInvoiceConcurrency.test.js | yes | Plain Node script | node | yes | yes: via npm run test:checkout-concurrency | yes | yes | executable test file |
| tests/subscriptionDateLockPermissionsHardening.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionDayModificationPolicy.test.js | yes | Plain Node script | node | yes | yes: via npm run test:subscriptions | yes | yes | executable test file |
| tests/subscriptionFulfillmentConcurrency.test.js | yes | Plain Node script | node | yes | yes: via npm run test:subscriptions | yes | yes | executable test file |
| tests/subscriptionFulfillmentPolicy.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionMealBuilderContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionMealBuilderPlannerCatalogCompile.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionMealBuilderValidation.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionMealPlannerCanonicalMealBuilder.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPickupOverview.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPickupRequestBalanceService.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPickupRequestClientService.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPickupRequestOps.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPickupRequestRoutes.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPickupRequestSettlement.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPlannerDashboardToFlutter.e2e.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPlannerGlobalMealBalance.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPlannerPaymentLifecycle.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPlannerStaleCatalog.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPremiumAddonPricingSafety.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPremiumUpgradeLimit.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionPublishGap.test.js | yes | Mocha | mocha | yes | no | yes | yes | executable test file |
| tests/subscriptionSelectionPolicies.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionTimelinePerformance.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscriptionTimelinePlanningContract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscription_addon_choices.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscription_addon_selection_contract.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/subscription_addon_selection_readback.integration.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/testRunnerDispatcher.test.js | no | Plain Node script | node | yes | no | no | yes | executable test file; untracked in current worktree; absent from prior 154-run inventory |
| tests/unified_day_payment_verify.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/vatInclusivePricing.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/vatInclusiveResponseNaming.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/vatSystem.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/verify_menu_fixes.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
| tests/webhookSecurity.test.js | yes | Plain Node script | node | yes | yes: via npm run test:security | yes | yes | executable test file |
| tests/weeklyMenuDashboard.test.js | yes | Plain Node script | node | yes | no | yes | yes | executable test file |
