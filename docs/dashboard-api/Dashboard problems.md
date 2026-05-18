## Project Context

The backend dashboard APIs have now been updated and are mostly ready for frontend integration. The backend added the missing dashboard endpoints, added support for the `cashier` role, improved `/auth/me`, added read APIs for balances and addon entitlements, and kept backward compatibility where possible. Backend tests passed successfully, including `npm test` with **53 passed**. 

Frontend project path:

```txt
/home/hema/Projects/full app/client_dashbourd-main
```

Backend project path:

```txt
/home/hema/Projects/basicdiet145
```

The frontend should now be updated to match the latest backend contracts.

---

# 1. Executive Summary

The dashboard frontend is partially integrated with the backend, but several areas still need fixes:

1. Some API methods do not match the official backend contract.
2. Some frontend calls use endpoints that are not available in the backend.
3. Some dashboard UI cards and charts still use incorrect mapping or mock data.
4. Some subscription detail actions need to be aligned with the backend’s supported APIs.
5. The `cashier` role is now supported by the backend and should be properly handled in the frontend.
6. Error handling and response normalization should be improved.
7. Menu activation APIs need to be updated because the frontend uses unsupported `/toggle-active` endpoints.

The backend is now ready for the frontend to consume these APIs, except for `POST/DELETE addon-entitlements`, which are intentionally not implemented. The frontend must use the existing `PATCH` replacement endpoint for addon entitlement updates. 

---

# 2. Backend Updates Relevant to Frontend

The backend now supports these important contracts:

## 2.1 Settings

```http
GET /api/dashboard/settings
Authorization: Bearer <dashboardToken>
```

Response:

```json
{
  "status": true,
  "data": {
    "...": "..."
  }
}
```

Allowed roles:

```txt
admin
superadmin
```

`cashier` should not be allowed to access settings unless product requirements change. 

---

## 2.2 Subscription Balances

```http
GET /api/dashboard/subscriptions/:id/balances
Authorization: Bearer <dashboardToken>
```

Response:

```json
{
  "status": true,
  "data": {
    "subscriptionId": "...",
    "balances": {
      "premiumBalance": [],
      "addonBalance": []
    },
    "premiumBalance": [],
    "addonBalance": []
  }
}
```

Allowed roles:

```txt
admin
superadmin
cashier
```



---

## 2.3 Subscription Addon Entitlements

```http
GET /api/dashboard/subscriptions/:id/addon-entitlements
Authorization: Bearer <dashboardToken>
```

Response:

```json
{
  "status": true,
  "data": {
    "subscriptionId": "...",
    "addonEntitlements": []
  }
}
```

Allowed roles:

```txt
admin
superadmin
cashier
```

Important: backend did **not** add `POST` or `DELETE` for addon entitlements. The current backend contract uses `PATCH` replacement logic. 

---

## 2.4 Subscription Delivery Update

Official backend endpoint:

```http
PUT /api/dashboard/subscriptions/:id/delivery
Authorization: Bearer <dashboardToken>
```

Delivery mode request body:

```json
{
  "deliveryMode": "delivery",
  "deliveryZoneId": "...",
  "deliveryAddress": {
    "line1": "New address",
    "notes": "Customer note"
  },
  "deliveryWindow": "16:00-18:00",
  "reason": "Customer requested address change"
}
```

Pickup mode request body:

```json
{
  "deliveryMode": "pickup",
  "pickupLocationId": "...",
  "reason": "Customer switched to pickup"
}
```

Allowed roles:

```txt
admin
superadmin
```

`cashier` is not allowed to update delivery. 

---

## 2.5 Subscription Extend

Official endpoint:

```http
PUT /api/dashboard/subscriptions/:id/extend
Authorization: Bearer <dashboardToken>
```

Request body:

```json
{
  "days": 3,
  "reason": "Manual extension approved"
}
```

Backend also added a temporary alias:

```http
POST /api/dashboard/subscriptions/:id/extend
```

However, the frontend should use the official `PUT` method. 

---

## 2.6 Cashier Role

The backend now supports:

```txt
cashier
```

Cashier can:

```txt
read overview/search
read subscriptions and days
read balances
read addon entitlements
read payments/orders/basic users
verify payments
```

Cashier cannot:

```txt
access settings
manage plans
manage dashboard users
manage menu/catalog
edit balances
edit addon entitlements
update delivery
extend/cancel/freeze/skip subscriptions
perform kitchen/courier operations
```



---

# 3. Frontend Issues by File

## 3.1 `src/utils/fetchSubscriptionsData.ts`

This is the most important file to fix first.

### Issue 1: `extendSubscription` uses the wrong HTTP method

Current frontend behavior:

```http
POST /api/dashboard/subscriptions/:id/extend
```

Official backend contract:

```http
PUT /api/dashboard/subscriptions/:id/extend
```

Impact:

The backend currently supports `POST` as a temporary alias, so the feature may work. However, this is backward compatibility only. The frontend should use `PUT`.

Required fix:

```ts
api.put(`/api/dashboard/subscriptions/${id}/extend`, body)
```

Expected body:

```ts
{
  days: number;
  reason?: string;
}
```

Priority: **High**

---

### Issue 2: Delivery update uses the wrong contract

Current frontend behavior from the previous integration report:

```http
GET /api/dashboard/subscriptions/:id/delivery?date=...
PATCH /api/dashboard/subscriptions/:id/delivery?date=...
```

Official backend contract:

```http
PUT /api/dashboard/subscriptions/:id/delivery
```

There is no date-specific `GET` or `PATCH` delivery endpoint in the backend.

Required fix:

Replace frontend delivery update logic with:

```ts
api.put(`/api/dashboard/subscriptions/${id}/delivery`, body)
```

For delivery:

```ts
{
  deliveryMode: "delivery",
  deliveryZoneId: string,
  deliveryAddress: {
    line1: string,
    notes?: string
  },
  deliveryWindow?: string,
  reason?: string
}
```

For pickup:

```ts
{
  deliveryMode: "pickup",
  pickupLocationId: string,
  reason?: string
}
```

Important:

If the UI is designed to update delivery for a specific subscription day, this is not currently supported by the backend contract. The frontend should either:

1. Update the whole subscription delivery settings, or
2. Hide/disable day-specific delivery editing until the backend provides a dedicated daily delivery endpoint.

Priority: **High**

---

### Issue 3: Balances read should now use the new backend endpoint

The backend now supports:

```http
GET /api/dashboard/subscriptions/:id/balances
```

Required frontend behavior:

```ts
api.get(`/api/dashboard/subscriptions/${id}/balances`)
```

Expected response:

```ts
{
  status: true;
  data: {
    subscriptionId: string;
    balances: {
      premiumBalance: unknown[];
      addonBalance: unknown[];
    };
    premiumBalance: unknown[];
    addonBalance: unknown[];
  };
}
```

Action:

If the frontend already calls this exact endpoint, keep it and only adjust response mapping if needed.

Priority: **Medium**

---

### Issue 4: Addon entitlements read should now use the new backend endpoint

The backend now supports:

```http
GET /api/dashboard/subscriptions/:id/addon-entitlements
```

Required frontend behavior:

```ts
api.get(`/api/dashboard/subscriptions/${id}/addon-entitlements`)
```

Expected response:

```ts
{
  status: true;
  data: {
    subscriptionId: string;
    addonEntitlements: unknown[];
  };
}
```

Priority: **Medium**

---

### Issue 5: Addon entitlements `POST` and `DELETE` are not supported

The frontend previously expected:

```http
POST /api/dashboard/subscriptions/:id/addon-entitlements
DELETE /api/dashboard/subscriptions/:id/addon-entitlements/:entitlementId
```

These endpoints do not exist. The backend intentionally did not add them because the current model uses replacement through `PATCH`. 

Official write endpoint:

```http
PATCH /api/dashboard/subscriptions/:id/addon-entitlements
```

Required fix:

Replace `POST` and `DELETE` usage with a frontend state update followed by one `PATCH` request that sends the full replacement list.

Recommended frontend flow:

1. Fetch current entitlements using `GET`.
2. For add:

   * Add the new entitlement locally to the array.
   * Send the full updated array with `PATCH`.
3. For delete:

   * Remove the entitlement locally from the array.
   * Send the full updated array with `PATCH`.

Priority: **High** if the UI allows editing addon entitlements.

---

## 3.2 `src/utils/fetchSettings.ts`

