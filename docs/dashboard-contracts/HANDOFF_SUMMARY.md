# Dashboard Backend Contract Pack — Summary

This document is the summary of the **backend source-of-truth contract pack** for every screen and route in the BasicDiet145 admin dashboard.

---

## 1. Purpose

The `docs/dashboard-contracts/` folder details:
- The exact backend API endpoints available to each screen.
- Request parameter schemas and required response fields.
- Business-logic invariants the frontend must never circumvent.
- Known limitations and outstanding test coverage gaps.

The dashboard development team must use this pack — not the frontend route map — as the authoritative API reference when building, modifying, or debugging any screen.

---

## 2. Source-of-Truth Rule

> [!IMPORTANT]
> The following precedence rule is absolute and must be followed by the dashboard team.

1. **`DASAHBOARD_SCREEN_AND_ROUTES_MAP.md`** describes what the dashboard frontend fetches. It is frontend context only.
2. **Backend Express routes + controllers + services + tests** define the **final contract**. These are the source of truth.
3. If the frontend route map lists an endpoint that does not exist in the backend, it must be marked as not available — not invented or computed on the frontend.
4. If the frontend route map conflicts with a contract file, the **contract file wins**.
5. If a response field is missing from a backend response, the frontend must request a backend contract update. It must never compute, infer, or fabricate missing fields locally.

---

## 3. Status Counts

Status values are read directly from the current contract files.

| Status | Count | Files |
|--------|-------|-------|
| `READY` | 15 | `01_DASHBOARD_HOME`, `02_PAYMENTS`, `03_ACCOUNTING`, `04_PROMO_CODES`, `05_ADDONS`, `06_PACKAGES`, `07_SUBSCRIPTIONS`, `09_OPERATIONS`, `10_MANUAL_DEDUCTION`, `11_MENU_CATALOG`, `13_DELIVERY_ZONES`, `15_DASHBOARD_USERS`, `16_SETTINGS`, `17_RESTAURANT_HOURS`, `18_PICKUP_BRANCHES` |
| `READY_WITH_LIMITATIONS` | 8 | `08_ONE_TIME_ORDERS`, `14_APP_USERS`, `11A_MENU_CATEGORIES`, `11B_MENU_PRODUCTS`, `11C_MENU_PRODUCT_CUSTOMIZATION`, `11D_MENU_OPTION_GROUPS`, `11E_MENU_OPTIONS`, `11F_MENU_PREVIEW_RELEASE` |
| `NEEDS_TESTS` | 3 | `12_DELIVERY`, `19_NOTIFICATIONS`, `20_PROFILE` |
| `NEEDS_BACKEND_FIX` | 0 | — |
| `LEGACY_OR_UNCLEAR` | 0 | — |
| `OUT_OF_SCOPE` | 0 | — |
| `BACKEND_FOUNDATION_READY_FOR_DASHBOARD_UI` | 1 | `11G_SUBSCRIPTION_PLANNER_UPGRADES` |
| `READY_FOR_DASHBOARD_HANDOFF` | 1 | `MENU_SYSTEM_DASHBOARD_USER_STORIES` |

---

## 4. Critical Dashboard Rules

These invariants are enforced by the backend. The dashboard must display backend-provided values verbatim and must never circumvent them.

### Subscription Balance Rules
- **Dashboard must not calculate subscription balances.** Display `remainingQty`, `usedQty`, `pickedQty`, `deliveredQty`, and `remainingPlannedQty` directly from the backend audit response.
- **Dashboard must not treat add-ons as meal slots.** A subscription day with 1 meal slot and 4 add-on selections has exactly `mealSlots.length === 1`. Add-ons are independent entitlements.
- **Dashboard must not treat premium upgrades as extra meals.** A premium upgrade upgrades an existing meal slot. It does not increment `totalMeals` or add a new entry to `mealSlots[]`.

