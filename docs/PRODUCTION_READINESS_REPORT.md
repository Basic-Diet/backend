# Production Readiness Report

Generated: 2026-07-15

## Summary

Branch: `main`

Cleanup starting commit: `123398058e9f0f6874ef1d023b79e99e73d4b586`

Validation-fix starting commit: `ae44b84089ff0491ed859277365845cd5b206303`

Final status: **READY FOR PRODUCTION QA**

The previous production blockers in backend validation are resolved. The final automated validation matrix completed with exit code `0` for every required command, including the premium lifecycle wrapper.

This is not a controlled production release sign-off yet. `npm audit --omit=dev` still reports moderate production dependency advisories through `firebase-admin`/Google Cloud transitive `uuid` usage, with npm's offered full fix requiring a breaking `firebase-admin@14.1.0` upgrade. Manual staging/provider checks are still required.

## Changes Made In This Pass

- Added `docs/PRODUCTION_VALIDATION_BLOCKERS_ANALYSIS.md` with command-by-command classifications and evidence before code changes.
- Fixed legacy category-only add-on entitlement coverage while keeping modern `menuProductIds` snapshots exact and category-isolated.
- Persisted the consumed add-on wallet bucket's unit price, currency, and bucket id on covered selections so later releases satisfy strict bucket identity checks.
- Rejected dashboard add-on plans whose `menuProductIds` resolve to a category different from the plan category.
- Removed the subscription-only protein allowlist from the one-time order menu serializer so `basic_meal` exposes configured one-time protein relations.
- Updated one-time menu catalog tests for current seed option identities and source-linked premium config readiness.
- Updated checkout integration fixture isolation so independent activation scenarios do not violate the production invariant that a user may not have overlapping active subscriptions.

## Root Causes Resolved

- `validate:backend`: one-time `basic_meal` proteins were hidden by a serializer filter intended for subscription protein contracts; the test fixture also used stale premium config relation shape.
- `test:addon-credit-allocation`: category-only legacy add-on entitlement rows with balance were not eligible for same-category products.
- `test:addon-credit-lifecycle`: covered selections stored product unit price while release compared against wallet bucket unit price, causing `bucket_identity_mismatch`.
- `test:addon-dashboard-mobile-parity`: dashboard add-on plan create/update accepted category-mismatched products.
- Premium lifecycle wrapper: integration add-on covered-vs-paid calculations inherited the legacy entitlement eligibility defect.
- `test:checkout`: once rerun, deterministic fixture pollution appeared because separate activation scenarios reused one test user without retiring the prior active subscription.

## Public Behavior

- Premium relink contract was not changed. `PATCH /api/dashboard/premium-upgrades/:id` still uses `expectedRevision`, `kind`, and `sourceId`; `premiumKey` preservation and relation validation remain intact.
- Add-on behavior was corrected, not relaxed: modern product snapshots remain exact, categories remain isolated, and bucket identity checks remain strict.
- Dashboard add-on plan writes now reject invalid category/product combinations with `ADDON_PLAN_CATEGORY_PRODUCT_MISMATCH`.
- One-time `basic_meal` now exposes configured protein options in the public order menu instead of an empty protein group.

## Files Changed

- `docs/PRODUCTION_VALIDATION_BLOCKERS_ANALYSIS.md`
- `docs/PRODUCTION_READINESS_REPORT.md`
- `src/controllers/addonController.js`
- `src/services/orders/menuCatalogService.js`
- `src/services/subscription/subscriptionAddonPolicyService.js`
- `src/services/subscription/subscriptionSelectionService.js`
- `tests/checkout.integration.test.js`
- `tests/oneTimeMenuCatalog.test.js`

## Final Validation Results

Final validation logs are under `/tmp/basicdiet-validation-final-*`.

