# Subscription Menu / Meal Planner Backend README

Status: READY FOR DASHBOARD/FLUTTER CONTRACT REVIEW

This document is the backend reference for the subscription menu and meal planner contract. It is not a production-launch certificate; production readiness still depends on deployment environment, secrets rotation, and real payment-provider staging verification.

## Scope

- Subscription planner catalog read: `GET /api/subscriptions/meal-planner-menu`
- Daily add-on choices read: `GET /api/subscriptions/addon-choices`
- Day read/save/validate/confirm under `GET|PUT|POST /api/subscriptions/:id/days/:date/...`
- Unified day payment:
  - `POST /api/subscriptions/:id/days/:date/payments`
  - `POST /api/subscriptions/:id/days/:date/payments/:paymentId/verify`
- Dashboard readiness check: `GET /api/dashboard/health/meal-planner`

## Route Alias Policy

Keep current public routes and aliases. Do not remove legacy subscription day routes or dashboard menu aliases while Flutter/Dashboard contracts are being reviewed.

Canonical Dashboard readiness route:

```http
GET /api/dashboard/health/meal-planner
```

Canonical Flutter planner catalog routes:

```http
GET /api/subscriptions/meal-planner-menu
GET /api/subscriptions/addon-choices
```

## Addon vs Daily Extras

- `addon-choices` are daily add-ons backed by active, visible, available, published `MenuProduct` rows in mapped menu categories.
- Planner day payment uses `ADDON_PAYMENT_REQUIRED` for unpaid daily add-ons.
- Do not use `ONE_TIME_ADDON_PAYMENT_REQUIRED` for the day planner payment CTA. That legacy wording can still exist in older one-time add-on paths, but it is not the v3 planner CTA contract.

## Premium Large Salad v3

The backend enforces the subscription premium large salad protein allowlist even when Dashboard relations expose extra options.

Required behavior:

- Allowed subscription salad proteins are accepted.
- Disallowed regular proteins are rejected even if a `ProductGroupOption` relation exists.
- Premium proteins outside the salad allowlist are rejected.
- `extra_protein_50g` is rejected for subscription premium large salad.
- Legacy premium large salad validation is not weakened.

Stable rejection codes:

- `SALAD_PROTEIN_NOT_ALLOWED`
- `PLANNER_OPTION_GROUP_UNAVAILABLE` for `extra_protein_50g`

## Unified Day Payment Response

Create and verify responses consistently expose safe contract fields:

```json
{
  "paymentId": "payment object id",
  "payment_id": "payment object id",
  "status": "initiated|paid|...",
  "requiresPayment": true,
  "premiumAmountHalala": 3000,
  "addonsAmountHalala": 1000,
  "totalHalala": 4000,
  "plannerRevisionHash": "sha256",
  "paymentUrl": "https://provider-checkout",
  "payment_url": "https://provider-checkout"
}
```

Additional day/payment state fields already returned by the backend remain available, including `paymentRequirement`, `commercialState`, `premiumSummary`, `premiumExtraPayment`, `addonSelections`, `providerInvoice`, and `payment`.

Important variants covered by tests:

- premium-only amount
- add-on-only amount
- combined premium plus add-on amount
- no-payment-required state
- reusable initiated payment
- revision hash mismatch with `DAY_PAYMENT_REVISION_MISMATCH`
- provider/config failure without secret values in response fields

## Dashboard Readiness Endpoint

`GET /api/dashboard/health/meal-planner` returns:

```json
{
  "status": "ok|warning|error",
  "ready": true,
  "errors": [],
  "warnings": [],
  "checks": [],
  "summary": {}
}
```

It validates required planner products, keys, option groups, product-group relations, product-option relations, active/visible/available/published state, linked `CatalogItem` availability, premium large salad allowlist safety, `extra_protein_50g` exclusion, daily add-on mapped products, and standard/premium protein exposure warnings.

## Stale Catalog Refresh Matrix

Flutter should refresh the planner catalog and retry when it receives stale catalog errors with the refresh hint.

Stable backend codes include:

- `PLANNER_PRODUCT_NOT_FOUND`
- `PLANNER_PRODUCT_INACTIVE`
- `PLANNER_PRODUCT_UNPUBLISHED`
- `PLANNER_PRODUCT_UNAVAILABLE`
- `PLANNER_OPTION_GROUP_NOT_FOUND`
- `PLANNER_OPTION_GROUP_UNAVAILABLE`
- `PLANNER_OPTION_GROUP_RELATION_NOT_FOUND`
- `PLANNER_OPTION_GROUP_RELATION_UNAVAILABLE`
- `PLANNER_OPTION_NOT_FOUND`
- `PLANNER_OPTION_UNAVAILABLE`
- `PLANNER_PRODUCT_OPTION_RELATION_NOT_FOUND`
- `PLANNER_PRODUCT_OPTION_RELATION_UNAVAILABLE`
- `PLANNER_MIXED_LEGACY_CANONICAL_SLOT`
- `LEGACY_DAY_SELECTION_UNSUPPORTED`
- `DAY_PAYMENT_REVISION_MISMATCH`

## E2E Validation

The backend now has a focused dashboard-to-Flutter integration test covering Dashboard readiness, Flutter menu reads, daily add-on reads, pure v3 save, unified payment create, payment verify, confirmation, and final day read.

Needs backend contract hardening: none currently blocking Dashboard/Flutter contract review. Production checks remain separate.
