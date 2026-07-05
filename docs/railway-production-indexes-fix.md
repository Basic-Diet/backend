# Railway Production Indexes Fix

## A. Verdict
PASS

## B. Root Cause
* **Payment index**: Failed because `partialFilterExpression` used `$ne: ""` which is an expression (or internally converts to `$not`) not supported in partial indexes on Railway's MongoDB version.
* **User email index**: Failed because the `sparse: true` option cannot be combined with `partialFilterExpression` in the same index definition in MongoDB.
* **Index Verification failure**: `create-production-indexes.js` was passing `options` without `name` to `createIndex()`, resulting in MongoDB auto-generating an index name (e.g., `email_1`) which then failed the verification script's exact string match for `email_1_unique_sparse`.

## C. Files Changed
* `scripts/create-production-indexes.js`
* `scripts/check-index-data.js` (temporary script for data validation)

## D. Index Specs After Fix
**Payment `operationIdempotencyKey_1`:**
```javascript
{
  unique: true,
  partialFilterExpression: { operationIdempotencyKey: { $type: "string", $gt: "" } },
  name: "operationIdempotencyKey_1"
}
```

**User email unique index:**
```javascript
{
  unique: true,
  partialFilterExpression: { email: { $type: "string", $gt: "" } },
  name: "email_1_unique_sparse" // name explicitly provided for verification passing
}
```

## E. Data Safety Checks
Before applying the indexes, existing data was scanned for safe compatibility:
* Duplicate non-empty `operationIdempotencyKey` count: 0
* Duplicate non-empty `email` count: 0
* Occurrences of empty string `""` for `email` or `operationIdempotencyKey`: 0
* Was destructive cleanup needed? **No**. Since no empty strings or duplicates existed, we safely updated the partial index constraint to `$gt: ""` without any data loss.

## F. Validation
Output from `npm run indexes:production`:

```txt
Ensuring production indexes...

[Payment] Creating index 'operationIdempotencyKey_1'...
[Payment] Created index 'operationIdempotencyKey_1' successfully
[User] Creating index 'email_1_unique_sparse'...
[User] Created index 'email_1_unique_sparse' successfully
[Addon] Index 'kind_1_category_1_isActive_1' already exists - skipping
...

Verifying indexes...
[Payment] 'operationIdempotencyKey_1': OK
[User] 'email_1_unique_sparse': OK
[Addon] 'kind_1_category_1_isActive_1': OK
[Addon] 'isActive_1_sortOrder_1': OK
[BuilderProtein] 'isActive_1_isPremium_1_sortOrder_1': OK
[ActivityLog] 'delivery_manual_subscription_deduction_once_per_day': OK

Done.
```

## G. Final Recommendation
* Railway DB indexed safely: Yes
* Bootstrap remains valid: Yes
* Can continue Railway QA: Yes
