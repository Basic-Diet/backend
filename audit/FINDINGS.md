# Findings

1. `test:all` previously executed all `.test.js` files with plain Node, causing framework-global failures. Added `scripts/test-runner-dispatcher.js` and dispatcher regression coverage.
2. Jest-authored tests exist and Jest was missing. Added Jest dev dependency and route those files through Jest.
3. Two wrapper alias test files were discovered and are no longer executed a second time individually.
4. Several hardcoded May/June 2026 fixtures were stale as of 2026-07-14 and triggered valid historical mutation/date guards. Repaired selected fixtures using KSA business-date helpers.
5. Current premium validation correctly fails closed without `PremiumUpgradeConfig`; repaired three fixtures with DB-backed premium configs.
6. Remaining failures are now mostly genuine application/contract/fixture failures: meal-builder config drift, auth policy expectation drift, add-on source/readback contracts, order/menu contracts, pickup routes, and VAT fixture validity.
7. Transaction retry service is bounded (default maxRetries=3), uses exponential backoff, preserves original error on final failure, and test coverage `operationsTransactionRetryContract.test.js` passed in both full runs.
