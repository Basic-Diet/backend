# Test Results

Commands run after fixes:

| Command | Result |
|---|---|
| `bash -n scripts/test-db-isolation.sh scripts/run-all-tests.sh scripts/run-critical-tests.sh` | Passed |
| `NODE_ENV=test node tests/db_isolation.test.js` with Mongo vars unset | Passed |
| `NODE_ENV=test node tests/seedCatalogProteinCanonical.test.js` with Mongo vars unset | Passed |
| `NODE_ENV=test node tests/catalogAllowlistParity.test.js` with Mongo vars unset | Passed |
| `NODE_ENV=test node tests/dashboardKitchenArabicHydration.test.js` with Mongo vars unset | Passed |
| `NODE_ENV=test node tests/dashboardMealBuilderPublishValidation.test.js` with Mongo vars unset | Passed |
| `NODE_ENV=test node tests/subscriptionMealBuilderPlannerCatalogCompile.test.js` with Mongo vars unset | Passed |
| `NODE_ENV=test node tests/subscriptionMealPlannerCanonicalMealBuilder.test.js` with Mongo vars unset | Passed |
| `NODE_ENV=test npm test` with Mongo vars unset | 66 passed, 0 failed |
| `NODE_ENV=test npm run test:all` with Mongo vars unset | 153 discovered, 34 passed, 0 failed, 119 skipped |
| `graphify update .` | Passed; graph rebuilt to 4,730 nodes and 10,251 edges |

Skipped/blocked:

- 119 Mongo-backed tests skipped in `test:all` because `MONGO_URI` was unset.
- Release gates, transaction tests, checkout/payment/idempotency suites, and DB integrity checks remain blocked pending isolated MongoDB replica set/read-only audit credentials.
