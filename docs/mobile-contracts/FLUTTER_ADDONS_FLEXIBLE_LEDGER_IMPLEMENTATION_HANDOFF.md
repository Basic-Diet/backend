# Flutter Add-ons Flexible Ledger Implementation Handoff

This document is an implementation-ready handoff for the Flutter mobile application development team (and Codex) to integrate the **Add-ons Flexible Total-Balance Ledger** flow. It details exact endpoint contracts, payload structures, UI mappings, and architectural rules directly derived from the audited backend source of truth.

---

## 1. TL;DR for Flutter Codex

- **Backward Compatibility**: Flutter does not need to change immediately if it keeps sending the old `addons: List<String>` checkout payload.
- **Old Payload Semantics**: Sending `addons: List<String>` defaults to `quantityPerDay = 1`.
- **New Optional Payload**: Supports explicit quantity per day via `addons: [{ addonPlanId, quantityPerDay }]`.
- **Checkout vs Daily Selections**: Checkout sends **add-on plan IDs** (`addonPlanId`). Daily selections in the planner send **add-on item/menu product IDs** (`addonsOneTime` / `oneTimeAddonSelections`).
- **No Client-Side Hard Caps**: Flutter **must not** use `maxPerDay` as a hard cap to block user selection in the UI.
- **Source of Truth for Status & Pricing**: Flutter must read `source` and `priceHalala` from backend validation/day load responses.
- **Included Add-ons**: `source = "subscription"` means the item is covered by the existing subscription balance (free/included, `priceHalala = 0`).
- **Overage Add-ons**: `source = "pending_payment"` means the selected quantity exceeds the remaining add-on balance and requires additional payment.

---

## 2. Backend source of truth

- **Backend Calculates Prices**: All quote totals, unit prices, and overage fees are computed exclusively on the backend.
- **Backend Calculates Add-on Balances**: The backend manages all consumption, reservations, and remaining quantities atomically.
- **Backend Decides Coverage**: The backend evaluates whether selected add-ons are covered by balance (`source = "subscription"`) or require payment (`source = "pending_payment"`).
- **No Client-Side Calculation**: Flutter **must not** calculate final quote totals or remaining balances by itself.
- **Display Only**: Flutter may display backend totals and balances directly as returned in DTOs.

---

## 3. Add-on rules

### Purchase balance rule
The total included quantity of add-on credits is determined at purchase time:
```text
includedTotalQty = basePlan.daysCount * quantityPerDay
```
**Examples**:
```text
7 days + juice quantityPerDay=1 => 7 credits
7 days + juice quantityPerDay=2 => 14 credits
14 days + juice quantityPerDay=1 => 14 credits
```

### Pricing rule
The add-on total price is resolved from the pricing matrix for the base plan:
```text
addonTotalPrice = matrixPriceForBasePlan * quantityPerDay
```
**Important**: Do **NOT** multiply by days again. The matrix price already reflects the flat price for the plan duration.

### Flexible use rule
Add-on balances function as flexible total buckets across the subscription lifespan:
```text
remainingQty=7, requested=6 => 6 subscription-covered (source: "subscription", priceHalala: 0)
remainingQty=1, requested=6 => 1 subscription-covered + 5 pending_payment (source: "pending_payment", priceHalala: unitPrice)
```

### maxPerDay rule
- `maxPerDay` may exist in plan or add-on metadata.
- Flutter **must not** block the user from selecting more items based only on `maxPerDay`.
- Backend validation is the sole authority for accepting or rejecting day selections.

---

## 4. Endpoint inventory

Based on the actual backend routing and controller structure in `src/routes/subscriptions.js`, the following mobile endpoints participate in the add-on lifecycle:

1. **Add-on choices/catalog**: `GET /api/subscriptions/addon-choices` (and `GET /api/subscriptions/addons/options`)
2. **Meal planner menu**: `GET /api/subscriptions/meal-planner-menu?includeLegacy=true`
3. **Subscription quote**: `POST /api/subscriptions/quote`
4. **Subscription create/checkout**: `POST /api/subscriptions/checkout`
5. **Current subscription overview/detail**: `GET /api/subscriptions/current/overview` (and `GET /api/subscriptions/:id`)
6. **Day load**: `GET /api/subscriptions/:id/days/:date`
7. **Day validate**: `POST /api/subscriptions/:id/days/:date/selection/validate`
8. **Day save/update**: `PUT /api/subscriptions/:id/days/:date/selection`
9. **Pending payment / add-on overage payment verification**: `POST /api/subscriptions/:id/days/:date/one-time-addons/payments` & `POST /api/subscriptions/:id/days/:date/one-time-addons/payments/:paymentId/verify` (as well as unified `POST /api/subscriptions/:id/days/:date/payments/:paymentId/verify`)
10. **Pickup availability/items**: `GET /api/subscriptions/:id/pickup-availability` & `POST /api/subscriptions/:id/pickup-requests`

