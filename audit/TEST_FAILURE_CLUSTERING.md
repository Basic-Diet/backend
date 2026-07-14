# Test Failure Clustering

Latest diagnostic set: five runs of `USE_MONGODB_MEMORY_REPLSET=true npm run test:all` on July 14, 2026 between 19:19 and 19:50 EEST.

Results:

| Run | Discovered | Passed | Failed | Timed out | Skipped |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 153 | 107 | 46 | 0 | 0 |
| 2 | 153 | 109 | 44 | 0 | 0 |
| 3 | 153 | 109 | 44 | 0 | 0 |
| 4 | 153 | 109 | 44 | 0 | 0 |
| 5 | 153 | 109 | 44 | 0 | 0 |

## Cluster A - Meal Builder And Planner Fixtures

Classification: invalid/incomplete fixtures plus outdated planner payload expectations.

Deterministic failures:

- `tests/dashboardMealBuilderFullCycle.test.js`
- `tests/dashboardMealBuilderHydratedDraft.test.js`
- `tests/dashboardMealBuilderPickers.test.js`
- `tests/dashboardPremiumUpgrades.test.js`
- `tests/dashboardSubscriptionPlannerConfig.test.js`
- `tests/mealPlanner.integration.test.js`
- `tests/mealPlannerCanonicalContract.test.js`
- `tests/mealPlannerCanonicalV3Write.test.js`
- `tests/mealPlannerPaymentContract.test.js`
- `tests/seedCatalogCanonicalV3Contract.test.js`
- `tests/seedCatalogRebuild.integration.test.js`
- `tests/seedMealBuilderConfig.test.js`
- `tests/smoke/integrity.test.js`
- `tests/subscriptionMealBuilderContract.test.js`
- `tests/subscriptionPlannerDashboardToFlutter.e2e.test.js`
- `tests/unified_day_payment_verify.test.js`

Representative evidence:

- Missing/invalid premium salad config: `MEAL_BUILDER_PREMIUM_LARGE_SALAD_MISSING`, `MEAL_BUILDER_PREMIUM_LARGE_SALAD_INVALID_GROUP`.
- Missing premium config/read model: `Premium upgrade is not configured or available: beef_steak`.
- Invalid option relations: `MEAL_BUILDER_PRODUCT_OPTION_RELATION_UNAVAILABLE`, inactive option relation code.
- Planner contract drift: normal response now includes `plannerCatalog`; Flutter payload assertion expects no `builderCatalogV2`.
- Test data drift: viable plan absent in smoke catalog, fee override assertion mismatch, start date in the past.

Do not restore static fallbacks. Next safe action is shared DB-backed fixture builders for valid builder catalog, premium config, visible/active menu relations, and current business dates.

## Cluster B - Authentication Contracts

Classification: outdated/incomplete contract expectations; security-sensitive.

Deterministic failures:

- `tests/adminUserRegistrationAndReset.test.js`
- `tests/authPasswordBackendContract.test.js`
- `tests/controllers/adminController.concurrency.test.js`

Representative evidence:

- Admin create-user test expects `201` without a temporary password; runtime returns `400 INVALID` requiring a temporary password.
- Follow-on login expects `403 PENDING_ACTIVATION`, but invalid credentials return `401 INVALID_CREDENTIALS` because the user was not created.
- Admin controller concurrency sees `CONFLICT`, which may be correct idempotency/uniqueness protection.

Do not expose generated or temporary passwords merely to satisfy old tests. Contract decision `AUTH-RESET-001` is required before changing any expectation.

## Cluster C - Order And Delivery Contracts

Classification: mostly outdated contract expectations and invalid test state transitions; some fixture dates are stale.

Deterministic failures:

- `tests/courierDeliveryContract.test.js`
- `tests/dashboardAdminEndpoints.test.js`
- `tests/fulfillmentLifecyclePostmanSimulation.test.js`
- `tests/guestAccess.test.js`
- `tests/homeDeliveryAndBranchPickupRules.test.js`
- `tests/homeDeliveryPostmanContract.test.js`
- `tests/manual_verify_allow_applied_reconciliation.test.js`
- `tests/oneTimeMenuCatalog.test.js`
- `tests/oneTimeOrderFullFlow.test.js`
- `tests/oneTimeOrderPremiumUpgradeIsolation.test.js`
- `tests/oneTimeOrders.test.js`
- `tests/operationsHistoricalMutationContract.test.js`
- `tests/orderDeliveryLifecycleFixes.test.js`
- `tests/premium_extra_day_update_guard.test.js`
- `tests/subscriptionFulfillmentPolicy.test.js`

