# Test Baseline

Environment:

- Node: v22.22.3
- npm: 10.9.8
- Mongo env vars explicitly unset for safe no-DB baseline.

Baseline before fixes:

| Command | Result |
|---|---|
| `npm test` | 66 passed, 0 failed |
| `npm run test:all` with Mongo vars unset | 153 discovered, 28 passed, 6 failed, 119 skipped |
| `npm audit --omit=dev --json` | 8 moderate production advisories, 0 high/critical |

Initial no-DB failures:

- `catalogAllowlistParity.test.js`
- `dashboardKitchenArabicHydration.test.js`
- `dashboardMealBuilderPublishValidation.test.js`
- `seedCatalogProteinCanonical.test.js`
- `subscriptionMealBuilderPlannerCatalogCompile.test.js`
- `subscriptionMealPlannerCanonicalMealBuilder.test.js`

Blocked baseline:

- Mongo-backed unit/integration/contract suites skipped because no safe `MONGO_URI`/replica-set test DB was supplied.
- Full release gates were not run.