---

## 5. Flutter screen map

### Auxiliary Endpoints Notice
Endpoints such as `GET /api/popular_packages` (base packages/plans), `GET /api/subscriptions/delivery-options`, and `GET /api/subscriptions/payment-methods` belong to the **Existing Flutter flow / verify separately**. They are referenced below to show where options originate in the UI, but are not modified by this add-ons handoff.

### A. Subscription checkout screen
This screen handles initial subscription purchase configuration.

| Screen | Field | UI Type | Options Source | Value Sent | Required | Notes |
| ------ | ----- | ------- | -------------- | ---------- | -------- | ----- |
| Subscription Checkout | Base subscription plan | select box | GET /api/popular_packages | planId | yes | Base plan selection (Existing Flutter flow / verify separately) |
| Subscription Checkout | Start date | date picker | local UI / calendar | YYYY-MM-DD string | yes | Must be future date following cutoff rules |
| Subscription Checkout | Add-ons | multi-select | GET /api/subscriptions/addon-choices | addonPlanId | no | Legacy sends `addons: string[]` |
| Subscription Checkout | Add-on quantityPerDay | number stepper | local UI | integer >= 1 | no | Optional future enhancement; defaults to 1 |
| Subscription Checkout | Premium upgrades | multi-select | GET /api/popular_packages | premiumItems array | no | Separate flow; consumes meal slots |
| Subscription Checkout | Delivery/pickup fields | select box | GET /api/subscriptions/delivery-options | deliveryMode & address | yes | Configures logistics (Existing Flutter flow / verify separately) |
| Subscription Checkout | Payment method | select box | GET /api/subscriptions/payment-methods | paymentMethod string | yes | ApplePay, Card, etc. (Existing Flutter flow / verify separately) |

### B. Daily planner screen
This screen allows modifying selections for a specific subscription day.

| Screen | Field | UI Type | Options Source | Value Sent | Required | Notes |
| ------ | ----- | ------- | -------------- | ---------- | -------- | ----- |
| Daily Planner | Meal slots | list/card item | GET /api/subscriptions/meal-planner-menu | mealSlots array | yes | Canonical meal slot definition |
| Daily Planner | Add-on item selections | multi-select | GET /api/subscriptions/meal-planner-menu | addonsOneTime array | no | Sends item/menu product IDs |
| Daily Planner | Included add-on badge | read-only label | Backend day load/validate response | N/A | no | Displayed when `source == "subscription"` |
| Daily Planner | Pending payment badge | read-only label | Backend day load/validate response | N/A | no | Displayed when `source == "pending_payment"` |
| Daily Planner | Confirm/save button | button/action | local UI | N/A | yes | Triggers PUT /selection |
| Daily Planner | Payment-required state | button/action | Backend day load/validate response | N/A | no | Triggers payment flow if pending items exist |

- **Multiple Selections**: Flutter can allow selecting multiple add-on items.
- **No Daily Cap**: Flutter should not hard cap by `maxPerDay`.
- **Contract Field**: Flutter sends selected add-on item IDs in `addonsOneTime` (or legacy `oneTimeAddonSelections`).
- **Dynamic Source**: Flutter reads backend responses to distinguish included items from pending payment items.

### C. Current subscription/details screen
This screen displays active subscription balances and metadata.

| Screen | Field | UI Type | Options Source | Value Sent | Required | Notes |
| ------ | ----- | ------- | -------------- | ---------- | -------- | ----- |
| Current Subscription | addonBalances | list/card item | GET /api/subscriptions/current/overview | N/A | no | List of active add-on balance buckets |
| Current Subscription | includedTotalQty | read-only label | GET /api/subscriptions/current/overview | N/A | no | Total credits purchased |
| Current Subscription | consumedQty | read-only label | GET /api/subscriptions/current/overview | N/A | no | Total credits already fulfilled |
| Current Subscription | reservedQty | read-only label | GET /api/subscriptions/current/overview | N/A | no | Total credits allocated to future planned days |
| Current Subscription | remainingQty | read-only label | GET /api/subscriptions/current/overview | N/A | no | Available credits for new selections |
| Current Subscription | pending payment add-ons | list/card item | GET /api/subscriptions/current/overview | N/A | no | Add-ons currently awaiting payment confirmation |

---

## 6. Endpoint documentation details

All endpoints expect standard authentication and localization headers:
```http
METHOD {{baseUrl}}/api/...
Authorization: Bearer {{mobileAccessToken}}
Accept: application/json
Accept-Language: ar
Content-Type: application/json
```

---

## 7. Add-on choices/catalog endpoint

### 1. Purpose
Retrieves available add-on plans for the initial subscription checkout screen.

