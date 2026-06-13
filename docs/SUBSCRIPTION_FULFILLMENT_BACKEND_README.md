# Subscription Fulfillment Backend Lifecycle

Source of truth for app/dashboard integration: [SUBSCRIPTION_FULFILLMENT_APP_DASHBOARD_README.md](./SUBSCRIPTION_FULFILLMENT_APP_DASHBOARD_README.md).

## Entities

- `subscription`: the user's plan contract and meal balance. `remainingMeals` is the authoritative remaining balance.
- `subscription_day`: the scheduled/planned day for a subscription. It stores selected meals, delivery mode context, and day status.
- `subscription_pickup_request`: the actual Branch Pickup operation created by the client app. It reserves meal credits and receives kitchen actions.
- Order/delivery entities: one-time orders and delivery rows use the same dashboard operation surface where relevant. Home Delivery subscription fulfillment uses `subscription_day` plus the delivery record.
- Kitchen queue item: normalized dashboard payload returned by `GET /api/dashboard/kitchen/queue?date=YYYY-MM-DD`.
- Operational action: a dashboard command posted to `/api/dashboard/ops/actions/:action` with `entityType` and `entityId`.

## Core Invariant

`subscription_day = planning/scheduled day`

`subscription_pickup_request = actual branch pickup operation`

A Branch Pickup `subscription_day` with `pickupRequestId = null` is visible as planning context only. It is not an operational pickup row and must not be prepared, readied, fulfilled, or marked no-show.

## Home Delivery Lifecycle

Home Delivery uses `subscription_day` as the operational row when delivery is planned.

Expected current flow:

```txt
subscription_day open/locked
-> prepare
-> in_preparation
-> dispatch
-> out_for_delivery
-> fulfill
-> fulfilled
```

Current backend action names are:

- `prepare`: starts kitchen preparation and sets the day to `in_preparation`.
- `dispatch`: moves the day to `out_for_delivery` and syncs the delivery row.
- `fulfill`: completes the day as `fulfilled` and syncs delivery status to `delivered`.
- `cancel`: moves the day to `delivery_canceled`.
- `reopen`: reopens canceled subscription days where allowed.

## Branch Pickup Lifecycle

A Branch Pickup `subscription_day` alone is not operational:

```txt
subscription_day with fulfillment.type=branch_pickup and pickupRequestId=null
=> prepare blocked
=> reason PICKUP_REQUEST_REQUIRED
```

The operational flow starts only when the client app creates a pickup request:

```http
POST /api/subscriptions/:subscriptionId/pickup-requests
```

That creates a `subscription_pickup_request`:

```txt
entityType = subscription_pickup_request
pickupRequestId = requestId
status = locked
creditsReserved = true
```

Operational flow:

```txt
locked
-> prepare
-> in_preparation
-> ready_for_pickup
-> fulfill
-> fulfilled
```

`prepare` sets `preparationStartedAt` and `pickupPreparedAt`; it does not issue `pickupCode`. `ready_for_pickup` issues `pickupCode` and enables `fulfill` and `no_show`.

## State/Action Matrix

| Entity type | Status | Required ids | Allowed actions | Blocked actions | Notes |
| --- | --- | --- | --- | --- | --- |
| `subscription_day` branch pickup | `open` or `locked` | `ids.subscriptionDayId`; `ids.pickupRequestId = null` | Non-operational display only | `prepare`, `ready_for_pickup`, `fulfill`, `no_show` | Queue returns `disabled.prepare.reason = PICKUP_REQUEST_REQUIRED`. |
| `subscription_pickup_request` | `locked` | `ids.entityType`, `ids.entityId`, `ids.pickupRequestId` | `prepare`, `cancel` | `ready_for_pickup`, `fulfill`, `no_show` | Dashboard-facing action id is `prepare`; legacy alias `start_preparation` is still accepted. |
| `subscription_pickup_request` | `in_preparation` | same | `ready_for_pickup`, `cancel` | `prepare`, `fulfill`, `no_show` | `timestamps.preparedAt` is non-null. |
| `subscription_pickup_request` | `ready_for_pickup` | same | `fulfill`, `no_show` | `prepare`, `ready_for_pickup` | `pickupCode` has been issued. |
| `subscription_pickup_request` | `fulfilled` | same | none | `prepare`, `ready_for_pickup`, `fulfill`, `cancel`, `no_show` | Reserved credits are consumed; `remainingMeals` must not decrement again. |
| `subscription_pickup_request` | `no_show` | same | none | all operational actions | Reserved credits are consumed without releasing balance. |
| `subscription_pickup_request` | `canceled` | same | none | all operational actions | Reserved credits are released before consumption. |
| Home Delivery `subscription_day` | `open` | `ids.entityType=subscription_day`, `ids.entityId` | `prepare`, `lock`, `cancel` | `dispatch`, `fulfill` | `prepare` moves to `in_preparation`. |
| Home Delivery `subscription_day` | `locked` | same | `prepare`, `reopen`, `cancel` | `dispatch`, `fulfill` | `prepare` moves to `in_preparation`. |
| Home Delivery `subscription_day` | `in_preparation` | same | `dispatch`, `cancel` | `fulfill` | `dispatch` moves to `out_for_delivery`. |
| Home Delivery `subscription_day` | `out_for_delivery` | same | `notify_arrival`, `fulfill`, `cancel` | `prepare`, `dispatch` | `fulfill` moves to `fulfilled` and delivery row to `delivered`. |
| Home Delivery `subscription_day` | `fulfilled` | same | none | all operational actions | Final state. |

