# Screen Contract: 10_MANUAL_DEDUCTION

## 1. Screen Purpose
Allows cashiers or admin operators to manually look up a client's subscription details by phone number and manually deduct regular meals, premium meals, and add-ons directly from their wallet balance.

## 2. Dashboard Route
`/manual-deduction`

## 3. Backend Endpoints (Phase 2 Active)
> ⚠️ **Important**: The dashboard uses the `/api/dashboard/subscriptions/` endpoints for manual deductions, not the legacy `/api/dashboard/ops/cashier/` endpoints.

* `GET /api/dashboard/subscriptions/search?phone=<phone>` — Looks up client by phone number and returns active subscriptions, including add-on balances.
* `POST /api/dashboard/subscriptions/:subscriptionId/manual-deduction` — Records a manual deduction against a subscription's regular, premium, and/or add-on balances.
* `GET /api/dashboard/subscriptions/:subscriptionId/manual-deductions` — Lists past manual deductions for a subscription.

---

## 4. Frontend Implementation Guide: Payloads & UI Requirements

### A. Customer Lookup (Search)
**Endpoint:** `GET /api/dashboard/subscriptions/search?phone=<phone>`

**UI Requirement:**
* Provide a Text Input for the `phone` number (e.g., `+966500000001`).

**Response JSON:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "user_id",
      "name": "John Doe",
      "phone": "+966500000001"
    },
    "subscription": {
      "id": "subscription_id",
      "planName": "Weight Loss Plan",
      "status": "active",
      "fulfillmentMethod": "pickup",
      "totalMeals": 30,
      "consumedMeals": 10,
      "remainingMeals": 20,
      "remainingRegularMeals": 15,
      "remainingPremiumMeals": 5,
      "addonBalances": [
        {
          "addonId": "addon_123",
          "name": "Orange Juice",
          "remainingQty": 5,
          "totalQty": 10,
          "consumedQty": 5
        }
      ]
    },
    "subscriptions": [ ... ],
    "today": {
      "businessDate": "2026-06-23",
      "hasDeliveryDeductionToday": false,
      "lastDeductionAt": null
    }
  }
}
```

### B. Deduction Form
**Endpoint:** `POST /api/dashboard/subscriptions/:subscriptionId/manual-deduction`

**UI Requirements (Form Fields):**
* **Regular Meals:** A Number Input (`<input type="number">`). Min is 0, max is `subscription.remainingRegularMeals`.
* **Premium Meals:** A Number Input (`<input type="number">`). Min is 0, max is `subscription.remainingPremiumMeals`.
* **Add-ons:** Dynamic Number Inputs. Iterate over the `addonBalances` array from the Search response. For each addon, display its `name` and render a Number Input. Min is 0, max is `addon.remainingQty`.
* **Reason:** A Text Input or Select Box (`<select>`). The backend accepts any string. If your operations team requires standardized reasons (e.g., "Walk-in pickup", "Customer support correction"), you can render a `<select>` box with those predefined options. Otherwise, a standard `<input type="text">` is perfectly fine. Required.
* **Notes:** A Text Area (`<textarea>`) for any extra details. Optional.

**Payload JSON to Send:**
```json
{
  "regularMeals": 1,
  "premiumMeals": 0,
  "addons": [
    {
      "addonId": "addon_123",
      "qty": 1
    }
  ],
  "reason": "cashier_walk_in",
  "notes": "Customer requested manual pickup"
}
```
*Note: The `addons` array is optional. You only need to include addons where the user inputted a quantity > 0.*

**Response JSON Expected:**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "subscription_id",
    "deducted": {
      "regularMeals": 1,
      "premiumMeals": 0,
      "total": 1,
      "addons": [
        {
          "addonId": "addon_123",
          "qty": 1
        }
      ]
    },
    "remaining": {
      "regularMeals": 14,
      "premiumMeals": 5,
      "totalMeals": 19,
      "addons": [
        {
          "addonId": "addon_123",
          "remainingQty": 4
        }
      ]
    },
    "businessDate": "2026-06-23",
    "fulfillmentMethod": "pickup"
  }
}
```

---

## 5. Subscription-Critical Invariant Rules
> These rules are enforced by the backend. The dashboard must never compute or override them.

* **Atomic Deductions:** Regular meals, premium meals, and add-ons are deducted in a single atomic transaction. If any balance is insufficient, the entire request is rejected with a `409` status.
* **Add-ons are independent entitlements** — They are never counted as base meal slots. Deducting meals via `regularMeals` does not affect addon balances. Deducting addons does not affect `remainingMeals`.
* **Flutter remains untouched** — This cashier endpoint is only available to the dashboard. No Flutter/mobile client changes are required.
* **Role Enforcement:** Only users with `admin`, `superadmin`, or `cashier` roles can execute these endpoints.

## 6. Frontend Restrictions
* **No Balance Verification**: The frontend may restrict input `max` values for UI convenience, but it **must not** block the request based on stale client-side balances. It must post the transaction to the backend, and gracefully display any validation errors (e.g., `INSUFFICIENT_REMAINING_MEALS` or `INSUFFICIENT_ADDON_BALANCE`) returned by the server.

## 7. Status
`READY` (Phase 2 Active)
