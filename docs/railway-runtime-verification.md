# Railway Runtime Verification

## A. Verdict
PASS WITH EMPTY DB

## B. Runtime Target
- Public Base URL: `https://basicdiet145-production-51e9.up.railway.app`
- API Base URL: `https://basicdiet145-production-51e9.up.railway.app/api`

## C. Deployment Health

| Check | Result | Evidence |
| ----- | ------ | -------- |
| `/health` | PASS | Returned 200 `{"status":true,"db":{"state":"up"}}` |
| `/api/health` | PASS | Returned 401 Expected `{"ok":false,"error":{"code":"UNAUTHORIZED","message":"Missing dashboard token"}}` |
| DB connected | PASS | The health check `db.state` is `up` |
| Cold Restart | PASS | App was responsive on first hit, no restart loop or 5xx |

## D. Database Status
- Railway MongoDB connected: Yes
- Collections present: No (Public catalog endpoints return empty arrays `[]`)
- Seed/bootstrap required: Yes

## E. Auth Results

| Test | Endpoint | Expected | Actual | Result |
| ---- | -------- | -------- | ------ | ------ |
| Register | `POST /api/auth/register` | 200/201, User & Tokens | 200, returned user ID, `app_access` token | PASS |
| Login | `POST /api/auth/login` | 200, User & Tokens | 200, successfully authenticated | PASS |
| OTP disabled | `POST /api/auth/otp/request` | 403, Disabled message | 403, OTP requests blocked | PASS |

## F. Public Endpoint Results

| Endpoint | Status | Result | Notes |
| -------- | ------ | ------ | ----- |
| `/api/plans` | 200 | `[]` | PASS_EMPTY_DB |
| `/api/settings` | 200 | `{}` | PASS_EMPTY_DB |
| `/api/categories-with-meals` | 200 | `{"ok":true,"data":[]}` | PASS_EMPTY_DB |

## G. Dashboard/Admin Results
- SKIPPED: ADMIN_ACCOUNT_MISSING_EMPTY_DB
- Reason: The database is empty, preventing login to the dashboard and testing protected routes. Requires a bootstrap script to create default dashboard users.

## H. Subscription Flow Results
- SKIPPED: SKIPPED_EMPTY_DB_REQUIRES_BOOTSTRAP
- Reason: Creating a subscription checkout and viewing a timeline requires a seeded database (plans, delivery zones, menu items, settings). Skipping flow checks until DB is bootstraped.

## I. Payment/Webhook Results
- Moyasar config present/unknown: Unknown (Could not verify config due to empty DB/Settings)
- Webhook unsigned request safely rejected: Yes (`POST /api/webhooks/moyasar` returned 401 `"Invalid webhook token"`)
- Payment creation tested: No (Skipped due to empty DB)

## J. Timeline Regression
- Checked: No
- Contradictory days count: 0 (Skipped)
- Result: Skipped because the database is empty and there are no active subscriptions to assert against. A placeholder script was created at `.codex/private/check-railway-timeline.js`.

## K. Performance Smoke

| Request | HTTP Code | Response Time (s) |
| ------- | --------- | ----------------- |
| 1       | 200       | 0.700             |
| 2       | 200       | 1.022             |
| 3       | 200       | 0.835             |
| 4       | 200       | 1.108             |
| 5       | 200       | 0.786             |

## L. Issues Found

| ID | Severity | Area | Issue | Required Action |
| -- | -------- | ---- | ----- | --------------- |
| 1 | P1_REQUIRED | Database | Railway MongoDB is empty | Run `npm run bootstrap:data` and then safe QA seeds to allow Flutter E2E verification. |
| 2 | INFO | Dashboard | Dashboard login unavailable | Seed the database to provision a default admin account. |

## M. Files Changed
- `.codex/private/check-railway-timeline.js`
- `docs/railway-runtime-verification.md`

## N. Final Recommendation
- Railway backend usable now: Yes
- Railway DB ready: No (It's connected but empty)
- Need seed/bootstrap: Yes
- Need Flutter base URL update: Yes (Once DB is seeded, Flutter can point to Railway)
- Can proceed to Railway QA: Yes (After running bootstrap)