## Backend Transition Rules

- `locked/open -> ready_for_pickup` is invalid for pickup requests.
- `ready_for_pickup` requires `in_preparation`.
- `fulfill` requires `ready_for_pickup`.
- `no_show` is only valid from `ready_for_pickup`.
- `pickupPreparedAt` and `preparationStartedAt` are set by `prepare`.
- `pickupCode` is issued only by `ready_for_pickup`.
- Direct `ready_for_pickup` before `prepare` returns `HTTP 409` with `code = INVALID_TRANSITION`.
- Preparing a Branch Pickup `subscription_day` without a pickup request returns `HTTP 422` with `code = PICKUP_REQUEST_REQUIRED`.

## API Endpoints

### `POST /api/subscriptions/:subscriptionId/pickup-requests`

Auth: client app token only. Dashboard admin, kitchen, and courier tokens must receive `403 FORBIDDEN`.

Body:

```json
{
  "date": "YYYY-MM-DD",
  "mealCount": 1,
  "idempotencyKey": "unique-client-generated-key"
}
```

Effect: creates or idempotently returns a `subscription_pickup_request`, reserves `mealCount` from `subscription.remainingMeals`, sets `creditsReserved = true`, and returns status `locked`. Current implementation only accepts today's date.

### `GET /api/dashboard/kitchen/queue?date=YYYY-MM-DD`

Auth: authorized dashboard token. Returns normalized queue items. The dashboard must read `item.actions.allowed`, `item.actions.disabled`, and `item.ids`.

### `POST /api/dashboard/ops/actions/prepare`

Auth: dashboard admin/kitchen where policy allows. Body:

```json
{
  "entityType": "subscription_pickup_request",
  "entityId": "<requestId>"
}
```

Effect: `locked -> in_preparation`, sets preparation timestamps. For Home Delivery `subscription_day`, `open/locked -> in_preparation`.

### `POST /api/dashboard/ops/actions/start_preparation`

Auth: same as `prepare`. Effect: legacy alias for preparation. For pickup request queue rows, the compatibility action id exposed to dashboards is `prepare`.

### `POST /api/dashboard/ops/actions/ready_for_pickup`

Auth: dashboard admin/kitchen where policy allows. Effect: `subscription_pickup_request in_preparation -> ready_for_pickup`, issues `pickupCode`.

### `POST /api/dashboard/ops/actions/fulfill`

Auth: dashboard role allowed for the fulfillment mode. Effect: pickup request `ready_for_pickup -> fulfilled`; consumes reserved pickup credits without decrementing `remainingMeals` again. For Home Delivery, completes the `subscription_day` and marks the delivery row delivered.

### `POST /api/dashboard/ops/actions/cancel`

Auth: dashboard admin in current transition service. Body should include a reason, usually inside `payload.reason`.

Effect for pickup requests: cancels an unconsumed request and releases reserved credits back to `remainingMeals`. Cannot cancel after `fulfilled` or `no_show`.

### `POST /api/dashboard/ops/actions/no_show`

Auth: dashboard admin in current transition service. Body should include a reason. Effect: pickup request `ready_for_pickup -> no_show`; consumes reserved credits and does not release balance.

### `POST /api/dashboard/ops/actions/reopen`

Auth: dashboard admin. Effect: reopens supported canceled subscription/order states. Current `subscription_pickup_request` terminal states do not expose `reopen`.

