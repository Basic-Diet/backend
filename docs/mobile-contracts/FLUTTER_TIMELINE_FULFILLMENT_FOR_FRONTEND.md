# Flutter Timeline & Fulfillment Frontend Contract

This file is the implementation contract for the Flutter team. It focuses on what the app must render, which form controls to use, which payloads to send, and which response fields drive each UI state.

Base API prefix: `/api`

Auth header for every endpoint:

```http
Authorization: Bearer <client JWT>
Content-Type: application/json
```

## 1. Main Screens

| Screen | Primary endpoint | Purpose |
| --- | --- | --- |
| Subscription timeline | `GET /api/subscriptions/:id/timeline` | Calendar/list of all subscription days and their display status. |
| Day fulfillment details | `GET /api/subscriptions/:id/days/:date/fulfillment/status` | Current pickup/delivery progress for one day. |
| Pickup item selection | `GET /api/subscriptions/:id/pickup-availability?date=YYYY-MM-DD` | Selectable meals/add-ons for a pickup-capable day. |
| Pickup request confirmation | `POST /api/subscriptions/:id/pickup-requests` | Reserve selected items and ask kitchen/branch to prepare pickup. |
| Pickup request tracking | `GET /api/subscriptions/:id/pickup-requests/:requestId/status` | Poll until ready/completed/terminal. |

## 2. Timeline Status Rules

Use `days[].status` for the calendar badge shown in the timeline list.

Use `days[].dayStatus` only on detail screens when you need the precise backend operational state.

| `status` | Arabic label | UI meaning | Icon suggestion | Tap behavior |
| --- | --- | --- | --- | --- |
| `open` | مفتوح | Day can still be planned or viewed. | empty square | Open planner/details if `canEdit=true`; otherwise open details only. |
| `planned` | مخطط | Meals are selected, confirmed, and payment is settled. | check circle | Open day details. |
| `locked` | مقفل | Day is no longer editable or is being prepared/delivered/ready. | lock | Open fulfillment details; do not show edit controls. |
| `delivered` | تم التوصيل | Fulfilled day. | filled check | Open read-only summary. |
| `delivery_canceled` | تم إلغاء التوصيل | Delivery was canceled. | delivery truck/off | Open read-only reason if available. |
| `canceled_at_branch` | ملغي في الفرع | Branch pickup/order was canceled at branch. | store/off | Open read-only reason if available. |
| `no_show` | لم يستلم | Prepared pickup was not collected. | user off | Open read-only summary. |
| `consumed_without_preparation` | تم احتساب اليوم | Pickup day ended without preparation and was consumed by policy. | calendar check | Open read-only summary. |
| `frozen` | مجمد | Day is frozen. | snowflake | Open read-only frozen state. |
| `skipped` | تم تخطيه | Day was skipped. | x circle | Open read-only skipped state. |
| `extension` | تمديد | Compensation/extension day. | plus circle | Open planner/details using normal day rules. |

Precise `dayStatus` values can be:

```txt
open
locked
in_preparation
out_for_delivery
ready_for_pickup
ready_for_delivery
fulfilled
delivery_canceled
canceled_at_branch
no_show
consumed_without_preparation
frozen
skipped
```

Important: `in_preparation`, `out_for_delivery`, `ready_for_pickup`, and `ready_for_delivery` all render as timeline `status = "locked"` because the day is not editable.

## 3. Timeline Endpoint

```http
GET /api/subscriptions/:id/timeline
```

No body.

Success response:

```json
{
  "status": true,
  "data": {
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "dailyMealsRequired": 2,
    "premiumMealsRemaining": 0,
    "premiumMealsSelected": 0,
    "premiumBalanceBreakdown": [],
    "days": [
      {
        "date": "2026-07-01",
        "day": "الأربعاء",
        "month": "يوليو",
        "dayNumber": 1,
        "deliveryMode": "delivery",
        "status": "locked",
        "dayStatus": "in_preparation",
        "statusLabel": "مغلق",
        "isPast": false,
        "selectedMeals": 2,
        "requiredMeals": 2,
        "hasSelection": true,
        "selectionStatus": "confirmed",
        "paymentStatus": "not_required",
        "timelineStatus": "planned",
        "isPlanned": true,
        "canShowAsPlanned": true,
        "canEdit": false,
        "commercialState": "confirmed",
        "isFulfillable": true,
        "canBePrepared": false,
        "fulfillmentMode": "pickup",
        "planningReady": true,
        "fulfillmentReady": true,
        "deliveryWindow": null,
        "deliveryAddress": null,
        "pickupLocation": {
          "id": "branch_main_override",
          "name": "Branch Main",
          "address": "Branch St",
          "phone": "+966500000000"
        },
        "lockedReason": "DAY_LOCKED",
        "lockedMessage": "تم تثبيت طلب اليوم ولا يمكن تعديله الآن",
        "selectedMealIds": [],
        "mealSlots": []
      }
    ]
  }
}
```

Frontend rendering rules:

| Field | Use |
| --- | --- |
| `date` | Stable date key and request param for day endpoints. |
| `day`, `month`, `dayNumber` | Timeline card labels. |
| `status` | Badge/icon/status legend. |
| `statusLabel` | Text shown on card. |
| `dayStatus` | Detail/subtitle/progress state only. |
| `canEdit` | Show or hide meal editing CTA. |
| `fulfillmentMode` | `pickup` means branch pickup flow; `delivery` means delivery flow; other values are not pickup/delivery actions. |
| `planningReady` | Meal selections are complete enough for execution. |
| `fulfillmentReady` | Operationally ready to be prepared/fulfilled. |
| `lockedReason`, `lockedMessage` | Show when controls are disabled. |

## 4. Checkout Form

Endpoint:

```http
POST /api/subscriptions/checkout
```

Form controls:

| Field | UI control | Required | Options / validation |
| --- | --- | --- | --- |
| `planId` | select box | yes | Plan IDs from package/plan listing. Send selected string ID. |
| `grams` | select box or stepper | yes | Backend-supported gram options from selected plan. Example: `150`, `200`, `250`. |
| `mealsPerDay` | select box or stepper | yes | Backend-supported plan options. Example: `1`, `2`, `3`. |
| `startDate` | date picker | yes | `YYYY-MM-DD`. |
| `delivery.type` | segmented control | yes | `delivery` or `pickup`. |
| `delivery.address.*` | text inputs | required only when `delivery.type=delivery` | `street`, `city`, `district`, `building`, `apartment`, `notes`. |
| `delivery.zoneId` | select box | required only when `delivery.type=delivery` | Delivery zone ID. |
| `delivery.slot` | select box | required only when `delivery.type=delivery` | Send full selected slot object. |
| `delivery.pickupLocationId` | select box | required only when `delivery.type=pickup` | Branch ID. |
| `delivery.firstDayFulfillmentOverride.type` | optional select box | no | Only option currently supported: `pickup`. Use only when root `delivery.type=delivery`. |
| `delivery.firstDayFulfillmentOverride.pickupLocationId` | optional select box | required when override exists | Branch ID for Day 1 pickup. |
| `idempotencyKey` | hidden generated value | yes | UUID/string reused for retry of same checkout tap. |

Delivery checkout payload:

```json
{
  "planId": "658dc7a1e4b0c53c8a98a002",
  "grams": 200,
  "mealsPerDay": 2,
  "startDate": "2026-07-01",
  "delivery": {
    "type": "delivery",
    "address": {
      "street": "Olaya St",
      "city": "Riyadh",
      "district": "Olaya",
      "building": "12",
      "apartment": "4B",
      "notes": "Deliver after 4 PM"
    },
    "zoneId": "658dc7c2e4b0c53c8a98a011",
    "slot": {
      "slotId": "delivery_slot_1",
      "window": "16:00-18:00",
      "label": "Evening Delivery"
    },
    "firstDayFulfillmentOverride": {
      "type": "pickup",
      "pickupLocationId": "branch_main_override"
    }
  },
  "idempotencyKey": "checkout-uuid-123"
}
```

Pickup checkout payload:

```json
{
  "planId": "658dc7a1e4b0c53c8a98a002",
  "grams": 200,
  "mealsPerDay": 2,
  "startDate": "2026-07-01",
  "delivery": {
    "type": "pickup",
    "pickupLocationId": "branch_main"
  },
  "idempotencyKey": "checkout-uuid-456"
}
```

Success response:

```json
{
  "status": true,
  "data": {
    "draftId": "658ddf81e4b0c53c8a98c005",
    "status": "pending_payment",
    "paymentUrl": "https://checkout.moyasar.com/verify/...",
    "breakdown": {
      "basePlanPriceHalala": 60000,
      "deliveryFeeHalala": 1000,
      "vatHalala": 9150,
      "totalHalala": 70150,
      "currency": "SAR"
    }
  }
}
```

## 5. Fulfillment Status Endpoint

```http
GET /api/subscriptions/:id/days/:date/fulfillment/status
```

No body.

Use this endpoint when a timeline day is tapped, especially when `status="locked"` or `fulfillmentMode` is `pickup`/`delivery`.

Success response:

```json
{
  "status": true,
  "data": {
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "date": "2026-07-01",
    "deliveryMode": "delivery",
    "fulfillmentModeOverride": "pickup",
    "effectiveFulfillmentMode": "pickup",
    "pickupLocationIdOverride": "branch_main_override",
    "firstDayFulfillmentOverride": true,
    "status": "in_preparation",
    "statusLabel": "قيد التحضير",
    "message": "المطبخ يجهز طلبك الآن",
    "nextAction": "poll_pickup_request_status",
    "isTerminal": false,
    "pollingIntervalSeconds": 30,
    "fulfillmentSummary": {
      "mode": "pickup",
      "title": "الاستلام من الفرع",
      "status": "in_preparation",
      "statusLabel": "قيد التحضير",
      "message": "المطبخ يجهز طلبك الآن",
      "nextAction": "poll_pickup_request_status",
      "isEditable": false,
      "isFulfillable": true,
      "planningReady": true,
      "fulfillmentReady": true,
      "lockedReason": null,
      "lockedMessage": null
    },
    "deliveryAddress": null,
    "deliveryWindow": null,
    "deliverySlot": {
      "type": "delivery",
      "slotId": "delivery_slot_1",
      "window": "16:00-18:00",
      "label": "Evening Delivery"
    },
    "pickupLocation": {
      "id": "branch_main_override",
      "name": "Branch Main",
      "address": "Branch St",
      "phone": "+966500000000",
      "city": "Riyadh",
      "district": "Olaya",
      "workingHours": "08:00 - 23:00",
      "latitude": 24.7136,
      "longitude": 46.6753,
      "mapUrl": "https://maps.google.com/..."
    },
    "pickupCode": null,
    "planningReady": true,
    "fulfillmentReady": true,
    "isFulfillable": true,
    "canBePrepared": true
  }
}
```

Polling:

| Condition | Flutter behavior |
| --- | --- |
| `isTerminal=true` | Stop polling. |
| `pollingIntervalSeconds` is a number | Poll using that interval. |
| `nextAction="poll_pickup_request_status"` | Prefer pickup request status if you have a `requestId`; otherwise keep fulfillment status polling. |

## 6. Pickup Availability Form

Endpoint:

```http
GET /api/subscriptions/:id/pickup-availability?date=YYYY-MM-DD&includeUnavailable=false&includeHistory=false
```

Query controls:

| Field | UI control | Required | Options |
| --- | --- | --- | --- |
| `date` | hidden selected timeline date or date picker | yes | `YYYY-MM-DD`; must be current KSA business date for pickup request creation. |
| `includeUnavailable` | toggle | no | `false` default. Use `true` only for debug/disabled UI display. |
| `includeHistory` | toggle | no | `false` default. Use `true` only if showing previous request history. |

Success response:

