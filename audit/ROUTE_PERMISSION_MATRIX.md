# Route Permission Matrix

This is an initial matrix from route registration and middleware inspection, not a complete method-level authorization proof.

| Area | Base Path | Auth Observed | Notes |
|---|---|---|---|
| Health/root | `/`, `/health`, `/api/health` | Public | Safe smoke endpoints; health includes DB state. |
| API docs | `/api-docs`, `/subscriptions-api-docs` | Public | Public OpenAPI surface is exposed in production. |
| Auth | `/api/auth`, `/api/app` | Public/token mixed | OTP/password/session behavior requires deeper DB-backed tests. |
| Client profile | `/api/client` | App auth expected | Ownership checks should be verified with Mongo tests. |
| Subscriptions | `/api/subscriptions` | App auth expected | High-risk ownership, planner, payment, pickup routes. |
| Orders | `/api/orders` | App auth expected | Payment/delivery ownership requires DB-backed verification. |
| Payments | `/api/payments`, public payment callback routes | Mixed public/provider/client | Webhook signature/idempotency must be release-gated. |
| Webhooks | `/api/webhooks` | Provider signature expected | Do not call with real providers during audit. |
| Dashboard auth | `/api/dashboard/auth` | Public login/token | Dashboard tokens use DB re-check and password-change revocation. |
| Dashboard admin/menu/ops/accounting | `/api/dashboard/*`, `/api/admin/*` | Dashboard auth/roles expected | Role matrix must be expanded per route before release. |
| Kitchen/courier deprecated | `/api/kitchen`, `/api/courier` | Deprecated operational auth expected | Aliases need permission parity review against dashboard ops. |
| Public catalog/settings | `/api/settings`, `/api/categories-with-meals`, menu/content/addons/plans/popular packages | Public/mixed | Public surface should remain contract tested. |

Open authorization work:

- Build method/path-level matrix from every `router.METHOD` call.
- Verify user ownership for subscription/order/client resources.
- Verify dashboard roles for each mutation route.
- Verify deprecated kitchen/courier aliases cannot bypass newer ops policy.