### 2. Auth
Bearer Token (Optional/Required depending on context).

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`

### 4. Query params
`category` (optional string), `subscriptionId` (optional string)

### 5. Path params
None.

### 6. Request body
None.

### 7. Success response
```json
{
  "status": true,
  "data": [
    {
      "_id": "juiceAddonPlanId",
      "name": {
        "ar": "اشتراك العصير",
        "en": "Juice Subscription"
      },
      "category": "juice",
      "image": "https://storage.example.com/juice.png",
      "priceHalala": 7000,
      "maxPerDay": 1,
      "active": true
    }
  ]
}
```

### 8. Error response
```json
{
  "status": false,
  "error": {
    "code": "INVALID",
    "message": "Invalid add-on choice filters"
  }
}
```

### 9. Flutter UI mapping
| Response Field | Flutter Usage |
| -------------- | ------------- |
| addonPlanId/id | Send in checkout `addons` |
| itemId/menuProductId/addonId | Send in daily selection if applicable |
| name.ar/name.en | Display |
| priceHalala | Display only; backend recalculates |
| category | Grouping/filter |
| image | Card image |

### 10. Flutter implementation notes
- Use `_id` as `addonPlanId` for checkout.
- Do not use this endpoint for daily planner item selections (use `/meal-planner-menu` instead).

---

## 8. Subscription quote endpoint

### 1. Purpose
Calculates the exact pricing breakdown for a proposed subscription configuration.

### 2. Auth
Bearer Token.

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`, `Content-Type: application/json`

### 4. Query params
None.

### 5. Path params
None.

### 6. Request body

**Legacy Payload**:
```json
{
  "planId": "basePlanId",
  "startDate": "2026-07-01",
  "addons": ["juiceAddonPlanId"]
}
```

**New Optional Payload**:
```json
{
  "planId": "basePlanId",
  "startDate": "2026-07-01",
  "addons": [
    {
      "addonPlanId": "juiceAddonPlanId",
      "quantityPerDay": 2
    }
  ]
}
```

### Request Fields Table
| Field | UI Type | Required | Options Source | Value Sent | Notes |
| ----- | ------- | -------- | -------------- | ---------- | ----- |
| planId | select box | yes | GET /api/popular_packages | string ID | Base subscription package ID |
| startDate | date picker | yes | local UI | YYYY-MM-DD string | Start date |
| addons | multi-select | no | GET /api/subscriptions/addon-choices | array of strings or objects | Legacy strings default to quantityPerDay=1 |

### 7. Success response
```json
{
  "status": true,
  "data": {
    "summary": {
      "addons": [
        {
          "addonPlanId": "juiceAddonPlanId",
          "addonId": "juiceAddonPlanId",
          "name": {
            "ar": "اشتراك العصير",
            "en": "Juice Subscription"
          },
          "category": "juice",
          "quantityPerDay": 2,
          "daysCount": 7,
          "includedTotalQty": 14,
          "unitPlanPriceHalala": 7000,
          "priceHalala": 14000,
          "totalHalala": 14000,
          "currency": "SAR"
        }
      ]
    }
  }
}
```

### 8. Error response
```json
{
  "status": false,
  "error": {
    "code": "INVALID_ADDON",
    "message": "Selected add-on plan is invalid or inactive"
  }
}
```
*Other potential error codes*: `INVALID_PLAN`, `MISSING_MATRIX_PRICE`, `INVALID_QUANTITY`, `UNAUTHORIZED`.

### 9. Flutter UI mapping
- Display `summary.addons` breakdown directly in the quote summary screen.
- Show `includedTotalQty` as the total add-on items included in the subscription.
- Show `totalHalala` / 100 as the currency total.

### 10. Flutter implementation notes
- Flutter must never multiply `priceHalala` by `daysCount`. The backend `totalHalala` is the authoritative total.

---

## 9. Subscription create/checkout endpoint

### 1. Purpose
Creates a new subscription (or checkout draft) from the selected configuration.

### 2. Auth
Bearer Token.

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`, `Content-Type: application/json`

### 4. Query params
None.

### 5. Path params
None.

### 6. Request body

**Legacy Create Payload**:
```json
{
  "planId": "basePlanId",
  "startDate": "2026-07-01",
  "addons": ["juiceAddonPlanId"],
  "deliveryMode": "delivery",
  "deliveryAddress": { "city": "Riyadh", "street": "King Fahad Rd" }
}
```

**Quantity Create Payload**:
```json
{
  "planId": "basePlanId",
  "startDate": "2026-07-01",
  "addons": [
    {
      "addonPlanId": "juiceAddonPlanId",
      "quantityPerDay": 2
    }
  ],
  "deliveryMode": "delivery",
  "deliveryAddress": { "city": "Riyadh", "street": "King Fahad Rd" }
}
```

### 7. Success response
```json
{
  "status": true,
  "data": {
    "subscriptionId": "6a3e9f795e1d3a14abbef370",
    "status": "active",
    "paymentStatus": "paid",
    "checkoutDraftId": "6a3e9f795e1d3a14abbef371"
  }
}
```

### 8. Error response
```json
{
  "status": false,
  "error": {
    "code": "INCOMPLETE_PAYMENT_METHOD",
    "message": "Payment verification failed or missing required fields"
  }
}
```

### 9. Flutter UI mapping
- Navigate to success screen if `status == "active"` or `paymentStatus == "paid"`.
- If payment is required, redirect to WebView or payment flow using `checkoutDraftId`.

### 10. Flutter implementation notes
- Backend recalculates quote server-side. Do not attempt to pass client-calculated totals.
- Old `addons: string[]` works perfectly. New object payload is optional.

---

## 10. Current subscription overview/detail endpoint

### 1. Purpose
Fetches current metadata, status, and active flexible balances for a subscription.

### 2. Auth
Bearer Token.

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`