Intermittent failures:

- `tests/oneTimeAddonVerifyAlias.test.js` failed runs 1-4 and passed run 5.
- `tests/pastSubscriptionDaySettlement.test.js` failed runs 1 and 5, passed runs 2-4.

Representative evidence:

- Current runtime rejects dispatch/prepare/fulfill from invalid states: `INVALID_TRANSITION`, `INVALID_STATE_TRANSITION`.
- Permission expectations mismatch: `delivery dispatch: expected 200, got 403 FORBIDDEN`.
- Historical records are protected: `HISTORICAL_MUTATION_FORBIDDEN`.
- Duplicate premium config key in an isolation test suggests fixture cleanup or unique-key setup, not runtime catalog expansion.
- `premium_extra_day_update_guard` has a `MongooseError: Connection operation buffering timed out after 10000ms`, likely infrastructure/resource cleanup or connection timing.

The repeated valid green tests (`oneTimeOrderOps`, `operationsDeliveryFlowContract`, `orderPaymentIdempotency`, `orderQueryParity`) show the order domain is not globally broken.

## Cluster D - Pickup Contracts

Classification: contract drift plus retry/resource sensitivity around collection/catalog changes.

Deterministic failures:

- `tests/branchPickupOperationalGuard.test.js`
- `tests/subscriptionPickupRequestClientService.test.js`
- `tests/subscriptionPickupRequestOps.test.js`
- `tests/subscriptionPickupRequestRoutes.test.js`

Representative evidence:

- Current pickup operations reject `prepare` in the initial state: `Action prepare is not allowed in current state`.
- Multiple pickup writes intermittently hit Mongo catalog-change retry messages on `subscriptionpickuprequests`.
- Adjacent tests pass: `subscriptionPickupOverview`, `subscriptionPickupRequestBalanceService`, and `subscriptionPickupRequestSettlement`.

The new initial status `in_preparation` appears plausible but must be confirmed from controller/service routes before tests are changed. Contract decision `PICKUP-STATUS-001` is required.

## Cluster E - Add-on Source And Readback

Classification: outdated source/readback expectations and fixture drift.

Deterministic failures:

- `tests/addonBootstrapAndReadModels.test.js`
- `tests/subscriptionAddonBalanceModel.test.js`
- `tests/subscription_addon_selection_readback.integration.test.js`

Intermittent related failure:

- `tests/oneTimeAddonVerifyAlias.test.js`

Representative evidence:

- Source validation mismatch in selection readback.
- Balance model expects fallback totals, which conflicts with the current no-static-fallback direction.
- Dashboard admin alias rejects empty `menuProductIds`, which is valid stricter fixture validation.

Contract decision `ADDON-SOURCE-001` is required before updating readback assertions.

## Cluster F - VAT Fixtures

Classification: invalid fixture.

Deterministic failure:

- `tests/vatSystem.test.js`

Evidence:

- VAT unit tests pass.
- Integration fixture attempts to price an order without items; runtime returns `EMPTY_ORDER` / `Order must include at least one item`.

Correct fix is a valid order fixture with required items, pricing, totals, currency, and integer minor-unit VAT assertions. Do not weaken order validation.

## Test Infrastructure Findings

- `describe is not defined`: 0 occurrences in the five diagnostic runs.
- Skipped tests: 0 in all five runs.
- Timeouts: 0 in all five runs.
- Execution order: stable dispatcher order in all five runs.
- Database isolation: Mongo-backed test files received stable per-file database names (`bd145_<hash>_test`) on fresh memory replica-set ports.
- Remaining resource/infrastructure suspects:
  - Mongo catalog-change retry errors in pickup and historical settlement tests.
  - Mongoose buffering timeout in `premium_extra_day_update_guard`.
  - Intermittent files listed in `audit/FLAKY_TEST_MATRIX.md`.

## Runtime Defect Status

No confirmed runtime defect was established in this pass. The evidence supports fixture defects, stale expectations, and a small number of infrastructure/resource-sensitive tests. Production behavior should remain unchanged until contract decisions are made.
