# Home Delivery vs Branch Pickup Fulfillment Audit

Date: 2026-06-13

## Summary

The backend uses two different fulfillment entities for subscription operations:

- Home Delivery is fulfilled through one `SubscriptionDay` and one `Delivery` per `subscriptionId + date`.
- Branch Pickup is fulfilled through independent `SubscriptionPickupRequest` records and reserves from the subscription meal balance.

This audit covers backend models, indexes, queues, dispatch, fulfillment, and credit reservation behavior.

## Home Delivery Behavior

- `SubscriptionDay` has a unique index on `{ subscriptionId: 1, date: 1 }`, so a subscription has one day row per date.
- `SubscriptionDay.mealSlots` can contain multiple slots for the same date. Queue meal count is derived from the normalized kitchen meal slots.
- `Delivery` has a unique partial index on `{ subscriptionId: 1, date: 1 }` and a unique partial index on `{ dayId: 1 }`.
- Dashboard dispatch for a subscription day upserts `Delivery` using either `dayId` or `{ subscriptionId, date }`, then sets the canonical delivery fields on that single record.
- Duplicate dispatch is safe for delivery-record correctness: it cannot create a second delivery visit for the same `subscriptionId + date`. Depending on the action entrypoint, a repeated dispatch may be rejected by transition policy after the day is already `out_for_delivery`, but the `Delivery` count remains one.
- Fulfillment calls `fulfillSubscriptionDay`, which marks the day fulfilled and deducts credits through `consumeSubscriptionDayCredits`.
- `consumeSubscriptionDayCredits` guards with `SubscriptionDay.creditsDeducted`, so repeated fulfillment cannot double-deduct.
- The delivery status is synced to `delivered` after successful day fulfillment.

## Branch Pickup Behavior

- `SubscriptionPickupRequest` is the operational fulfillment entity for branch pickup.
- `SubscriptionPickupRequest` has a non-unique index on `{ subscriptionId: 1, date: 1, createdAt: -1 }`, so multiple same-day requests are allowed.
- Idempotency is enforced by a unique partial index on `{ subscriptionId: 1, userId: 1, idempotencyKey: 1 }`.
- A retry with the same idempotency key returns the existing pickup request and does not reserve credits again.
- Pickup request creation validates ownership, active subscription status, pickup delivery mode, restaurant availability, same-day date, date range, and positive `mealCount`.
- Pickup request creation no longer requires a `SubscriptionDay`. If a day exists, the backend uses it for snapshot context and still blocks skipped/frozen days.
- Each new non-idempotent pickup request atomically reserves meals by decrementing `Subscription.remainingMeals` with a guarded update requiring `remainingMeals >= mealCount`.
- Fulfillment for a pickup request calls `fulfillSubscriptionPickupRequest`, which marks the request `fulfilled` and sets `creditsConsumedAt`; it does not decrement `remainingMeals` again.
- Duplicate pickup fulfillment is safe for balance correctness. The action policy may reject a repeated fulfill after terminal status, but balance remains unchanged.

## Release And No-Show Policy

- Cancel before consumption releases reserved credits:
  - `releaseReservedPickupMeals` sets `creditsReleasedAt`.
  - It increments `Subscription.remainingMeals` by `pickupRequest.mealCount`.
- No-show consumes reserved credits:
  - `handleNoShow` transitions the request to `no_show`.
  - It calls `consumeReservedPickupMeals`, setting `creditsConsumedAt`.
  - It does not return meals to `remainingMeals`.
- These policies were preserved and covered by focused tests.

## Queue Behavior

- Home Delivery queue rows are subscription-day rows:
  - `ids.entityType = "subscription_day"`
  - `ids.subscriptionDayId` is present
  - `fulfillment.type = "home_delivery"`
  - `orderSummary.mealCount` and `kitchen.meals.length` reflect the day meal slots
- Branch Pickup queue rows are pickup-request rows:
  - `ids.entityType = "subscription_pickup_request"`
  - `ids.pickupRequestId` is present
  - `fulfillment.type = "branch_pickup"`
  - `fulfillment.pickup.mealCount` reflects the request meal count
  - reservation, consumption, and release flags are exposed from the pickup request
- Pickup request rows remain actionable even when no `SubscriptionDay` snapshot exists; the request meal count is used for queue summary when kitchen slot details are unavailable.

## Indexes And Constraints

- `Delivery`
  - Unique partial `{ dayId: 1 }`
  - Unique partial `{ subscriptionId: 1, date: 1 }`
  - Unique partial `{ orderId: 1 }`
- `SubscriptionDay`
  - Unique `{ subscriptionId: 1, date: 1 }`
  - Additional operational indexes for status/date lookups
- `SubscriptionPickupRequest`
  - Non-unique `{ subscriptionId: 1, date: 1, createdAt: -1 }`
  - Non-unique `{ subscriptionId: 1, status: 1 }`
  - Non-unique `{ userId: 1, date: 1, createdAt: -1 }`
  - Unique partial `{ subscriptionId: 1, userId: 1, idempotencyKey: 1 }`

## Tests

Focused coverage was added in `tests/homeDeliveryAndBranchPickupRules.test.js` for:

- Home Delivery three same-day meals with one kitchen row and one delivery visit.
- Duplicate dispatch not creating a second `Delivery`.
- Fulfillment not double-deducting day credits.
- Branch Pickup reservation on request creation.
- Idempotent retry not reserving again.
- Fulfillment not decrementing remaining meals again.
- Multiple same-day pickup requests exhausting balance.
- Extra pickup request failing with `INSUFFICIENT_CREDITS`.
- Cancel releasing reserved balance.
- No-show consuming reserved balance without release.