| Command | Result |
| --- | --- |
| `npm ci` | Pass, exit `0`; 654 packages installed/audited. npm reported 11 total vulnerabilities in install output. |
| `npm test` | Pass, exit `0`; 66 passed, 0 failed. |
| `npm run validate:backend` | Pass, exit `0`; all enabled checks passed. Optional local DB/catalog/Newman checks skipped by documented flags/files. |
| `npm run test:security` | Pass, exit `0`; security hardening units passed. |
| `npm run test:checkout` | Pass, exit `0`; 34 passed, 0 failed, 0 skipped. |
| `npm run test:checkout-concurrency` | Pass, exit `0`; 3 passed, 0 failed. |
| `npm run test:subscriptions` | Pass, exit `0`; balance policy, day modification policy, and fulfillment concurrency passed. |
| `npm run test:mobile-contracts` | Pass, exit `0`; mobile API contracts 7 passed / 0 failed; Flutter auth 27 passed / 0 failed; fulfillment contracts passed. |
| `npm run test:builder-catalog-v2-contract` | Pass, exit `0`; builderCatalogV2 contract checks passed. |
| `npm run test:addon-credit-allocation` | Pass, exit `0`; all allocation/policy matrix scripts passed. |
| `npm run test:addon-credit-lifecycle` | Pass, exit `0`; release idempotency and E2E lifecycle passed. |
| `npm run test:addon-dashboard-mobile-parity` | Pass, exit `0`; parity test passed. |
| `NODE_ENV=test bash scripts/run-premium-meal-backend-lifecycle.sh` | Pass, exit `0`; premium lifecycle gate passed; `mealPlanner.integration.test.js` reported 49 passed, 0 failed, 0 skipped. |

Additional check:

- `npm audit --omit=dev`: failed, exit `1`; 8 moderate production vulnerabilities from `uuid <11.1.1` through `firebase-admin`, `@google-cloud/firestore`, `@google-cloud/storage`, `google-gax`, `gaxios`, `retry-request`, and `teeny-request`. npm's full suggested fix is `npm audit fix --force`, which would install `firebase-admin@14.1.0` and is a breaking dependency upgrade.
- `graphify update .`: attempted after code changes and failed because Graphify refused to overwrite the existing graph (`4914` new nodes vs `5031` existing nodes). `graphify update . force=True` failed with the same guard.

## Infrastructure Requirements

- Local Node/npm environment.
- `mongodb-memory-server` and `mongodb-memory-server` replica sets for DB-backed and transaction-backed tests.
- `validate:backend` optional DB checks remain disabled unless explicitly enabled with safe non-production env vars.
- No production database, live payment provider, dashboard repo, or Flutter repo was required for the automated validation run.

## Remaining Risks And Manual QA

- Review or formally accept the moderate production dependency advisory before controlled production release.
- Run staging checks with real environment variables validated by `validateEnv()`.
- Verify Moyasar payment init, callback, and webhook behavior with real provider configuration.
- Verify delivery and pickup flows against staging operational data.
- Verify dashboard premium relink with payloads containing only `expectedRevision`, `kind`, and `sourceId`.
- Verify deployment readiness, secrets, observability, backups, and production data assumptions outside the local automated harness.

## Final Readiness Status

**READY FOR PRODUCTION QA**

Automated backend validation blockers are resolved. Controlled production release should wait for dependency advisory disposition and manual staging/provider QA.

## Commit Hashes

Previous cleanup commits:

- `66a3e69c` `docs: add backend production cleanup audit`
- `e8fac6b2` `test: align premium planner fixtures with source-linked configs`
- `60cb2ca5` `chore: remove proven generated backend artifacts`
- `b3e9e951` `chore: harden startup logging and health checks`
- `4115bf0c` `chore: fix dashboard user seed script path`
- `ae44b840` `docs: add backend production readiness report`

Validation-fix commits:

- `b928bf6d` `docs: analyze backend production validation blockers`
- `212758fa` `fix(addons): restore entitlement coverage and bucket identity`
- `017f29c2` `fix(menu): expose one-time meal protein options`
- `665090f1` `test(checkout): isolate activation scenarios`
- Report commit: this commit (`docs: update backend production readiness report`; final hash reported in handoff).
