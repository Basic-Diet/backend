# Flaky Test Matrix

Generated: 2026-07-14 19:50 EEST. Command for each run: `USE_MONGODB_MEMORY_REPLSET=true npm run test:all`. Each run started a fresh MongoMemory replica set and the dispatcher derived one stable database name per Mongo-backed test file.

## Run Summaries

| Run | Generated at | Discovered | Passed | Failed | Timed out | Skipped | Exit code |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Tue Jul 14 19:25:12 EEST 2026 | 153 | 107 | 46 | 0 | 0 | 1 |
| 2 | Tue Jul 14 19:31:21 EEST 2026 | 153 | 109 | 44 | 0 | 0 | 1 |
| 3 | Tue Jul 14 19:38:40 EEST 2026 | 153 | 109 | 44 | 0 | 0 | 1 |
| 4 | Tue Jul 14 19:45:02 EEST 2026 | 153 | 109 | 44 | 0 | 0 | 1 |
| 5 | Tue Jul 14 19:49:58 EEST 2026 | 153 | 109 | 44 | 0 | 0 | 1 |

## Classification Summary

- Failed in at least one run: 46.
- Deterministic failures: 43.
- Intermittent failures: 3.
- Order-dependent failures: none proven; execution order was identical in all five runs.
- Resource-dependent failures: likely for catalog-change retry and Mongoose buffering cases, but not proven without focused instrumentation.
- Environment-dependent failures: none proven; all five used fresh memory replica-set state.

## Failed-Test Matrix

