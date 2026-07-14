# Remediation Plan

1. Finish classifying the 45 remaining failures by business owner: auth/admin reset, meal-builder seed/config, planner canonical contracts, one-time order/menu, pickup request contracts, add-on source/readback, VAT fixture, and fulfillment auth/policy.
2. For meal-builder/planner failures, add reusable valid fixture builders for DB-backed `PremiumUpgradeConfig`, `MenuProduct`, `MenuOption`, `BuilderProtein`, and relationships. Do not relax runtime validation.
3. For auth/order/pickup failures, compare current route policy to adjacent passing tests and update either outdated expectations or runtime defects with focused regression tests.
4. Replace remaining stale future-intent dates with `tests/helpers/businessDateHelper.js`; keep explicitly historical tests historical.
5. Keep `test:all` sequential for Mongo-backed suites until isolation is proven.
6. Run the full required verification matrix only after the 45 remaining failures are resolved.
