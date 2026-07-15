# Production Readiness Cleanup Audit

Generated: 2026-07-15

## 1. Executive summary

This backend checkout is on `main` at `123398058e9f0f6874ef1d023b79e99e73d4b586`. The production entry point is `src/index.js`, which creates the Express app from `src/app.js`, validates environment variables, connects MongoDB, starts background jobs, and then starts the HTTP server.

The repository contains production runtime code, operational scripts, historical migrations, tests, documentation, and several tracked generated/local artifacts. The safest cleanup is to remove reproducible dependency output and isolated generated/debug files while preserving API contracts, migrations, critical regression tests, and operational documentation.

Baseline validation before cleanup: `npm test` failed with 59 passing and 7 failing assertions in `tests/meal_planner_types.test.js`. The failures are all premium config/source fixture failures, not deletion-related failures.

## 2. Current production entry points

- Runtime: `npm start` -> `node src/index.js`.
- HTTP app: `src/app.js` creates the Express app, helmet, CORS, request IDs, JSON normalization, public `/health`, public policy/account deletion pages, Swagger UI, payment routes, `/api` routes, JSON 404s, and centralized error handling.
- Route root: `src/routes/index.js` registers auth, dashboard, app, subscription, order, add-on, catalog, payment, webhook, kitchen, courier, client, and admin routes.
- Background jobs: `src/jobs/index.js` is started after database connection.
- Database: `src/db.js` provides the MongoDB connection used before accepting traffic.

## 3. Runtime architecture summary

The app is an Express/Mongoose Node 20 service. Core domains are authentication/session lifecycle, dashboard auth and role enforcement, meal builder/catalog, subscriptions, premium upgrades, add-ons, checkout/payment, delivery/pickup/kitchen operations, and dashboard reporting. Graphify identifies high-connectivity runtime abstractions including `createApp()`, `validateObjectId()`, `performDaySelectionUpdate()`, `resolveCheckoutQuoteOrThrow()`, and canonical meal-slot validation.

## 4. Files safe to delete

Each item below was checked against static references using `rg`, package scripts, CI workflow commands, Docker configuration, and route/startup files. Migrations are not included.

| Path | Purpose/former purpose | Evidence | Risk | Validation |
| --- | --- | --- | --- | --- |
| `node_modules/` | Installed dependency output | 15,370 tracked files under a path already ignored by `.gitignore`; dependencies are reproducible from `package-lock.json`; Docker and CI use `npm ci` | Low | Run `npm ci` after removal |
| `drive-download-20260601T101839Z-3-001/` | Downloaded image bundle, not backend runtime | No source/script/package/CI references; only mentioned by `ls_output.txt`, itself a local listing artifact | Low | Re-run reference check and tests |
| `output/menu-identity-suggestions.json` | Generated menu identity suggestion output | No runtime/script/package/CI references; `audit/GENERATED_ARTIFACTS_REVIEW.md` identifies it as pre-existing generated output | Low | Re-run reference check |
| `tmp/verify_addon_catalog.js` | Temporary verification script | No runtime/script/package/CI references | Low | Re-run reference check |
| `debug_patch.js`, `debug_readiness.js`, `changes.patch`, `e2e_out.txt`, `final_report.txt`, `final_report_node.txt`, `ls_output.txt`, `repro_output.txt`, `test-output.txt`, `jest_exits.txt` | Local debug/report artifacts | No runtime/script/package/CI references | Low | Re-run reference check |
| `scratch/*.js`, `scratch/*.json`, `scratch/*.txt` | Local scratch scripts and outputs | Scratch files are not package/CI/runtime entry points; tests write to `scratch/actual_json.json`, so keep a placeholder directory | Low with placeholder | Add `scratch/.gitkeep`; ignore generated scratch contents |

## 5. Files that appear obsolete but must be retained

- `audit/raw-test-output/*`: referenced by `audit/TEST_INVENTORY_DIFF.md`, `audit/GENERATED_ARTIFACTS_REVIEW.md`, and `audit/FLAKY_TEST_MATRIX.md` as preserved test evidence.
- `test-reports/summary.txt`: referenced by `audit/TEST_RUNNER_MANIFEST.md`.
- `audit/*.md` and `docs/**`: many are operational, contract, or audit references; retain unless a narrower future pass proves specific files obsolete.
- `.github/workflows/build-apk.yml`: Flutter-related and outside this backend cleanup scope; leave unchanged.
- Historical migration/backfill scripts under `scripts/` and `scripts/migrations/`: retain unless there is conclusive proof they were never used.