### 4. Query params
None.

### 5. Path params
None. (Utilizes `GET /api/subscriptions/current/overview` or `GET /api/subscriptions/:id`).

### 6. Request body
None.

### 7. Success response
```json
{
  "status": true,
  "data": {
    "_id": "6a3e9f795e1d3a14abbef370",
    "status": "active",
    "addonBalances": [
      {
        "addonPlanId": "juiceAddonPlanId",
        "addonId": "juiceAddonPlanId",
        "name": {
          "ar": "اشتراك العصير",
          "en": "Juice Subscription"
        },
        "category": "juice",
        "purchasedDailyQty": 1,
        "includedTotalQty": 7,
        "purchasedQty": 7,
        "consumedQty": 6,
        "reservedQty": 0,
        "remainingQty": 1,
        "currency": "SAR"
      }
    ]
  }
}
```

### 8. Error response
```json
{
  "status": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Subscription not found"
  }
}
```

### 9. Flutter UI mapping
| Response Field | Flutter UI Display Rule |
| -------------- | ----------------------- |
| includedTotalQty | Included = includedTotalQty |
| consumedQty | Used = consumedQty |
| reservedQty | Reserved = reservedQty |
| remainingQty | Remaining = remainingQty |

### 10. Flutter implementation notes
- **Compatibility**: Prefer `addonBalances` if present in the response. Fall back to `addonBalance` only if needed.
- **Do not calculate remaining from maxPerDay**. Always trust `remainingQty`.

---

## 11. Meal planner menu endpoint

### 1. Purpose
Retrieves the canonical catalog of meals and add-on items available for daily selection.

### 2. Auth
Bearer Token.

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`

### 4. Query params
`includeLegacy=true` (optional boolean, preserves legacy fields).

### 5. Path params
None.

### 6. Request body
None.

### 7. Success response
```json
{
  "status": true,
  "data": {
    "builderCatalog": {
      "contractVersion": "meal_planner_menu.v3",
      "currency": "SAR",
      "sections": []
    },
    "addonCatalog": {
      "items": [
        {
          "_id": "juiceItemId",
          "name": { "ar": "عصير برتقال", "en": "Orange Juice" },
          "category": "juice",
          "priceHalala": 1500,
          "available": true
        }
      ],
      "byCategory": {
        "juice": ["juiceItemId"]
      },
      "totalCount": 1
    }
  }
}
```

### 8. Error response
```json
{
  "status": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 9. Flutter UI mapping
- Render `addonCatalog.items` in the daily planner add-on selection drawer.
- Filter items using `addonCatalog.byCategory`.

### 10. Flutter implementation notes

```text
Checkout add-ons:
Send add-on plan IDs from /addon-choices.

Daily planner add-ons:
Send add-on item/menu product IDs from meal-planner-menu addonCatalog.
```

```text
Never send daily item IDs in checkout.
Never send add-on plan IDs in daily planner selection.
```

---

## 12. Day load endpoint

### 1. Purpose
Retrieves the current selections, meal slots, and add-ons for a specific subscription date.

### 2. Auth
Bearer Token.

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`

### 4. Query params
None.

### 5. Path params
`id` (Subscription ID string), `date` (YYYY-MM-DD string).
`GET /api/subscriptions/:id/days/:date`

### 6. Request body
None.

### 7. Success response
```json
{
  "status": true,
  "data": {
    "subscriptionId": "6a3e9f795e1d3a14abbef370",
    "date": "2026-07-01",
    "status": "planned",
    "commercialState": "payment_required",
    "mealSlots": [],
    "addonSelections": [
      {
        "addonId": "juiceItemId",
        "source": "subscription",
        "priceHalala": 0
      },
      {
        "addonId": "juiceItemId",
        "source": "pending_payment",
        "priceHalala": 1500
      }
    ]
  }
}
```

### 8. Error response
```json
{
  "status": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Day not found"
  }
}
```

### 9. Flutter UI mapping
- For each item in `addonSelections`:
  - If `source == "subscription"`, show an "Included" (مشمول) badge and price 0.
  - If `source == "pending_payment"`, show a "Payment Required" (مطلوب الدفع) badge with the unit price (`priceHalala` / 100).
- If `commercialState == "payment_required"`, display the payment checkout bar at the bottom of the planner screen.

### 10. Flutter implementation notes
- Do not assume items in `addonSelections` are free. Always parse `source` and `priceHalala`.

---

## 13. Day validate endpoint

### 1. Purpose
Performs dry-run validation and overage calculation for a proposed day selection without persisting changes.

### 2. Auth
Bearer Token.

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`, `Content-Type: application/json`