### Branch Pickup Selection Rules
- **`selectedMealSlotIds` must never contain add-ons.** Only slot keys (e.g. `"slot_1"`) belong in this field.
- **`selectedPickupItemIds` is the unified branch pickup selection field.** It is the single source of truth for what the customer has selected for a given pickup request (e.g. `["slot_1", "addon_<id>_1"]`).
- **Fulfillment consumes only `selectedPickupItemIds`.** No other planned items on the day are pruned or mutated by fulfillment.
- **Picked add-ons must not reappear.** After a pickup request is created or fulfilled, add-ons in `selectedPickupItemIds` must not appear in future availability responses.
- **Unpicked planned add-ons remain planned and available.** `day.addonSelections` is not pruned by fulfillment. Only the `selectedPickupItemIds` of the fulfilled request controls what is consumed.

### General Frontend Rules
- **Dashboard must consume backend read models only.** No balance calculations, status transitions, or invariant checks belong in the frontend.
- **Flutter must remain untouched.** The Flutter mobile client uses `/api/subscriptions/` endpoints, not dashboard endpoints. No Flutter changes are required or permitted as part of dashboard work.

### Menu & Subscription Planner Upgrades
New dashboard screen handoffs added:
- [11G_SUBSCRIPTION_PLANNER_UPGRADES_DASHBOARD_README.md](11G_SUBSCRIPTION_PLANNER_UPGRADES_DASHBOARD_README.md) (Status: `BACKEND_FOUNDATION_READY_FOR_DASHBOARD_UI`): Covers subscription planner upgrade screens.
- [MENU_SYSTEM_DASHBOARD_USER_STORIES.md](MENU_SYSTEM_DASHBOARD_USER_STORIES.md) (Status: `READY_FOR_DASHBOARD_HANDOFF`): Comprehensive menu catalog user stories and developer mappings.
- **Rule:** Dashboard UI must preserve existing Flutter-facing section/product keys and make no local price/balance calculations.

---

## 5. Known Limitations

| Area | Limitation |
|------|-----------|
| **Delivery** (`12_DELIVERY`) | Status: `NEEDS_TESTS`. Courier queue list is smoke-tested (HTTP 200), but no end-to-end fulfillment flow is verified. Route prefix is `/api/courier/deliveries/today`, not `/api/dashboard/courier/`. |
| **One-Time Orders** (`08_ONE_TIME_ORDERS`) | Status: `READY_WITH_LIMITATIONS`. Covered by `oneTimeOrders.test.js` integration suite, but has no dedicated detail field assertions inside `dashboardContracts.test.js`. |
| **App Users** (`14_APP_USERS`) | Status: `READY_WITH_LIMITATIONS`. List and detail are smoke-tested only. Create-subscription subflows and field-level assertions are not covered. |
| **Notifications** (`19_NOTIFICATIONS`) | Status: `NEEDS_TESTS`. Both `/notifications/summary` and `/notification-logs` endpoints exist in the backend and were verified in source code, but no automated contract tests exist yet. |
| **Profile** (`20_PROFILE`) | Status: `NEEDS_TESTS`. `GET /api/dashboard/auth/me` exists and was verified in source code, but has no test coverage in the contract test suite. |
| **Menu Validate vs Validation** (`11F_MENU_PREVIEW_RELEASE`) | The frontend route map references `/api/dashboard/menu/validation`, but the backend route is `POST /api/dashboard/menu/validate`. The frontend must call the correct `/validate` path. |
| **Menu sub-contracts** (`11A`–`11F`) | Status: `READY_WITH_LIMITATIONS`. Basic read/write integration is tested via Test #10. Comprehensive field-level assertions on every endpoint are not yet present. |

---

## 6. Verification Commands

Run the following to confirm the backend contract pack is valid against the current codebase:

```bash
# Dashboard contract integration tests (20 tests)
NODE_ENV=test node tests/dashboardContracts.test.js

# Subscription audit and invariant tests (15 tests)
NODE_ENV=test node tests/subscriptionAuditDashboard.test.js

# Core subscription balance, modification, and concurrency policy tests
npm run test:subscriptions
```
