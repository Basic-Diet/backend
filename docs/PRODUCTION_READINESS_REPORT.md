# Production Readiness Report

Generated: 2026-07-15

## Summary

Branch: `main`

Starting commit: `123398058e9f0f6874ef1d023b79e99e73d4b586`

Final status: **NOT READY FOR PRODUCTION**

The backend cleanup pass removed tracked generated artifacts, fixed the stale premium test fixture baseline, hardened startup logging, added compatible liveness/readiness endpoints, and fixed one broken npm script path. Critical API contracts were preserved, including the premium relink payload contract for `PATCH /api/dashboard/premium-upgrades/:id`.

The repository is materially cleaner, but production readiness is blocked by failing add-on/one-time menu validation gates and remaining manual production checks.

## Changes made

- Added `docs/PRODUCTION_READINESS_CLEANUP_AUDIT.md`.
- Updated `tests/meal_planner_types.test.js` fixtures to model current source-linked `PremiumUpgradeConfig` records.
- Removed tracked `node_modules/` and proven local/generated artifacts.
- Added ignore coverage for generated output, scratch files, local reports, and downloaded bundles.
- Replaced production-path startup `console.*` calls in `src/index.js` with sanitized project logger usage.
- Added `/live` and `/ready`; preserved `/health` as readiness-compatible.
- Fixed `seed:dashboard-users` to point at existing `scripts/seed-dashboard-users.js`.

## Files deleted

- `node_modules/` from Git tracking: 15,370 tracked dependency files removed; dependencies remain reproducible via `package-lock.json`.
- Downloaded image bundle: `drive-download-20260601T101839Z-3-001/`.
- Generated/local outputs: `output/menu-identity-suggestions.json`, `tmp/verify_addon_catalog.js`.
- Root local artifacts: `debug_patch.js`, `debug_readiness.js`, `changes.patch`, `e2e_out.txt`, `final_report.txt`, `final_report_node.txt`, `ls_output.txt`, `repro_output.txt`, `test-output.txt`, `jest_exits.txt`.
- Scratch scripts/outputs under `scratch/` and root `scratch*.js`; retained `scratch/.gitkeep`.

## Files retained intentionally

- `audit/raw-test-output/*`: referenced by audit docs as preserved test evidence.
- `test-reports/summary.txt`: referenced by `audit/TEST_RUNNER_MANIFEST.md`.
- Historical migrations, backfills, seeds, and operational scripts.
- Contract/operational docs under `audit/`, `docs/`, `postman/`, and `google-play/`.
- Flutter/mobile reports and `.github/workflows/build-apk.yml`: out of backend cleanup scope.

## Dependencies

- Dependencies removed from `package.json`: none.
- `npm ci` succeeded and restored local dependencies.
- `npm audit --omit=dev --json`: 8 moderate production vulnerabilities, 0 high, 0 critical.
- `npm ci` warning: current shell uses Node `v22.22.3`; package declares Node `^20.0.0`.

## Tests changed

- `tests/meal_planner_types.test.js` now mocks active published menu options/products/groups and source relations required by the current premium resolver.
- No tests were deleted.

## Production hardening changes

- Startup failures and fatal process errors now use `logger` instead of raw console output.
- Environment validation failure logging includes only non-secret categories: missing, invalid, security violations, and message.
- `/live` returns process liveness without DB details.
- `/ready` checks Mongo readiness and pings the DB when connected.
- `/health` remains compatible with the previous DB readiness response.

## Validation results

- `npm ci`: passed; Node engine warning and 11 total audit findings reported by npm.
- `npm test`: passed, 66 passed / 0 failed.
- Health smoke via `createApp()` and `supertest`: `/live` 200, `/ready` 503, `/health` 503 when DB disconnected.
- `npm run validate:backend`: failed at `test:one-time-menu`.
  - `npm test` sub-step passed.
  - `tests/oneTimeMenuCatalog.test.js`: 2 failed; `basic_salad contains beef_steak`, `premium shrimp appears in premiumProteins`.
- `npm run test:security`: passed.
- `npm run test:checkout`: passed, 34 passed / 0 failed / 0 skipped.
- `npm run test:checkout-concurrency`: passed, 3 passed / 0 failed.
- `npm run test:subscriptions`: passed.
- `npm run test:addon-credit-allocation`: failed in `tests/subscriptionAddonCreditAllocation.test.js`; expected `2`, got `0`.
- `npm run test:addon-credit-lifecycle`: failed in `tests/addon_balance_e2e.test.js`; `ADDON_BALANCE_RELEASE_FAILED`, `bucket_identity_mismatch`, HTTP 409 instead of 200.
- `npm run test:addon-dashboard-mobile-parity`: failed twice; expected 400, got 201.
- `npm run test:mobile-contracts`: passed.
- `npm run test:builder-catalog-v2-contract`: passed.
- `NODE_ENV=test bash scripts/run-premium-meal-backend-lifecycle.sh`: failed in `test:integration`; 46 passed / 3 failed.
  - Add-on entitlement validation expected `subscription`, got `pending_payment`.
  - Entitled item add-on expected `subscription`, got `pending_payment`.
  - Add-on payment verify expected 1 pending add-on, got 2.
- Package script reference check: passed after fixing `seed:dashboard-users`.
- `git ls-files node_modules | wc -l`: `0`.
- `graphify update .`: attempted and failed; Graphify refused to overwrite because the new graph had 4913 nodes versus existing 5031 after artifact cleanup. `graphify update . force=True` and `graphify update . --force` also failed with the same guard.

## Remaining production blockers

- One-time menu catalog contract failures.
- Add-on credit allocation, lifecycle, and dashboard/mobile parity failures.
- Premium lifecycle script fails in meal planner integration because add-on entitlement/payment expectations are not met.
- 8 moderate production dependency vulnerabilities require review/remediation or formal acceptance.
- Manual production checks still required for real environment secrets, payment/webhook providers, delivery integrations, production data, deployment infrastructure, and real E2E flows.

## Manual QA requirements

- Verify production/staging environment variables against `validateEnv()`.
- Verify Moyasar payment initialization, callback, and webhook handling with real provider configuration.
- Verify delivery and pickup flows against real operational data.
- Verify dashboard premium relink behavior preserves `premiumKey` with payloads containing only `expectedRevision`, `kind`, and `sourceId`.
- Verify add-on entitlement/balance fixes after the failing add-on tests are addressed.

## Risks not addressed

- No dependency upgrades were performed.
- No database migrations were changed.
- No broad refactors were attempted.
- Graphify graph update remains blocked by the tool guard.

## Commit hashes created

- `66a3e69c` `docs: add backend production cleanup audit`
- `e8fac6b2` `test: align premium planner fixtures with source-linked configs`
- `60cb2ca5` `chore: remove proven generated backend artifacts`
- `b3e9e951` `chore: harden startup logging and health checks`
- `4115bf0c` `chore: fix dashboard user seed script path`