### 4. Query params
None.

### 5. Path params
`id` (Subscription ID string), `date` (YYYY-MM-DD string).
`POST /api/subscriptions/:id/days/:date/selection/validate`

### 6. Request body
```json
{
  "date": "2026-07-01",
  "mealSlots": [],
  "addonsOneTime": [
    "juiceItemId",
    "juiceItemId",
    "juiceItemId",
    "juiceItemId",
    "juiceItemId",
    "juiceItemId"
  ]
}
```
*(Note: `oneTimeAddonSelections` is also supported as a fallback field name).*

### 7. Success response

#### Case A: remainingQty=7, requested=6
```json
{
  "status": true,
  "data": {
    "isValid": true,
    "commercialState": "draft",
    "addonSelections": [
      { "addonId": "juiceItemId", "source": "subscription", "priceHalala": 0 },
      { "addonId": "juiceItemId", "source": "subscription", "priceHalala": 0 },
      { "addonId": "juiceItemId", "source": "subscription", "priceHalala": 0 },
      { "addonId": "juiceItemId", "source": "subscription", "priceHalala": 0 },
      { "addonId": "juiceItemId", "source": "subscription", "priceHalala": 0 },
      { "addonId": "juiceItemId", "source": "subscription", "priceHalala": 0 }
    ]
  }
}
```

#### Case B: remainingQty=1, requested=6
```json
{
  "status": true,
  "data": {
    "isValid": true,
    "commercialState": "payment_required",
    "addonSelections": [
      { "addonId": "juiceItemId", "source": "subscription", "priceHalala": 0 },
      { "addonId": "juiceItemId", "source": "pending_payment", "priceHalala": 1500 },
      { "addonId": "juiceItemId", "source": "pending_payment", "priceHalala": 1500 },
      { "addonId": "juiceItemId", "source": "pending_payment", "priceHalala": 1500 },
      { "addonId": "juiceItemId", "source": "pending_payment", "priceHalala": 1500 },
      { "addonId": "juiceItemId", "source": "pending_payment", "priceHalala": 1500 }
    ]
  }
}
```

### 8. Error response
```json
{
  "status": false,
  "error": {
    "code": "INVALID_ADDON_SELECTION",
    "message": "Addon item is inactive or unavailable for this date"
  }
}
```

### 9. Flutter UI mapping
- Show included badge for `source = subscription`.
- Show payment required badge for `source = pending_payment`.
- Do not mark pending items as free.
- Do not allow final confirmation if backend returns `commercialState == "payment_required"` without prompting payment.

### 10. Flutter implementation notes
- Call validate on selection change to update UI badges dynamically before the user presses save.

---

## 14. Day save/update endpoint

### 1. Purpose
Persists meal slot and add-on selections for a subscription day.

### 2. Auth
Bearer Token.

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`, `Content-Type: application/json`

### 4. Query params
None.

### 5. Path params
`id` (Subscription ID string), `date` (YYYY-MM-DD string).
`PUT /api/subscriptions/:id/days/:date/selection`

### 6. Request body

**Meals Only**:
```json
{
  "mealSlots": [
    { "slotIndex": 0, "selectionType": "standard_meal", "proteinId": "p1", "carbId": "c1" }
  ],
  "addonsOneTime": []
}
```

**Add-ons Only**:
```json
{
  "mealSlots": [],
  "addonsOneTime": ["juiceItemId", "juiceItemId"]
}
```

**Meals + Add-ons**:
```json
{
  "mealSlots": [
    { "slotIndex": 0, "selectionType": "standard_meal", "proteinId": "p1", "carbId": "c1" }
  ],
  "addonsOneTime": ["juiceItemId"]
}
```

**Add-ons with Pending Payment**:
```json
{
  "mealSlots": [],
  "addonsOneTime": ["juiceItemId", "juiceItemId", "juiceItemId", "juiceItemId", "juiceItemId", "juiceItemId"]
}
```

### 7. Success response
```json
{
  "status": true,
  "data": {
    "subscriptionId": "6a3e9f795e1d3a14abbef370",
    "date": "2026-07-01",
    "commercialState": "payment_required",
    "addonSelections": [
      { "addonId": "juiceItemId", "source": "subscription", "priceHalala": 0 },
      { "addonId": "juiceItemId", "source": "pending_payment", "priceHalala": 1500 }
    ]
  }
}
```

### 8. Error response
```json
{
  "status": false,
  "error": {
    "code": "CUTOFF_EXCEEDED",
    "message": "Cannot modify selections after cutoff time"
  }
}
```

### 9. Flutter UI mapping
- Included add-ons have `source = subscription`.
- Extra add-ons have `source = pending_payment`.
- Unpaid extras must not be treated as confirmed/free.
- If `commercialState == "payment_required"`, immediately trigger the payment flow.

### 10. Flutter implementation notes
- After a successful save, Flutter should refresh the day view to reflect accurate commercial and reservation states.

---

## 15. Add-on overage payment endpoint

### 1. Purpose
Creates and verifies payment for add-on overages (`pending_payment` items) on a planner day.

### 2. Auth
Bearer Token.

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`, `Content-Type: application/json`