```json
{
  "status": true,
  "data": {
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "date": "2026-07-01",
    "subscriptionDayId": "658ddfa5e4b0c53c8a98e456",
    "remainingMeals": 11,
    "wallet": {
      "remainingMeals": 11,
      "availableMeals": 11,
      "reservedMeals": 1,
      "consumedMeals": 0,
      "totalEntitlement": 12
    },
    "summary": {
      "availableSelectableCount": 2,
      "canCreatePickupRequest": true,
      "canAppendMeals": true,
      "appendLimit": 11,
      "titleAr": "عناصر متاحة للاستلام",
      "titleEn": "Items available for pickup"
    },
    "pickupItems": [
      {
        "itemId": "slot_1",
        "itemType": "meal",
        "label": "Beef Burger",
        "selectionMode": "independent",
        "availability": {
          "available": true,
          "canSelect": true,
          "state": "available"
        }
      }
    ],
    "availableSlotIds": ["slot_1"],
    "unavailableSlotIds": []
  }
}
```

Pickup selection controls:

| Source field | UI control | Send field |
| --- | --- | --- |
| `pickupItems[]` where `availability.canSelect=true` | multi-select checklist | `selectedPickupItemIds` |
| `availableSlotIds[]` | multi-select checklist fallback for meal slots | `selectedMealSlotIds` |
| `remainingMeals` / `summary.appendLimit` | numeric stepper limit | `mealCount`, only for legacy count-based pickup without explicit item IDs |

Disable confirm button when `summary.canCreatePickupRequest=false`.

## 7. Create Pickup Request

```http
POST /api/subscriptions/:id/pickup-requests
```

Form controls:

| Field | UI control | Required | Options / validation |
| --- | --- | --- | --- |
| `date` | hidden selected timeline date | yes | `YYYY-MM-DD`. |
| `mealCount` | numeric stepper | conditional | Required only when not sending explicit item IDs. Minimum `1`; maximum `summary.appendLimit`. |
| `selectedPickupItemIds` | multi-select checklist | preferred | Values from `pickupItems[].itemId`. |
| `selectedMealSlotIds` | multi-select checklist fallback | optional | Values from `availableSlotIds[]`. |
| `idempotencyKey` | hidden generated value | yes | Reuse for retry of the same confirmation tap. |

Preferred payload using pickup item IDs:

```json
{
  "date": "2026-07-01",
  "selectedPickupItemIds": ["slot_1"],
  "idempotencyKey": "pickup-uuid-123"
}
```

Legacy fallback payload using only slot IDs:

```json
{
  "date": "2026-07-01",
  "selectedMealSlotIds": ["slot_1"],
  "idempotencyKey": "pickup-uuid-124"
}
```

Legacy count-only payload, only when the UI is not selecting specific items:

```json
{
  "date": "2026-07-01",
  "mealCount": 1,
  "idempotencyKey": "pickup-uuid-125"
}
```

Do not send the same meal slot in both `selectedPickupItemIds` and `selectedMealSlotIds`. Prefer `selectedPickupItemIds` for the new Flutter flow.

Success response:

```json
{
  "status": true,
  "data": {
    "requestId": "658de120e4b0c53c8a98f789",
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "subscriptionDayId": "658ddfa5e4b0c53c8a98e456",
    "date": "2026-07-01",
    "mealCount": 1,
    "selectedMealSlotIds": ["slot_1"],
    "selectedPickupItemIds": ["slot_1"],
    "selectedPickupItems": [
      {
        "itemId": "slot_1",
        "itemType": "meal",
        "label": "Beef Burger"
      }
    ],
    "addonCount": 0,
    "itemCount": 1,
    "selectionMode": "pickup_item_ids",
    "currentStep": 2,
    "status": "locked",
    "statusLabel": "Your order is locked",
    "message": "Modification period has ended. Waiting for kitchen.",
    "isReady": false,
    "isCompleted": false,
    "pickupCode": null,
    "createdAt": "2026-06-26T18:05:00.000Z",
    "creditsReserved": true,
    "idempotent": false,
    "nextAction": "poll_pickup_request_status"
  }
}
```

After success:

1. Store `requestId`.
2. Show locked/waiting state.
3. Poll `GET /api/subscriptions/:id/pickup-requests/:requestId/status`.
4. Refresh timeline; the day should render as `status="locked"`.

## 8. Pickup Request Status

```http
GET /api/subscriptions/:id/pickup-requests/:requestId/status
```

No body.

Success response:

```json
{
  "status": true,
  "data": {
    "requestId": "658de120e4b0c53c8a98f789",
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "subscriptionDayId": "658ddfa5e4b0c53c8a98e456",
    "date": "2026-07-01",
    "mealCount": 1,
    "currentStep": 4,
    "status": "ready_for_pickup",
    "statusLabel": "Your order is ready",
    "message": "Use this pickup code at the branch.",
    "isReady": true,
    "isCompleted": false,
    "pickupCode": "9812",
    "pickupCodeIssuedAt": "2026-06-26T18:15:00.000Z",
    "fulfilledAt": null,
    "creditsReserved": true,
    "nextAction": "poll_pickup_request_status"
  }
}
```

Status rendering:

| `status` | UI |
| --- | --- |
| `locked` | Waiting for kitchen. Hide pickup code. |
| `in_preparation` | Kitchen preparing. Hide pickup code. |
| `ready_for_pickup` | Ready. Show `pickupCode`. |
| `fulfilled` | Completed. Stop polling. |
| `no_show` | Final no-show. Stop polling. |
| `canceled` | Final canceled. Stop polling. |

## 9. List Pickup Requests

```http
GET /api/subscriptions/:id/pickup-requests?date=YYYY-MM-DD&status=active
```

Query controls:

| Field | UI control | Required | Options |
| --- | --- | --- | --- |
| `date` | optional date filter | no | `YYYY-MM-DD`. |
| `status` | select box | no | `all`, `active`. Default is `all`. |

Success response:

```json
{
  "status": true,
  "data": {
    "requests": [
      {
        "requestId": "658de120e4b0c53c8a98f789",
        "subscriptionId": "658ddf9de4b0c53c8a98d123",
        "subscriptionDayId": "658ddfa5e4b0c53c8a98e456",
        "date": "2026-07-01",
        "mealCount": 1,
        "status": "locked",
        "statusLabel": "Your order is locked",
        "message": "Modification period has ended. Waiting for kitchen.",
        "isReady": false,
        "isCompleted": false,
        "pickupCode": null,
        "createdAt": "2026-06-26T18:05:00.000Z"
      }
    ]
  }
}
```

## 10. Error Handling

All errors use:

```json
{
  "status": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Important codes:

| Code | UI action |
| --- | --- |
| `INVALID_DELIVERY_MODE` | Do not show pickup CTA. This date is delivery-only. |
| `INVALID_DATE` | Show date invalid/current-day-only message. |
| `DAY_SKIPPED` | Show skipped/frozen read-only state. |
| `LOCKED` | Refresh timeline and show locked status. |
| `INSUFFICIENT_CREDITS` | Show balance error; reduce `mealCount`. |
| `SUB_INACTIVE` / `SUB_EXPIRED` | Show inactive subscription message. |
| `PLANNING_UNCONFIRMED` | Send user back to confirm meal plan. |
| `PREMIUM_PAYMENT_REQUIRED` | Open payment flow before pickup request. |

## 11. First Day Delivery-to-Pickup Override

If checkout root `delivery.type="delivery"` and `firstDayFulfillmentOverride.type="pickup"`:

| Day | Timeline `fulfillmentMode` | Pickup availability/request |
| --- | --- | --- |
| Day 1 | `pickup` | Allowed if other rules pass. |
| Day 2+ | `delivery` | Must return `INVALID_DELIVERY_MODE` for pickup endpoints. |

Flutter must not infer pickup from root `deliveryMode`. Always use the day-level `fulfillmentMode` from timeline/status responses.

## 12. Final Flutter Checklist

- Render timeline card badge from `days[].status`, not `timelineStatus`.
- Show precise detail progress from `dayStatus` or fulfillment status endpoint.
- Hide edit controls whenever `canEdit=false`.
- Show pickup CTA only when `fulfillmentMode="pickup"` and `canBePrepared=true` or pickup availability says `canCreatePickupRequest=true`.
- For pickup item selection, use multi-select from `pickupItems[].itemId`.
- Send stable `idempotencyKey` for checkout and pickup request retries.
- Show `pickupCode` only when request status is `ready_for_pickup`.
- Stop polling when `isTerminal=true`, pickup request is `fulfilled`, `no_show`, or `canceled`.
