# Screen Contract: 04_PROMO_CODES

## Status

`READY_WITH_LIMITATIONS`

The Dashboard, backend routes, list query, canonical write payload, Arabic actions, and DTO are aligned. The limitation is intentional: promo redemption is implemented for subscription checkout only. One-time orders reject promo codes, and an `addon_plans`-only code can be stored but is not accepted by the subscription validation endpoint.

## Dashboard

- Route: `/promo-codes`
- Required language: all visible labels, messages, buttons, errors, and empty states are Arabic.
- Pricing authority: the Dashboard displays stored values only. The backend validation/quote services decide eligibility and final discount amounts.
- Fixed values: `discountValue` is expressed in halalas when `discountType` is `fixed`.

## Authentication and roles

All routes use Dashboard bearer authentication. Promo-code routes are mounted after `dashboardRoleMiddleware(["admin"])`, so `admin` and the middleware's `superadmin` bypass are allowed. `cashier` is rejected.

## Active endpoints

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/dashboard/promo-codes` | Search/list promo codes | Query below | `{ status, data: PromoCodeAdminDTO[], meta }` |
| GET | `/api/dashboard/promo-codes/:id` | Detail and latest 25 usages | Path `id` | `{ status, data: PromoCodeAdminDTO & { recentUsage } }` |
| POST | `/api/dashboard/promo-codes` | Create | Canonical write payload | `201 { status, data: PromoCodeAdminDTO }` |
| PUT | `/api/dashboard/promo-codes/:id` | Update | Canonical write payload | `{ status, data: PromoCodeAdminDTO }` |
| PATCH | `/api/dashboard/promo-codes/:id/toggle` | Invert `isActive` | No body | `{ status, data: PromoCodeAdminDTO }` |
| DELETE | `/api/dashboard/promo-codes/:id` | Soft archive unused code | No body | `{ status, data: PromoCodeAdminDTO }` |
| POST | `/api/dashboard/promo-codes/validate` | Validate against a subscription quote | Validation payload below | `{ status, data: { valid, promo, breakdown } }` |

These are active Dashboard endpoints, not legacy aliases.

## List query

| Field | Type | Default | Behavior |
| --- | --- | --- | --- |
| `q` | string | empty | Case-insensitive literal search in code, title, description, and Arabic/English metadata name |
| `page` | positive integer | `1` | Enables pagination when `page` or `limit` is supplied |
| `limit` | integer `1..100` | `20` | Page size |
| `includeDeleted` | boolean string | `false` | Includes soft-archived rows when `true` |

For compatibility, a request without `page` and `limit` still returns the complete filtered `data` array. `meta` is additive:

```json
{
  "total": 42,
  "page": 2,
  "currentPage": 2,
  "limit": 10,
  "totalPages": 5,
  "lastPage": 5
}
```

## Canonical create/update payload

```json
{
  "code": "WELCOME10",
  "name": {
    "ar": "خصم الترحيب",
    "en": "Welcome Discount"
  },
  "discountType": "percentage",
  "discountValue": 10,
  "usageLimitTotal": 100,
  "usageLimitPerUser": 1,
  "startsAt": "2026-06-24T00:00:00.000Z",
  "expiresAt": "2026-07-24T00:00:00.000Z",
  "appliesTo": "subscription",
  "isActive": true
}
```

Canonical `discountType` values are `percentage` and `fixed`. Backend compatibility aliases remain accepted: `fixed_amount` normalizes to `fixed`, `endsAt` normalizes to `expiresAt`, and `usageLimit` normalizes to `usageLimitTotal`. The Dashboard sends only canonical fields.

Other supported backend fields, not currently edited by the lightweight Dashboard form, are `title`, `description`, `maxDiscountAmountHalala`, `minimumSubscriptionAmountHalala`, `eligiblePlanIds`, `eligiblePlanDaysCounts`, `firstPurchaseOnly`, `allowedUserIds`, `currency`, and `metadata`.

## Admin DTO

`PromoCodeAdminDTO` contains:

```text
id, code, name { ar, en }, title, description,
isActive, appliesTo, appliesToList,
discountType, discountValue,
maxDiscountAmountHalala, minimumSubscriptionAmountHalala,
startsAt, expiresAt,
usageLimitTotal, usageLimitPerUser, currentUsageCount, usedCount,
eligiblePlanIds, planIds, eligiblePlanDaysCounts,
firstPurchaseOnly, allowedUserIds,
currency, metadata, deletedAt, createdAt, updatedAt,
state { isExpired, isStarted, isDeleted, isUsageExhausted, isCurrentlyValid }
```

Detail `recentUsage[]` contains `id`, `userId`, `checkoutDraftId`, `subscriptionId`, `paymentId`, `discountAmountHalala`, `status`, `reservedAt`, `consumedAt`, `cancelledAt`, and `createdAt`. User names are not populated; the Dashboard shows the returned ID safely.

## Validation payload and scope

The endpoint accepts `promoCode` or `code`, `userId`, `planId`, `daysCount`, and either a quote/breakdown object or `subtotalHalala`/`totalHalala` plus optional `vatPercentage`.

The backend owns active state, start/end dates, minimum amount, plan/day restrictions, allowed users, first-purchase restriction, total usage, per-user usage, percentage validity, and final quote calculation.

Supported stored `appliesTo` values are `subscription`, `addon_plans`, and `all`. The subscription validator accepts `subscription` and `all`. `addon_plans`-only redemption has no verified consumer in this contract. One-time order checkout explicitly returns `PROMO_NOT_APPLICABLE_TO_ORDER_TYPE` when a promo is supplied.

## Toggle and archive

- Toggle flips `isActive`; it does not change usage data.
- DELETE is a soft archive: it sets `deletedAt` and `isActive=false`.
- Archive is blocked with `409 PROMO_IN_USE` when `currentUsageCount > 0`.
- The Dashboard therefore uses Arabic archive wording and never describes the action as permanent deletion.

## Compatibility

- Mobile subscription promo validation continues through the existing shared backend service.
- Flutter/mobile code is unchanged.
- One-time checkout behavior is unchanged and unsupported.
- No endpoint or backend DTO field was renamed or removed.
