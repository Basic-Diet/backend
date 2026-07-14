# Dynamic Catalog Implementation

## Premium Vertical Flow Status

Implemented and verified for the premium phase:

- Dashboard path: `premiumUpgradeConfigService.createConfig`, the service used by `POST /api/dashboard/premium-upgrades`.
- Public catalog: active config-backed premium `MenuOption` records appear in `GET /api/subscriptions/menu`.
- Quote/checkout: `POST /api/subscriptions/quote` and `POST /api/subscriptions/checkout` resolve arbitrary premium keys through DB records.
- Snapshots: checkout draft, contract snapshot, activation payload, subscription premium balance, and current overview preserve purchased name, price, currency, image, source id/model, entity type, and catalog version where available.
- Archive: `premiumUpgradeConfigService.archiveConfig` blocks new quote/checkout for that key while existing subscriptions continue to show the purchased snapshot.

## Shared Services

- `src/services/catalog/catalogResolutionService.js`
- `src/services/catalog/pricingResolutionService.js`
- `src/services/catalog/catalogArchiveGuardService.js`

## Key Runtime Changes

- `CatalogService` treats active `PremiumUpgradeConfig` as premium catalog eligibility.
- `premiumUpgradeConfigService` removed item-specific price fallback and now uses active config or DB-backed source records. If a config exists but is archived/disabled, new purchases fail closed.
- `premiumIdentity` supports `MenuOption`/`MenuProduct` premium sources without requiring a `BuilderProtein`.
- `subscriptionActivationService` prefers complete immutable premium snapshots.
- `subscriptionClientOverviewService` returns purchased premium snapshot fields rather than requiring live active catalog records.

## Same-Day Fulfillment Regression Status

Root cause: test fixture inconsistency. The failing checkout test used tomorrow as `startDate` while expecting same-day pickup override. Required behavior is:

- start today with home delivery: first day pickup override, later days delivery;
- start tomorrow or later: delivery from day one.

The test was corrected and a future-start regression assertion was added.

## Cross-Domain Changes

Retained:

- Builder premium soft archive.
- Mongo test runner safety changes already present in the worktree.

Reverted from this premium phase:

- Add-on category enum relaxation.
- One-time add-on allowlist removal.
- Public plan allowlist removal.
- Builder carb archive fields.
- One-time menu protein static visibility regression.

## Migration Requirements

No production migration was run. Recommended later migration:

- Backfill `PremiumUpgradeConfig` rows for existing premium keys.
- Detect archived/disabled configs that still have active source records.
- Report legacy aliases and move them to DB metadata.
- Dry-run only against production until approved.

## Full Test Status

Premium-focused validation and checkout now pass, but the complete release surface is not green:

- `npm test`: passed.
- `tests/dynamicCatalogPremium.test.js`: passed.
- `npm run test:checkout`: passed with MongoMemory replica set.
- `npm run test:subscriptions`: passed when run directly with MongoMemory replica set.
- `npm run test:mobile-contracts`: passed with MongoMemory replica set.
- `npm run test:release-gates`: failed in the subscriptions stage with a MongoMemory lock timeout.
- `npm run test:all`: failed with broader unrelated suite failures.

## Merge Recommendation

DO NOT MERGE.

The premium implementation is ready for focused review, but this branch is not merge-ready until release gates are green and generated test artifacts are cleaned or intentionally committed.