### 4. Endpoints & Payloads

- **Initiate Endpoint**: `POST /api/subscriptions/:id/days/:date/one-time-addons/payments`
- **Initiate Request Body**:
```json
{
  "paymentMethod": "apple_pay",
  "successUrl": "app://basicdiet/payment/success",
  "backUrl": "app://basicdiet/payment/cancel"
}
```
- **Initiate Success Response**:
```json
{
  "status": true,
  "data": {
    "payment_url": "https://example.com/invoice123",
    "invoice_id": "inv_123",
    "payment_id": "6a3e9f795e1d3a14abbef370",
    "totalHalala": 1500
  }
}
```

- **Verify Endpoint**: `POST /api/subscriptions/:id/days/:date/one-time-addons/payments/:paymentId/verify` (as well as unified `POST /api/subscriptions/:id/days/:date/payments/:paymentId/verify`)
- **Verify Request Body**: None.
- **Verify Success Response**:
```json
{
  "status": true,
  "data": {
    "subscriptionId": "6a3e9f795e1d3a14abbef370",
    "dayId": "6a3e9f795e1d3a14abbef371",
    "date": "2026-07-01",
    "addonSelections": [
      { "addonId": "juiceItemId", "source": "one_time", "priceHalala": 1500 }
    ],
    "pendingCount": 0,
    "paymentId": "6a3e9f795e1d3a14abbef372",
    "paymentStatus": "paid",
    "isFinal": true,
    "amount": 1500,
    "currency": "SAR",
    "applied": true,
    "providerInvoiceId": "inv_123",
    "providerPaymentId": "pay_123",
    "createdAt": "2026-06-26T15:00:00.000Z",
    "updatedAt": "2026-06-26T15:01:00.000Z",
    "payment": {
      "id": "6a3e9f795e1d3a14abbef372",
      "provider": "moyasar",
      "type": "one_time_addon_day_planning",
      "status": "paid",
      "amount": 1500,
      "currency": "SAR",
      "providerInvoiceId": "inv_123",
      "providerPaymentId": "pay_123",
      "applied": true,
      "paidAt": "2026-06-26T15:01:00.000Z",
      "createdAt": "2026-06-26T15:00:00.000Z",
      "updatedAt": "2026-06-26T15:01:00.000Z"
    },
    "providerInvoice": {
      "id": "inv_123",
      "status": "paid",
      "amount": 1500,
      "currency": "SAR",
      "url": "https://example.com/invoice123",
      "updatedAt": "2026-06-26T15:01:00.000Z",
      "attemptsCount": 1
    },
    "checkedProvider": true,
    "synchronized": true
  }
}
```

```text
Flutter must use the actual payment initiation response field returned by backend. Do not invent paymentUrl if not present.
```

### 5. Flutter UI mapping
- Call initiate when user clicks "Pay Overage" on a `payment_required` day.
- Open payment gateway URL (`payment_url`) / sheet.
- On return, call verify endpoint.
- After success, show success toast and refresh day view.

### 6. Flutter implementation notes
- After successful payment verification, Flutter **must** refresh both the day details (`/days/:date`) and the subscription overview (`/current/overview`) to get updated balance quantities.

---

## 16. Pickup flow, if Flutter uses it

### 1. Purpose
Manages pickup preparation requests for subscription days.

### 2. Auth
Bearer Token.

### 3. Headers
`Authorization: Bearer {{mobileAccessToken}}`, `Accept-Language: ar`, `Content-Type: application/json`

### 4. Endpoints & Payloads
- **Availability Endpoint**: `GET /api/subscriptions/:id/pickup-availability?date=YYYY-MM-DD`
- **Pickup Request Endpoint**: `POST /api/subscriptions/:id/pickup-requests`
- **Payload**:
```json
{
  "date": "2026-07-01",
  "mealCount": 1,
  "selectedMealSlotIds": ["slot1"],
  "selectedPickupItemIds": ["juiceItemId"],
  "idempotencyKey": "unique_key_123"
}
```

```text
In this backend phase, the planner/day selection classifies add-ons as subscription-covered or pending_payment.
Pickup availability and pickup request payloads may include add-on pickup items, but Flutter must not assume pickup consumes or reserves addonBalances unless confirmed by the backend response/contract.
```