### Issue: Settings GET endpoint previously did not exist, but now it does

The backend now supports:

```http
GET /api/dashboard/settings
```

Required action:

Make sure the frontend uses exactly:

```ts
api.get("/api/dashboard/settings")
```

Expected response:

```ts
{
  status: true;
  data: Record<string, unknown>;
}
```

Role handling:

Only `admin` and `superadmin` should access settings. If the logged-in user role is `cashier`, the frontend should hide the settings page or show a forbidden/unauthorized state.

Priority: **High**

---

## 3.3 `src/routes/_protected/dashboard.tsx`

### Issue: Dashboard cards have incorrect stats mapping

The overview API exists:

```http
GET /api/dashboard/overview
```

But the dashboard UI previously had incorrect card mapping, where cards may be using the wrong stat keys or repeating the same value.

Required fix:

Review the actual backend response from:

```http
GET /api/dashboard/overview
```

Then map cards to the correct keys.

Expected card examples:

```txt
Active Subscriptions -> activeSubscriptions
Deliveries Today     -> deliveriesToday
Pending Orders       -> pendingOrders
App Users            -> appUsers
```

Actual key names must be verified from the real backend response.

Priority: **High**

Impact:

Even if the API call succeeds, the dashboard may show misleading numbers if the mapping is wrong.

---

## 3.4 `src/components/chart-area-interactive.tsx`

### Issue: Chart still uses hardcoded/mock data

The dashboard chart currently uses static sample data instead of real backend data.

Impact:

The dashboard may appear functional, but chart values are not real.

Recommended options:

### Option A — Short-term fix

Clearly mark the chart as demo data or temporarily hide it.

### Option B — Medium-term fix

Connect the chart to an available backend reporting endpoint if one exists.

### Option C — Backend feature request

If no suitable endpoint exists, request a backend endpoint such as:

```http
GET /api/dashboard/reports/subscriptions?range=30d
GET /api/dashboard/reports/revenue?range=30d
GET /api/dashboard/reports/orders?range=30d
```

Priority: **Medium**

This should not block the basic dashboard integration.

---

## 3.5 `src/types/auth.ts`

### Issue: Ensure `cashier` is included and handled correctly

The backend now officially supports:

```txt
cashier
```

Required frontend action:

Make sure the frontend role type includes:

```ts
"cashier"
```

Example:

```ts
export type DashboardRole =
  | "superadmin"
  | "admin"
  | "kitchen"
  | "courier"
  | "cashier";
```

Priority: **High**

---

## 3.6 Protected Routes / Permissions

Relevant likely files:

```txt
src/routes/_protected/route.tsx
src/types/auth.ts
src/lib/authApi.ts
```

### Issue: Frontend route permissions must match backend role permissions

The backend now supports role-based restrictions for `cashier`.

Frontend should hide or block routes that cashier cannot use.

Cashier should not access:

```txt
settings
plans management
dashboard user management
menu/catalog management
subscription write actions
balances editing
addon entitlement editing
delivery update
extend/cancel/freeze/skip subscription actions
kitchen/courier operations
```

Cashier may access:

```txt
overview/search
subscriptions read-only
subscription days read-only
balances read-only
addon entitlements read-only
payments read-only
payment verification
orders read-only
basic user lookup
```

Required frontend work:

1. Add a central permission map.
2. Use it in navigation/sidebar rendering.
3. Use it in route guards.
4. Use it to hide action buttons.

Example:

```ts
const permissions = {
  superadmin: ["*"],
  admin: ["dashboard:manage"],
  cashier: [
    "overview:read",
    "subscriptions:read",
    "payments:read",
    "payments:verify",
    "orders:read",
    "users:read-basic",
  ],
  kitchen: ["kitchen:read", "kitchen:update"],
  courier: ["courier:read", "courier:update"],
};
```

Priority: **High**

---

## 3.7 `src/lib/authApi.ts`

### Issue: `/auth/me` response shape was updated but kept backward compatibility

Backend now returns a more unified response while preserving root `user`.

Frontend should be able to handle either:

```json
{
  "status": true,
  "user": {
    "id": "...",
    "role": "admin"
  },
  "data": {
    "user": {
      "id": "...",
      "role": "admin"
    }
  }
}
```

Recommended frontend normalization:

```ts
const user = response.data?.data?.user ?? response.data?.user ?? null;
```

Priority: **Medium**

---

## 3.8 API Client / Axios Instance

The frontend already has a central axios client, which is good. The report mentioned that the current axios instance uses `VITE_BACKEND_URL`, sends the dashboard token, and sends `Accept-Language: ar`.

Required improvements:

1. Ensure local development uses:

```env
VITE_BACKEND_URL=http://localhost:3000
```

2. Ensure production uses the correct backend URL.

3. Normalize errors from different backend shapes.

Recommended error extraction:

```ts
function getApiErrorMessage(error: any): string {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.error?.messageKey ||
    error?.message ||
    "Unexpected error"
  );
}
```

4. Handle 401 globally:

   * Clear dashboard token.
   * Redirect to login.
   * Avoid infinite redirect loops.

Priority: **High**

---

## 3.9 Menu APIs

Likely files:

```txt
src/utils/fetchMenuOptions.ts
src/utils/fetchMenuOptionGroups.ts
```

### Issue: Frontend uses unsupported `/toggle-active` endpoints

Current frontend behavior:

```http
/toggle-active
```

Backend supports endpoints such as:

```http
/visibility
/availability
```

Required fix:

Replace `/toggle-active` calls with the actual backend-supported menu endpoints.

The developer should inspect the backend route file:

```txt
/home/hema/Projects/basicdiet145/src/routes/dashboardMenu.js
```

Then update frontend functions accordingly.

Priority: **High** if menu management is part of the dashboard release.

---

## 3.10 Legacy Kitchen APIs

Likely file:

```txt
src/utils/fetchKitchenData.ts
```

### Issue: Frontend may still use legacy kitchen endpoints

Previous report mentioned calls like:

```http
/api/kitchen/operations/*
```

while newer dashboard board endpoints exist under:

```http
/api/dashboard/kitchen/queue
/api/dashboard/courier/queue
/api/dashboard/pickup/queue
/api/dashboard/ops/*
```

Required action:

Confirm whether the frontend should still use legacy kitchen APIs.

Recommended direction:

Use the dashboard-specific APIs where possible:

```http
GET /api/dashboard/kitchen/queue
GET /api/dashboard/courier/queue
GET /api/dashboard/pickup/queue
```

Priority: **Medium**

---

# 4. Feature-by-Feature Status

## 4.1 Login

Status: Mostly OK.

Expected endpoint:

```http
POST /api/dashboard/auth/login
```

Expected response includes:

```txt
token
user
```

Required frontend checks:

* Store token correctly.
* Use token in `Authorization: Bearer`.
* Redirect to protected dashboard after login.
* Show backend validation errors clearly.

Priority: **High**

---

## 4.2 Session Check

Status: Needs response normalization.

Expected endpoint:

```http
GET /api/dashboard/auth/me
```

Frontend should read user from:

```ts
response.data.data.user
```

or fallback to:

```ts
response.data.user
```

Priority: **Medium**

---

## 4.3 Dashboard Overview

Status: API exists, UI mapping needs review.

Expected endpoint:

```http
GET /api/dashboard/overview
```

Required frontend fixes:

* Correct cards mapping.
* Avoid repeated values.
* Handle loading state.
* Handle empty state.
* Handle unauthorized state.

Priority: **High**

---

## 4.4 Users

Status: Mostly OK.

Expected endpoint:

```http
GET /api/dashboard/users
```

Required frontend checks:

* Pagination mapping.
* Search query mapping.
* Cashier should only get basic read access if the route is exposed.
* Hide create/update/delete actions for cashier.

Priority: **Medium**

---

## 4.5 Plans / Packages

Status: Backend works, frontend should restrict by role.

Cashier must not manage plans.

Required frontend action:

* Hide plans management from cashier.
* Ensure admin/superadmin can manage plans.
* Keep existing CRUD if currently working.

Priority: **Medium**

---

## 4.6 Subscriptions

Status: List and summary are likely OK, details/actions need fixes.

Expected read endpoints:

```http
GET /api/dashboard/subscriptions
GET /api/dashboard/subscriptions/summary
GET /api/dashboard/subscriptions/:id/days
GET /api/dashboard/subscriptions/:id/balances
GET /api/dashboard/subscriptions/:id/addon-entitlements
```