### `POST /api/dashboard/ops/actions/dispatch`

Auth: dashboard admin/kitchen/courier where policy allows. Effect for Home Delivery: `subscription_day in_preparation -> out_for_delivery`.

## Credits and Meal Balance

- Pickup request creation reserves credits immediately by decrementing `subscription.remainingMeals` by `mealCount`.
- The request stores `creditsReserved = true` and `creditsReservedAt`.
- `fulfill` finalizes/consumes the reserved credits by setting `creditsConsumedAt`.
- `fulfill` must not decrement `remainingMeals` again.
- `cancel` before consumption releases reserved credits by setting `creditsReleasedAt` and incrementing `remainingMeals`.
- `no_show` consumes reserved credits by setting `creditsConsumedAt`; it does not release `remainingMeals`.
- Tests covering this behavior: `tests/subscriptionPickupRequestOps.test.js`, `tests/fulfillmentLifecyclePostmanSimulation.test.js`, and `tests/homeDeliveryAndBranchPickupRules.test.js`.

## Multiple Pickup Meals / Multiple Pickups Per Day

The primary supported flow is one pickup request per user action, with `mealCount` representing how many meals are reserved by that request. A user may receive more than one meal in a day by creating a pickup request with `mealCount > 1`, subject to available remaining meals and subscription/day constraints.

Current tests confirm the backend supports multiple pickup requests on the same date when each request uses a distinct `idempotencyKey`. Each request independently reserves credits, queue rows use their own `ids.entityId`, and fulfillment does not double decrement `remainingMeals`.

If this rule changes to one request per day later, the app must aggregate `mealCount` into that request instead of creating duplicates.

## Idempotency

- `idempotencyKey` is required/recommended for every client pickup request. Use body `idempotencyKey`.
- Retrying the same key returns the same request and does not reserve credits again.
- A different key represents a distinct user intent if allowed by balance and day constraints.
- Do not retry a network timeout with a new key for the same button press.

## Kitchen Queue Contract

Important fields:

- `ids.entityType`: action target entity type. Use this for dashboard action payloads.
- `ids.entityId`: action target id. Use this for dashboard action payloads.
- `ids.subscriptionDayId`: planning day id, not necessarily the action target.
- `ids.pickupRequestId`: actual pickup request id when present.
- `source.status`: current lifecycle status.
- `fulfillment.type`: `branch_pickup`, `home_delivery`, or other normalized type.
- `fulfillment.pickup.reserved`: whether pickup credits are reserved.
- `fulfillment.pickup.consumed`: whether reserved pickup credits are consumed.
- `fulfillment.pickup.pickupCodeState`: pickup code state.
- `payment.canPrepare`: payment/balance gate for preparation.
- `payment.canFulfill`: payment/balance gate for fulfillment.
- `actions.allowed`: authoritative list of enabled action objects.
- `actions.disabled`: disabled action objects and reasons, such as `PICKUP_REQUEST_REQUIRED`.
- `actions.canPrepare`, `actions.canReadyForPickup`, `actions.canFulfill`, `actions.canNoShow`: convenience booleans.
- `timestamps.preparedAt`: set after `prepare`.
- `timestamps.fulfilledAt`: set after fulfillment.

For a planned Branch Pickup day without a request, the queue must return:

```txt
entityType = subscription_day
fulfillment.type = branch_pickup
pickupRequestId = null
canPrepare = false
canReadyForPickup = false
canFulfill = false
canNoShow = false
disabled.prepare.reason = PICKUP_REQUEST_REQUIRED
```

## Regression Checklist

```bash
NODE_ENV=test node tests/dashboardKitchenQueueActions.test.js
NODE_ENV=test node tests/subscriptionPickupRequestOps.test.js
NODE_ENV=test node tests/fulfillmentLifecyclePostmanSimulation.test.js
NODE_ENV=test node tests/homeDeliveryAndBranchPickupRules.test.js
NODE_ENV=test node tests/opsPayloadService.test.js
npm run test:subscriptions
graphify update .
```

## Common Bugs To Avoid

- Treating `subscription_day` as a pickup operation.
- Allowing `ready_for_pickup` before `prepare`.
- Issuing pickup code during `prepare`.
- Double decrementing `remainingMeals`.
- Returning `start_preparation` only and breaking dashboards expecting `prepare`.
- Using `subscriptionDayId` as the action entity id for pickup request rows.
- Hiding `ready_for_pickup` because `canFulfill = false`.