```text
Pickup add-on balance reservation/consumption: NOT GUARANTEED FOR FLUTTER / VERIFY BEFORE DEPENDING ON IT
```

---

## 17. Source field semantics

```text
source=subscription
Covered by included add-on balance, priceHalala must be 0.

source=pending_payment
Not covered by balance, requires payment before final confirmation.

source=wallet
Legacy/other paid coverage only if backend returns it.
Do not treat wallet as subscription balance.

source=one_time
Paid one-time item only if backend returns it.
```

---

## 18. Dart DTO suggestions

```dart
class LocalizedNameDto {
  final String ar;
  final String en;

  LocalizedNameDto({required this.ar, required this.en});

  factory LocalizedNameDto.fromJson(Map<String, dynamic> json) {
    return LocalizedNameDto(
      ar: json['ar'] as String? ?? '',
      en: json['en'] as String? ?? '',
    );
  }
}

class AddonChoiceDto {
  final String addonPlanId;
  final LocalizedNameDto name;
  final String category;
  final String? image;
  final int priceHalala;
  final int? maxPerDay;
  final bool active;

  AddonChoiceDto({
    required this.addonPlanId,
    required this.name,
    required this.category,
    this.image,
    required this.priceHalala,
    this.maxPerDay,
    required this.active,
  });

  factory AddonChoiceDto.fromJson(Map<String, dynamic> json) {
    return AddonChoiceDto(
      addonPlanId: json['_id'] as String? ?? json['id'] as String? ?? '',
      name: LocalizedNameDto.fromJson(json['name'] as Map<String, dynamic>? ?? {}),
      category: json['category'] as String? ?? '',
      image: json['image'] as String?,
      priceHalala: json['priceHalala'] as int? ?? 0,
      maxPerDay: json['maxPerDay'] as int?,
      active: json['active'] as bool? ?? true,
    );
  }
}

class QuoteAddonSummaryDto {
  final String addonPlanId;
  final String? addonId;
  final LocalizedNameDto name;
  final String category;
  final int quantityPerDay;
  final int daysCount;
  final int includedTotalQty;
  final int unitPlanPriceHalala;
  final int priceHalala;
  final int totalHalala;
  final String currency;

  QuoteAddonSummaryDto({
    required this.addonPlanId,
    this.addonId,
    required this.name,
    required this.category,
    required this.quantityPerDay,
    required this.daysCount,
    required this.includedTotalQty,
    required this.unitPlanPriceHalala,
    required this.priceHalala,
    required this.totalHalala,
    required this.currency,
  });

  factory QuoteAddonSummaryDto.fromJson(Map<String, dynamic> json) {
    return QuoteAddonSummaryDto(
      addonPlanId: json['addonPlanId'] as String? ?? '',
      addonId: json['addonId'] as String?,
      name: LocalizedNameDto.fromJson(json['name'] as Map<String, dynamic>? ?? {}),
      category: json['category'] as String? ?? '',
      quantityPerDay: json['quantityPerDay'] as int? ?? 1,
      daysCount: json['daysCount'] as int? ?? 1,
      includedTotalQty: json['includedTotalQty'] as int? ?? 0,
      unitPlanPriceHalala: json['unitPlanPriceHalala'] as int? ?? 0,
      priceHalala: json['priceHalala'] as int? ?? 0,
      totalHalala: json['totalHalala'] as int? ?? 0,
      currency: json['currency'] as String? ?? 'SAR',
    );
  }
}

class AddonBalanceDto {
  final String addonPlanId;
  final String? addonId;
  final LocalizedNameDto? name;
  final String? category;
  final int purchasedDailyQty;
  final int includedTotalQty;
  final int purchasedQty;
  final int consumedQty;
  final int reservedQty;
  final int remainingQty;
  final String currency;

  AddonBalanceDto({
    required this.addonPlanId,
    this.addonId,
    this.name,
    this.category,
    required this.purchasedDailyQty,
    required this.includedTotalQty,
    required this.purchasedQty,
    required this.consumedQty,
    required this.reservedQty,
    required this.remainingQty,
    required this.currency,
  });

  factory AddonBalanceDto.fromJson(Map<String, dynamic> json) {
    return AddonBalanceDto(
      addonPlanId: json['addonPlanId'] as String? ?? '',
      addonId: json['addonId'] as String?,
      name: json['name'] != null ? LocalizedNameDto.fromJson(json['name'] as Map<String, dynamic>) : null,
      category: json['category'] as String?,
      purchasedDailyQty: json['purchasedDailyQty'] as int? ?? 1,
      includedTotalQty: json['includedTotalQty'] as int? ?? 0,
      purchasedQty: json['purchasedQty'] as int? ?? 0,
      consumedQty: json['consumedQty'] as int? ?? 0,
      reservedQty: json['reservedQty'] as int? ?? 0,
      remainingQty: json['remainingQty'] as int? ?? 0,
      currency: json['currency'] as String? ?? 'SAR',
    );
  }
}

class DayAddonSelectionDto {
  final String addonId;
  final String source;
  final int priceHalala;

  DayAddonSelectionDto({
    required this.addonId,
    required this.source,
    required this.priceHalala,
  });

  factory DayAddonSelectionDto.fromJson(Map<String, dynamic> json) {
    return DayAddonSelectionDto(
      addonId: json['addonId'] as String? ?? '',
      source: json['source'] as String? ?? 'subscription',
      priceHalala: json['priceHalala'] as int? ?? 0,
    );
  }
}

class PendingPaymentSummaryDto {
  final String paymentId;
  final String status;
  final String commercialState;

  PendingPaymentSummaryDto({
    required this.paymentId,
    required this.status,
    required this.commercialState,
  });

  factory PendingPaymentSummaryDto.fromJson(Map<String, dynamic> json) {
    return PendingPaymentSummaryDto(
      paymentId: json['paymentId'] as String? ?? '',
      status: json['status'] as String? ?? '',
      commercialState: json['commercialState'] as String? ?? '',
    );
  }
}
```

