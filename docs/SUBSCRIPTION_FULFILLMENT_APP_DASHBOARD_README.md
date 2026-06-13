# Subscription Fulfillment App and Dashboard Integration

Backend lifecycle source of truth: [SUBSCRIPTION_FULFILLMENT_BACKEND_README.md](./SUBSCRIPTION_FULFILLMENT_BACKEND_README.md).

## Frontend Responsibilities

- Mobile app plans/selects meals, addons, and premium options.
- Mobile app creates pickup requests for Branch Pickup.
- Dashboard reads the kitchen queue and performs operational actions.
- Dashboard must never invent lifecycle rules that contradict the backend action contract.

## Mobile App Branch Pickup Flow

1. User opens a subscription day.
2. User selects meal(s), addon(s), and premium options if any.
3. App saves meal selection/planner state.
4. If the user wants branch pickup, app must explicitly call:

```http
POST /api/subscriptions/:subscriptionId/pickup-requests
```

5. App sends `date`, `mealCount`, and `idempotencyKey`.
6. App shows waiting-for-kitchen state while `status = locked`.
7. App polls pickup request status or refreshes subscription status.
8. App shows pickup code only after `ready_for_pickup`.
9. App shows completed after `fulfilled`.

Warning: saving or locking a `subscription_day` is not enough. It does not create an operational pickup request and will not make the dashboard preparation button appear.

## Mobile App Home Delivery Flow

- No separate pickup request is created.
- Delivery/home lifecycle is based on `subscription_day` and the related delivery row.
- App should show delivery status according to subscription/queue status.
- Do not call the pickup request endpoint for Home Delivery.

Expected Home Delivery action progression:

```txt
open/locked -> prepare -> in_preparation -> dispatch -> out_for_delivery -> fulfill -> fulfilled/delivered
```

## Pickup Request API Contract

```http
POST /api/subscriptions/:subscriptionId/pickup-requests
Authorization: Bearer <clientToken>
Content-Type: application/json
```

Body:

```json
{
  "date": "YYYY-MM-DD",
  "mealCount": 1,
  "idempotencyKey": "unique-client-generated-key"
}
```

Expected response:

```json
{
  "status": true,
  "data": {
    "requestId": "...",
    "subscriptionId": "...",
    "subscriptionDayId": "...",
    "date": "YYYY-MM-DD",
    "mealCount": 1,
    "currentStep": 2,
    "status": "locked",
    "isReady": false,
    "isCompleted": false,
    "pickupCode": null,
    "creditsReserved": true,
    "nextAction": "poll_pickup_request_status"
  }
}
```

Auth rules:

- Use a client token.
- Admin, kitchen, and courier dashboard tokens must receive `403 FORBIDDEN`.
- Current backend accepts pickup requests only for today's date.

## Handling Multiple Meals/Pickups In App

- If the user wants more than one meal in the day, send the intended `mealCount`.
- Display and validate remaining meal balance before submit when available.
- Do not repeatedly submit the same user intent with different idempotency keys.
- If a request fails due to insufficient credits or duplicate constraints, show a clear message.
- Use a stable `idempotencyKey` for retry of the same button press.
- Use a new `idempotencyKey` only for a new user intent.
- Current backend tests confirm multiple pickup requests on the same date are allowed when each request has a distinct `idempotencyKey` and enough balance.

## Dashboard Queue Rendering Contract

Dashboard must call:

```http
GET /api/dashboard/kitchen/queue?date=YYYY-MM-DD
```

Render operational buttons from:

```txt
item.actions.allowed
```

Do not hardcode state transitions.

For each action, use:

- `action.id`
- `action.label`
- `action.endpoint`
- `action.method`
- `action.requiresReason`
- `item.ids.entityType`
- `item.ids.entityId`

Payload:

```json
{
  "entityType": "<item.ids.entityType>",
  "entityId": "<item.ids.entityId>"
}
```

If reason is required:

```json
{
  "entityType": "<item.ids.entityType>",
  "entityId": "<item.ids.entityId>",
  "payload": {
    "reason": "..."
  }
}
```

## Button Enablement Rules

```txt
prepare             enabled by canPrepare
ready_for_pickup    enabled by canReadyForPickup
fulfill             enabled by canFulfill
cancel              enabled by canCancel
no_show             enabled by canNoShow
reopen              enabled by canReopen
```

Important:

```txt
Do not disable ready_for_pickup because canFulfill=false.
canFulfill is expected to be false until ready_for_pickup succeeds.
```

## Dashboard Branch Pickup UI States

Locked pickup request:

```txt
status=locked
allowed=prepare,cancel
show clickable "تحضير الطلب"
```

In preparation:

```txt
status=in_preparation
allowed=ready_for_pickup,cancel
show clickable "جاهز للاستلام"
do not show fulfill yet
```

Ready for pickup:

```txt
status=ready_for_pickup
allowed=fulfill,no_show
show clickable "تسليم الطلب"
show no_show if permitted
```

Fulfilled:

```txt
status=fulfilled
no operational action except maybe details/reopen if allowed
```

Planned Branch Pickup day without request:

```txt
entityType=subscription_day
pickupRequestId=null
prepare disabled with PICKUP_REQUEST_REQUIRED
do not show "تحضير الطلب" as clickable
```

## Dashboard Home Delivery UI States

- `open` or `locked`: show `prepare` when `canPrepare`.
- `in_preparation`: show `dispatch` when allowed.
- `out_for_delivery`: show `fulfill` when `canFulfill`; show arrival/cancel actions only when backend returns them.
- `fulfilled`: no operational action except details.
- `delivery_canceled`: show `reopen` only when returned by backend.

Dashboard labels may use:

- `prepare`: تحضير الطلب
- `ready_for_pickup`: جاهز للاستلام
- `fulfill`: تسليم الطلب
- `cancel`: إلغاء

## UI Mistakes To Avoid

- Using `subscriptionDayId` instead of `ids.entityId` for pickup request action.
- Assuming every branch pickup row is a `subscription_day`.
- Hiding prepare because the row is `subscription_pickup_request`.
- Disabling `ready_for_pickup` based on `canFulfill`.
- Showing pickup code before backend returns one.
- Treating `remainingMeals` decrement after pickup request as a bug.
- Calling pickup request endpoint with admin token.
- Retrying with a new `idempotencyKey` after network timeout for the same user tap.

## Manual QA Checklist

Branch Pickup:

```txt
1. Create/select branch pickup subscription day.
2. Confirm queue row before pickup request is subscription_day with pickupRequestId=null and prepare disabled.
3. App calls pickup request endpoint with client token.
4. Queue row becomes subscription_pickup_request.
5. Prepare button appears and is clickable.
6. Direct ready_for_pickup before prepare fails if tested via API.
7. Click prepare.
8. Queue shows ready_for_pickup button enabled.
9. Click ready_for_pickup.
10. Pickup code appears.
11. Fulfill button appears and is clickable.
12. Click fulfill.
13. remainingMeals does not decrement again.
```

Home Delivery:

```txt
1. Create/select home delivery subscription day.
2. Confirm queue uses delivery/home lifecycle.
3. Prepare works.
4. Dispatch/out_for_delivery works if applicable.
5. Fulfill/delivered works.
```