Expected write/action endpoints:

```http
PUT /api/dashboard/subscriptions/:id/extend
PUT /api/dashboard/subscriptions/:id/delivery
PATCH /api/dashboard/subscriptions/:id/balances
PATCH /api/dashboard/subscriptions/:id/addon-entitlements
POST /api/dashboard/subscriptions/:id/cancel
POST /api/dashboard/subscriptions/:id/freeze
POST /api/dashboard/subscriptions/:id/unfreeze
POST /api/dashboard/subscriptions/:id/days/:date/skip
POST /api/dashboard/subscriptions/:id/days/:date/unskip
```

Required frontend fixes:

* Use `PUT` for extend.
* Use `PUT` for delivery.
* Use `GET` for balances read.
* Use `GET` for addon-entitlements read.
* Use `PATCH` replacement for addon-entitlements write.
* Disable write actions for cashier.

Priority: **High**

---

## 4.7 Payments

Status: Backend supports cashier payment verification.

Expected endpoints:

```http
GET /api/dashboard/payments
POST /api/dashboard/payments/:id/verify
```

Required frontend action:

* Allow cashier to view payments.
* Allow cashier to verify payments if the UI supports this action.
* Do not expose unrelated admin actions to cashier.

Priority: **High** if cashier role is part of current workflow.

---

## 4.8 Settings

Status: Backend now supports GET.

Expected endpoints:

```http
GET /api/dashboard/settings
PATCH /api/dashboard/settings
```

Required frontend action:

* Use `GET /api/dashboard/settings`.
* Use `PATCH /api/dashboard/settings` for updates.
* Hide route from cashier.

Priority: **High**

---

## 4.9 Menu / Catalog

Status: Needs frontend endpoint alignment.

Required action:

* Replace `/toggle-active`.
* Use backend-supported `/visibility` or `/availability`.
* Verify request body from backend route implementation.

Priority: **High** if menu management is required.

---

# 5. Required Frontend Changes Checklist

## API Contract Fixes

* [ ] Change `extendSubscription` to use `PUT`.
* [ ] Change delivery update to use `PUT /subscriptions/:id/delivery`.
* [ ] Remove unsupported delivery `GET/PATCH ?date=` logic unless backed by a real endpoint.
* [ ] Use `GET /subscriptions/:id/balances`.
* [ ] Use `GET /subscriptions/:id/addon-entitlements`.
* [ ] Replace addon entitlement `POST/DELETE` with `PATCH` replacement logic.
* [ ] Use `GET /dashboard/settings`.
* [ ] Replace menu `/toggle-active` calls.

## Role / Permission Fixes

* [ ] Add `cashier` to frontend role types.
* [ ] Add route permissions for `cashier`.
* [ ] Hide forbidden sidebar items from `cashier`.
* [ ] Hide forbidden action buttons from `cashier`.
* [ ] Allow cashier to verify payments if the product flow requires it.

## UI/Data Fixes

* [ ] Fix dashboard overview card mapping.
* [ ] Remove or clearly mark chart mock data.
* [ ] Add loading states.
* [ ] Add empty states.
* [ ] Add consistent error states.
* [ ] Normalize backend response shape.

## Environment Fixes

* [ ] Ensure local `.env` contains:

```env
VITE_BACKEND_URL=http://localhost:3000
```

* [ ] Ensure production `.env` uses the deployed backend URL.
* [ ] Confirm cookie/token storage works across reloads.

---

# 6. Suggested Implementation Order

## Step 1 — Stabilize API client

Update the central axios/API client:

* base URL
* token handling
* 401 redirect
* error normalization
* `/auth/me` user extraction

Files likely involved:

```txt
src/lib/api.ts
src/lib/authApi.ts
src/routes/_protected/route.tsx
```

---

## Step 2 — Fix subscriptions API functions

Start with:

```txt
src/utils/fetchSubscriptionsData.ts
```

Fix:

```txt
extend
delivery
balances
addon-entitlements
```

This is the highest-impact frontend file.

---

## Step 3 — Fix settings

Update:

```txt
src/utils/fetchSettings.ts
```

Make sure it uses:

```http
GET /api/dashboard/settings
PATCH /api/dashboard/settings
```