---

## 19. Flutter implementation checklist for future Codex

### Flutter Codex Implementation Checklist

### Checkout
- [ ] Load add-on choices from `GET /api/subscriptions/addon-choices`.
- [ ] Show add-ons as multi-select cards in checkout UI.
- [ ] Send legacy `addons: string[]` initially.
- [ ] Optional future: send `{ addonPlanId, quantityPerDay }`.
- [ ] Show quote totals from backend only.
- [ ] Do not multiply price by days.

### Subscription overview
- [ ] Prefer `addonBalances` array from overview response.
- [ ] Show included/used/reserved/remaining quantities directly from DTO.
- [ ] Do not calculate remaining from `maxPerDay`.

### Daily planner
- [ ] Allow selecting multiple add-on items in the day drawer.
- [ ] Do not hard cap by `maxPerDay`.
- [ ] Call validate/save endpoint (`POST /validate` or `PUT /selection`).
- [ ] Read `source` and `priceHalala` from response.
- [ ] Show included vs pending payment badges correctly.
- [ ] Do not confirm pending payment items as free.

### Payment
- [ ] Use existing payment verification endpoint if documented (`/one-time-addons/payments/:paymentId/verify`).
- [ ] Refresh day and overview screens after payment success.

---

## 20. Common Flutter mistakes

- **Wrong ID in Checkout**: Do not send menu product IDs in checkout add-ons if backend expects add-on plan IDs (`addonPlanId`).
- **Wrong ID in Planner**: Do not send add-on plan IDs in daily item selection if backend expects menu item IDs (`addonId` / `menuProductId`).
- **Client-side Multiplication**: Do not multiply add-on price by days.
- **Hard Capping**: Do not use `maxPerDay` as a hard cap.
- **Assuming Free Add-ons**: Do not treat `pending_payment` as free.
- **Meal Count Decrement**: Do not decrement meal count for add-ons.
- **Mixing Flows**: Do not mix premium upgrades with add-ons.
- **Client Totals**: Do not calculate final totals client-side.

---

## 21. Implementation Safety Notes for Flutter Codex

```text
Before changing Flutter:
1. Run against staging/dev backend.
2. Log actual response shapes from:
   - addon-choices
   - quote
   - checkout/create
   - current overview
   - meal-planner-menu
   - day validate
   - day save
   - payment initiate/verify
3. Implement null-safe parsing.
4. Do not remove legacy List<String> checkout payload support.
5. Do not block selection by maxPerDay.
6. Do not mark pending_payment items as free.
```

---

## 22. Final Codex prompt section inside the README

```md
# Prompt to send to Codex in Flutter repo

Implement the Flutter add-ons flexible ledger integration using this README as the source of truth.

Flutter repo:
`/home/hema/Projects/full app/mobile_app`

Rules:
- Do not change backend.
- Do not invent endpoints.
- Preserve old checkout behavior unless explicitly implementing quantityPerDay.
- Use backend response fields as source of truth.
- Add null-safe DTO parsing.
- Show included vs pending-payment add-ons correctly.
- Do not hard cap by maxPerDay.
- Do not treat pending_payment as free.
- Do not mix add-ons with premium upgrades.
- Run Flutter analyzer/tests after implementation.

Implementation tasks:
1. Update/add DTOs listed in this README.
2. Update checkout add-on selection mapping.
3. Update quote response parsing.
4. Update subscription overview add-on balance display.
5. Update daily planner add-on selection display and validation.
6. Add payment-required UI handling for pending add-ons.
7. Refresh day/overview after successful payment.
8. Keep backward compatibility with `addons: List<String>`.

Return:
- files changed
- endpoints used
- payloads sent
- screenshots or screen notes if available
- analyzer/test results
```