## 6. Files requiring manual confirmation

- Root Flutter/mobile reports such as `flutter_*` and `dashboard_mobile_changes_required.md`: likely outside backend release scope, but not deleted because the request explicitly says not to modify Flutter/client work.
- Postman collections and Google Play docs: may be operational/manual QA assets, so retain.
- Existing `audit/raw-test-output/*`: generated but referenced as evidence; deletion would require updating or archiving related audit docs.

## 7. Duplicate or overlapping implementations

- Public root `/health` exists in `src/app.js`; admin-only catalog/subscription health checks exist under `/api/health/*` via `src/routes/health.js`.
- Legacy courier/kitchen routes remain registered with comments indicating replacement by dashboard ops; retain because they are still route-registered and may be public contracts.
- Some CLI scripts overlap with audit/validation behavior. No script is deleted without a separate reference and operations review.

## 8. Obsolete tests and replacement coverage

No tests are proposed for deletion. Critical regression areas remain intact: authentication, password reset, authVersion, premium upgrades/relink, add-on buckets, checkout, subscription balances, meal deletion/release, delivery, pickup, kitchen, and dashboard APIs.

The only test change proposed is updating stale premium fixtures in `tests/meal_planner_types.test.js` to model current source-linked `PremiumUpgradeConfig` records.

## 9. Dead code findings

No production runtime module is proven dead in this pass. `src/index.js` contains production-path `console.*` logging that should be replaced with the project logger.

## 10. Unused dependency findings

Every declared dependency and devDependency has apparent references in source, tests, scripts, configuration, or package scripts:

`bcryptjs`, `cloudinary`, `cors`, `date-fns`, `date-fns-tz`, `dotenv`, `express`, `express-rate-limit`, `firebase-admin`, `helmet`, `jsonwebtoken`, `mongodb`, `mongoose`, `multer`, `swagger-jsdoc`, `swagger-ui-express`, `winston`, `chai`, `jest`, `mocha`, `mongodb-memory-server`, `sinon`, and `supertest`.

No dependency removal is proposed.

## 11. Security findings

- Environment validation rejects missing required secrets and production test/bypass flags.
- Production requires `MOYASAR_WEBHOOK_SECRET` and at least one configured browser origin.
- Log sanitization exists in `src/utils/logger.js`.
- Startup currently logs via raw `console.*`; switch to sanitized logger and avoid dumping full env check objects.
- CORS has a fixed local/default allowlist plus configured origins; production still requires explicit configured origins.

## 12. Configuration and environment findings

- `validateEnv()` distinguishes test and non-test MongoDB variables.
- `.env.example` exists and real `.env` files are ignored.
- No lint or typecheck script exists; document as a readiness gap rather than inventing non-working scripts.

## 13. Logging and observability findings

- Request IDs are attached in `src/app.js` and included in central unhandled route errors.
- Winston logs to console and files under `logs/`, which is ignored.
- Replace `src/index.js` raw startup console logging with `logger`.

## 14. Deployment and startup findings

- Docker uses Node 20 Alpine, installs production dependencies with `npm ci --omit=dev`, copies the app, and runs `npm start`.
- Startup connects MongoDB before starting the HTTP server.
- SIGTERM/SIGINT graceful shutdown exists with a 10 second force timeout.
- Add compatible `/live` and `/ready` endpoints while keeping `/health`.

## 15. Database migration risks

No database migrations should be deleted, renamed, reordered, or rewritten. Backfills and data repair scripts may be operational rollback tools and are retained.

## 16. Production blockers

- `npm test` fails before cleanup: 59 passed, 7 failed in premium meal planner fixture tests.
- Full validation may require MongoDB replica set support; commands that cannot run locally must be recorded exactly.
- Manual validation remains required for production secrets, payment provider callbacks/webhooks, delivery integrations, deployment infrastructure, and real E2E flows.

## 17. Recommended cleanup sequence

1. Commit this audit.
2. Fix stale premium test fixtures without changing public premium relink API contracts.
3. Remove tracked `node_modules/` and proven local/generated artifacts.
4. Update `.gitignore`/`.dockerignore` for scratch, output, local reports, and downloaded bundles.
5. Harden startup logging and add compatible liveness/readiness endpoints.
6. Run validation commands and document exact results.
7. Run `graphify update .`.
8. Create `docs/PRODUCTION_READINESS_REPORT.md`.
