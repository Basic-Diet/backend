# Subscription Menu / Meal Planner Backend Review

Status: READY FOR DASHBOARD/FLUTTER CONTRACT REVIEW

## Blocker Review

1. Premium Large Salad v3 Allowlist Enforcement: fixed.
   Evidence: `src/services/subscription/canonicalMealSlotPlannerService.js`, `tests/premiumLargeSaladV3Allowlist.test.js`.

2. Unified Day Payment Contract Hardening: fixed.
   Evidence: `src/services/subscription/unifiedDayPaymentService.js`, `tests/mealPlannerPaymentContract.test.js`.

3. Dashboard Subscription Planner Readiness Check: fixed.
   Evidence: `src/services/dashboardHealthService.js`, `tests/dashboardSubscriptionMenuReadiness.test.js`.

4. Stale Catalog Error Matrix: fixed.
   Evidence: `src/services/subscription/canonicalMealSlotPlannerService.js`, `tests/subscriptionPlannerStaleCatalog.test.js`.

5. Dashboard-to-Flutter Subscription Planner E2E: fixed.
   Evidence: `tests/subscriptionPlannerDashboardToFlutter.e2e.test.js`.

## Remaining Risks

- Production payment verification still needs real Moyasar staging/live verification.
- Environment secrets and callback URLs must be validated outside unit/integration tests.
- Dashboard/Flutter can start against this contract, but final request/response examples should be frozen during contract review.

## Verification Evidence

Passing targeted commands:

```bash
NODE_ENV=test node tests/premiumLargeSaladV3Allowlist.test.js
NODE_ENV=test node tests/mealPlannerPaymentContract.test.js
NODE_ENV=test node tests/dashboardSubscriptionMenuReadiness.test.js
NODE_ENV=test node tests/subscriptionPlannerStaleCatalog.test.js
NODE_ENV=test node tests/subscriptionPlannerDashboardToFlutter.e2e.test.js
```

The broad suite and backend validator should still be run before merge/deploy:

```bash
npm test
npm run validate:backend
```