| Test file | Runs 1-5 | Classification | Database name(s) | Representative error/message | Passed in another run |
| --- | --- | --- | --- | --- | --- |
| tests/addonBootstrapAndReadModels.test.js | FFFFF | deterministic failure | bd145_4b626fe8_test | Expected seeded subscription plan count: 3 | no |
| tests/adminUserRegistrationAndReset.test.js | FFFFF | deterministic failure | bd145_a70e5e0e_test | FAIL 1. Admin creates user successfully | no |
| tests/authPasswordBackendContract.test.js | FFFFF | deterministic failure | bd145_95646648_test | FAIL 12. Admin can reset customer password | no |
| tests/branchPickupOperationalGuard.test.js | FFFFF | deterministic failure | bd145_8c7d9f79_test | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | no |
| tests/controllers/adminController.concurrency.test.js | FFFFF | deterministic failure | bd145_58399238_test | code: 'CONFLICT', | no |
| tests/courierDeliveryContract.test.js | FFFFF | deterministic failure | bd145_2350806a_test | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | no |
| tests/dashboardAdminEndpoints.test.js | FFFFF | deterministic failure | bd145_c87cb665_test | {"error":"Caused by :: Unable to write to collection 'bd145_c87cb665_test.addonplanprices' due to catalog changes; please retry the operation :: Please retry your operation or multi-document transaction.","level":"error" | no |
| tests/dashboardCashSubscriptionContract.test.js | FPPPP | intermittent failure | bd145_3e3edf9f_test | Error: Plan not found | yes |
| tests/dashboardMealBuilderFullCycle.test.js | FFFFF | deterministic failure | bd145_4edd550d_test | AssertionError [ERR_ASSERTION]: {"status":"error","ready":false,"errors":[{"level":"error","code":"MEAL_BUILDER_PREMIUM_MEAL_REQUIRES_PREMIUM_PROTEIN","message":"Premium meal builder section requires premium protein opti | no |
| tests/dashboardMealBuilderHydratedDraft.test.js | FFFFF | deterministic failure | bd145_a5cabd42_test | AssertionError [ERR_ASSERTION]: premium hydrates beef_steak | no |
| tests/dashboardMealBuilderPickers.test.js | FFFFF | deterministic failure | bd145_654aade9_test | MealBuilderController error: MealBuilderError: Unsupported Meal Builder picker section | no |
| tests/dashboardPremiumUpgrades.test.js | FFFFF | deterministic failure | bd145_05e4c140_test | Expected seeded subscription plan count: 3 | no |
| tests/dashboardSubscriptionPlannerConfig.test.js | FFFFF | deterministic failure | bd145_1875bbd1_test | Expected seeded subscription plan count: 3 | no |
| tests/dashboardSubscriptionsContractPhase1.test.js | FFFFF | deterministic failure | bd145_9b7182d9_test | Error: startDate must be today or a future date | no |
| tests/fulfillmentLifecyclePostmanSimulation.test.js | FFFFF | deterministic failure | bd145_225c9892_test | AssertionError [ERR_ASSERTION]: {"ok":false,"error":{"code":"INVALID_TRANSITION","message":"Action start_preparation is not allowed in current state"}} | no |
| tests/guestAccess.test.js | FFFFF | deterministic failure | bd145_06d96c0c_test | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | no |
| tests/homeDeliveryAndBranchPickupRules.test.js | FFFFF | deterministic failure | bd145_3f77538f_test | AssertionError [ERR_ASSERTION]: {"ok":false,"error":{"code":"INVALID_TRANSITION","message":"Action dispatch is not allowed in current state"}} | no |
| tests/homeDeliveryPostmanContract.test.js | FFFFF | deterministic failure | bd145_65a949f0_test | AssertionError [ERR_ASSERTION]: {"ok":false,"error":{"code":"INVALID_TRANSITION","message":"Action dispatch is not allowed in current state"}} | no |
| tests/manual_verify_allow_applied_reconciliation.test.js | FFFFF | deterministic failure | bd145_f2c5d137_test | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | no |
| tests/mealPlanner.integration.test.js | FFFFF | deterministic failure | bd145_c6f84dce_test |  | no |
| tests/mealPlannerCanonicalContract.test.js | FFFFF | deterministic failure | bd145_91ccdb60_test | Assertion failed: normal response hides plannerCatalog. Expected undefined, got [object Object] | no |
| tests/mealPlannerCanonicalV3Write.test.js | FFFFF | deterministic failure | bd145_2c64dda2_test | Expected: | no |
| tests/mealPlannerPaymentContract.test.js | FFFFF | deterministic failure | bd145_cac2e7e9_test | Assertion failed: Unified premium large salad save status. Expected 402, got 422 | no |
| tests/oneTimeAddonVerifyAlias.test.js | FFFFP | intermittent failure | bd145_f717a549_test | {"date":"2026-07-19","error":"Caused by :: Unable to write to collection 'bd145_f717a549_test.payments' due to catalog changes; please retry the operation :: Please retry your operation or multi-document transaction.","l | yes |
| tests/oneTimeMenuCatalog.test.js | FFFFF | deterministic failure | bd145_47c2e3e5_test | TypeError: Cannot read properties of undefined (reading 'extraPriceHalala') | no |
| tests/oneTimeOrderFullFlow.test.js | FFFFF | deterministic failure | bd145_d197f5b5_test | AssertionError [ERR_ASSERTION]: prepare: expected 200, got 409 {"ok":false,"status":false,"message":"Historical operational records cannot be modified","messageAr":"لا يمكن تعديل سجلات تشغيلية تخص تاريخا سابقا","error":{ | no |
| tests/oneTimeOrderPremiumUpgradeIsolation.test.js | FFFFF | deterministic failure | bd145_655a9523_test | Expected seeded subscription plan count: 3 | no |
| tests/oneTimeOrders.test.js | FFFFF | deterministic failure | bd145_e87577f6_test | AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value: | no |
| tests/operationsHistoricalMutationContract.test.js | FFFFF | deterministic failure | bd145_0099cfc9_test | AssertionError [ERR_ASSERTION]: courier dispatch past day: expected 409, got 403 {"ok":false,"error":{"code":"FORBIDDEN","message":"Insufficient dashboard permissions"}} | no |
| tests/orderDeliveryLifecycleFixes.test.js | FFFFF | deterministic failure | bd145_bd6203ee_test | AssertionError [ERR_ASSERTION]: delivery dispatch: expected 200, got 403 {"ok":false,"error":{"code":"FORBIDDEN","message":"Insufficient dashboard permissions"}} | no |
| tests/pastSubscriptionDaySettlement.test.js | FPPPF | intermittent failure | bd145_b13dd65c_test | MongoServerError: Unable to acquire IX lock on '{9211180816276608629: Collection, 2293651788635526773, bd145_b13dd65c_test.subscriptiondays}' within 5ms. opId: 18817, op: conn1676, connId: 1676. | yes |
| tests/premium_extra_day_update_guard.test.js | FFFFF | deterministic failure | bd145_8e980041_test | MongooseError: Connection operation buffering timed out after 10000ms | no |
| tests/seedCatalogCanonicalV3Contract.test.js | FFFFF | deterministic failure | bd145_b660adac_test | Expected seeded subscription plan count: 3 | no |
| tests/seedCatalogRebuild.integration.test.js | FFFFF | deterministic failure | bd145_4d650c51_test | Expected seeded subscription plan count: 3 | no |
| tests/seedMealBuilderConfig.test.js | FFFFF | deterministic failure | bd145_acd16045_test | Error: Generated Meal Builder config is not publishable: MEAL_BUILDER_PREMIUM_LARGE_SALAD_INVALID_GROUP: premium_large_salad selected groups must exist: leafy_greens; MEAL_BUILDER_PREMIUM_LARGE_SALAD_INVALID_GROUP: premi | no |
| tests/smoke/integrity.test.js | FFFFF | deterministic failure | bd145_b81bbb98_test | FAIL: Integrity smoke tests failed: viable plan present in catalog: expected true, got false | no |
| tests/subscriptionAddonBalanceModel.test.js | FFFFF | deterministic failure | bd145_4f1eb4ff_test | AssertionError [ERR_ASSERTION]: expected 2 total juices from fallback | no |
| tests/subscriptionFulfillmentPolicy.test.js | FFFFF | deterministic failure | bd145_32dd5ee8_test | Error: INVALID_STATE_TRANSITION | no |
| tests/subscriptionMealBuilderContract.test.js | FFFFF | deterministic failure | bd145_43f65c5f_test | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | no |
| tests/subscriptionPickupRequestClientService.test.js | FFFFF | deterministic failure | bd145_3550603c_test | MongoServerError: Caused by :: Unable to write to collection 'bd145_3550603c_test.subscriptionpickuprequests' due to catalog changes; please retry the operation :: Please retry your operation or multi-document transactio | no |
| tests/subscriptionPickupRequestOps.test.js | FFFFF | deterministic failure | bd145_f8773c5c_test | AssertionError [ERR_ASSERTION]: {"ok":false,"error":{"code":"INVALID_TRANSITION","message":"Action prepare is not allowed in current state"}} | no |
| tests/subscriptionPickupRequestRoutes.test.js | FFFFF | deterministic failure | bd145_3e778ddc_test | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | no |
| tests/subscriptionPlannerDashboardToFlutter.e2e.test.js | FFFFF | deterministic failure | bd145_10e66553_test | AssertionError [ERR_ASSERTION]: flutter planner payload does not use builderCatalogV2 | no |
| tests/subscription_addon_selection_readback.integration.test.js | FFFFF | deterministic failure | bd145_138b56e3_test | AssertionError [ERR_ASSERTION]: validate source | no |
| tests/unified_day_payment_verify.test.js | FFFFF | deterministic failure | bd145_aaaa8703_test | AssertionError [ERR_ASSERTION]: {"ok":false,"status":422,"code":"SUBSCRIPTION_NOT_ACTIVE","message":"Subscription not active"} | no |
| tests/vatSystem.test.js | FFFFF | deterministic failure | bd145_8f371df3_test | Test failed: Error: Order must include at least one item | no |

## Execution Order

Execution order was stable and dispatcher-sorted in every run. See `scripts/test-runner-dispatcher.js --manifest-tsv` and the preserved full logs `audit/raw-test-output/test-all-20260714-flaky-run*.log`.