Then hide settings from `cashier`.

---

## Step 4 — Fix permissions

Update:

```txt
src/types/auth.ts
protected routes
sidebar/nav config
action buttons
```

Add proper support for:

```txt
cashier
```

---

## Step 5 — Fix dashboard overview

Update:

```txt
src/routes/_protected/dashboard.tsx
```

Correct the stats mapping from `/api/dashboard/overview`.

---

## Step 6 — Fix menu APIs

Update:

```txt
src/utils/fetchMenuOptions.ts
src/utils/fetchMenuOptionGroups.ts
```

Replace unsupported `/toggle-active`.

---

## Step 7 — Remove or connect mock chart data

Update:

```txt
src/components/chart-area-interactive.tsx
```

Either hide it or connect it to a real reporting endpoint.

---

# 7. Testing Plan

## 7.1 Local Environment

Run backend:

```bash
cd /home/hema/Projects/basicdiet145
npm start
```

Expected backend URL:

```txt
http://localhost:3000
```

Run frontend:

```bash
cd "/home/hema/Projects/full app/client_dashbourd-main"
npm run dev
```

Expected frontend URL:

```txt
http://localhost:5173
```

Frontend `.env`:

```env
VITE_BACKEND_URL=http://localhost:3000
```

---

## 7.2 Manual Test Cases

### Auth

* [ ] Login as admin.
* [ ] Login as superadmin.
* [ ] Login as cashier.
* [ ] Refresh protected page and confirm session persists.
* [ ] Delete token and confirm redirect to login.
* [ ] Confirm `/auth/me` is parsed correctly.

---

### Dashboard Overview

* [ ] Open dashboard home.
* [ ] Confirm cards show real values.
* [ ] Confirm values are not duplicated incorrectly.
* [ ] Confirm loading state appears.
* [ ] Confirm error state appears if backend is down.

---

### Settings

* [ ] Admin can open settings.
* [ ] Superadmin can open settings.
* [ ] Cashier cannot open settings.
* [ ] Settings load via `GET /api/dashboard/settings`.
* [ ] Settings update via `PATCH /api/dashboard/settings`.

---

### Subscriptions

* [ ] List subscriptions.
* [ ] Search/filter subscriptions.
* [ ] Open subscription details.
* [ ] Load days.
* [ ] Load balances.
* [ ] Load addon entitlements.
* [ ] Extend subscription using `PUT`.
* [ ] Update delivery using `PUT`.
* [ ] Confirm cashier can read but cannot mutate.

---

### Addon Entitlements

* [ ] Fetch addon entitlements with `GET`.
* [ ] Add entitlement using local array + `PATCH`.
* [ ] Remove entitlement using local array + `PATCH`.
* [ ] Confirm no frontend calls are made to unsupported `POST` or `DELETE`.

---

### Payments

* [ ] List payments.
* [ ] Verify payment as admin.
* [ ] Verify payment as cashier.
* [ ] Confirm cashier cannot access unrelated admin features.

---

### Menu

* [ ] Toggle visibility/availability using supported backend endpoint.
* [ ] Confirm no request is sent to `/toggle-active`.

---

# 8. Known Non-Blocking Items

These should not block the first frontend integration pass:

1. Chart real reporting API may not exist yet.
2. `POST/DELETE addon-entitlements` are intentionally not implemented.
3. Postman/OpenAPI docs may need full regeneration later.
4. Permissions are still role-based, not fully granular. The frontend can still implement a permission map for cleaner UI control.

---

# 9. Final Notes for the Frontend Developer

The backend is now ready for the dashboard integration work. The most urgent frontend files are:

```txt
src/utils/fetchSubscriptionsData.ts
src/utils/fetchSettings.ts
src/types/auth.ts
src/routes/_protected/route.tsx
src/routes/_protected/dashboard.tsx
src/components/chart-area-interactive.tsx
src/utils/fetchMenuOptions.ts
src/utils/fetchMenuOptionGroups.ts
```

The highest-priority fixes are:

1. Align subscription actions with the backend.
2. Add proper cashier role support.
3. Fix dashboard overview data mapping.
4. Fix settings API usage.
5. Replace unsupported menu `/toggle-active` calls.
6. Replace addon entitlement `POST/DELETE` with `PATCH` replacement logic.

