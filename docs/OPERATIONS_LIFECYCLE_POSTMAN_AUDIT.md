# Operations Lifecycle Postman Audit

Backend path: `/home/hema/Projects/basicdiet145`

Generated files:
- `postman/BasicDiet_Operations_Lifecycle.postman_collection.json`
- `postman/BasicDiet_Local.postman_environment.json`
- `postman/POSTMAN_OPERATIONS_LIFECYCLE_TEST_PLAN.md`

## Route Discovery

| Area | Method | Path | Auth / role | Controller / service | Contract | Success | Errors |
|---|---|---|---|---|---|---|---|
| Root health | GET | `/health` | none | `src/app.js` | none | 200 with `status:true` when DB is up, 503 otherwise | 503 DB unavailable |
| Dashboard current user | GET | `/api/dashboard/auth/me` | optional dashboard token | `dashboardAuthController.me` | bearer optional | 200 with user/token state | 401 for invalid protected checks |
| Dashboard login | POST | `/api/dashboard/auth/login` | none | `dashboardAuthController.login` | dashboard credentials | 200 token when valid | 400/401/429 |
| App current user | GET | `/api/auth/me` | app bearer | `authController.me` | bearer | 200 profile | 401 |
| Kitchen queue | GET | `/api/dashboard/kitchen/queue?date&method&status&q&includeRaw&view` | dashboard admin/kitchen; route admits courier then controller forbids courier | `opsBoardController.queue`, `kitchenQueueContractService` | query date defaults to KSA today; method defaults all | 200 `{status:true,data:{contractVersion,items}}` for v2 unless `view=legacy` | 401, 403 FORBIDDEN |
| Pickup queue | GET | `/api/dashboard/pickup/queue?date&method&status&q&branchId&includeRaw&view` | dashboard admin/kitchen | same | method pickup | 200 v2 items | 401, 403 |
| Courier queue | GET | `/api/dashboard/courier/queue?date&method&status&q&zoneId&includeRaw&view` | dashboard admin/courier | same | method delivery | 200 v2 items | 401, 403 |
| Queue detail | GET | `/api/dashboard/{kitchen|pickup|courier}/queue/:dayId` | screen role | `opsBoardController.queueDetail` | path id may be SubscriptionDay or SubscriptionPickupRequest | 200 item DTO | 404 NOT_FOUND |
| Board action alias | POST | `/api/dashboard/{screen}/actions/:action` | screen role | `opsBoardController.action` -> `opsTransitionService` | body `entityType`, `entityId`, optional `payload`, `code`, `pickupCode` | 200 refreshed detail | INVALID_REQUEST, INVALID_ENTITY_ID, INVALID_ENTITY_TYPE, INVALID_TRANSITION |
| Unified ops action | POST | `/api/dashboard/ops/actions/:action` | dashboard admin/kitchen/courier at route; policy/service narrows by action | `opsActionController.handleAction` -> `opsTransitionService` | body `entityType`, `entityId`, optional `payload`, `code`, `pickupCode`; `source:one_time_order` maps to order | 200 enriched DTO | 400 INVALID_REQUEST/INVALID_ENTITY_ID/INVALID_ENTITY_TYPE, 403 FORBIDDEN, 404 NOT_FOUND, 409 INVALID_TRANSITION/ORDER_PAYMENT_REQUIRED/PICKUP_PREPARE_REQUIRED |
| Client pickup request create | POST | `/api/subscriptions/:id/pickup-requests` | app auth, owner | `subscriptionController.createPickupRequest` -> `subscriptionPickupRequestClientService` | body `date`, positive integer `mealCount`, optional `idempotencyKey` | 200 data with `requestId`, `status:locked`, `nextAction` | 400 INVALID_DELIVERY_MODE/INVALID_DATE/INVALID_MEAL_COUNT, 403 FORBIDDEN, 404 NOT_FOUND, 422 INSUFFICIENT_CREDITS/payment/planning codes |
| Client pickup request list | GET | `/api/subscriptions/:id/pickup-requests?date&status` | app auth, owner | same controller/service | status defaults all | 200 list | same as create |
| Client pickup request status | GET | `/api/subscriptions/:id/pickup-requests/:requestId/status` | app auth, owner | same | ids | 200 status | 404 PICKUP_REQUEST_NOT_FOUND |
| Manual subscription search | GET | `/api/dashboard/subscriptions/search?phone` | dashboard admin/superadmin | `subscriptionManualDeductionController.searchByPhone` -> `manualSubscriptionDeductionService` | query `phone` | 200 customer/subscription/today summary | 403 FORBIDDEN, 404 CUSTOMER_NOT_FOUND/SUBSCRIPTION_NOT_FOUND |
| Manual deduction | POST | `/api/dashboard/subscriptions/:subscriptionId/manual-deduction` | dashboard admin/superadmin | same | body `regularMeals`, `premiumMeals`, optional `reason`, `notes` | 200 deducted/remaining/businessDate | 400 INVALID_MEAL_COUNT, 403 FORBIDDEN, 404 SUBSCRIPTION_NOT_FOUND/CUSTOMER_NOT_FOUND, 409 SUBSCRIPTION_NOT_ACTIVE/INSUFFICIENT_* /DELIVERY_ALREADY_DEDUCTED_TODAY |
| Manual deduction history | GET | `/api/dashboard/subscriptions/:subscriptionId/manual-deductions?limit` | dashboard admin/superadmin | same | limit 1..100 default 50 | 200 `dashboard_manual_deductions.v1` compact rows | 403, 404 |
| Legacy kitchen ops | GET/POST | `/api/kitchen/...` | dashboard admin/kitchen | `kitchenController`, `orderKitchenController` | deprecated operational routes | 200 | see controller-specific INVALID/INSUFFICIENT_CREDITS |

## Action Endpoint Contract

Primary endpoint: `POST /api/dashboard/ops/actions/:action`. Supported actions found in `opsActionPolicy.ACTION_REGISTRY`: `start_preparation`, `lock`, `prepare`, `dispatch`, `ready_for_pickup`, `notify_arrival`, `fulfill`, `cancel`, `no_show`, `reopen`.

Request body for subscription day or pickup request:
```json
{
  "entityType": "subscription_day",
  "entityId": "<ObjectId>",
  "payload": { "reason": "optional", "notes": "optional", "etaAt": "optional ISO date" }
}
```

Allowed entity types: `subscription`, `subscription_day`, `pickup_day`, `subscription_pickup_request`, `order`. `source: one_time_order` maps to `order`.

Important implementation note: route middleware accepts `admin`, `kitchen`, and `courier`, but `opsTransitionService` currently enforces admin/superadmin for `lock`, `prepare`, `cancel`, `no_show`, `reopen`, and `notify_arrival`. Policy still controls role/mode for `dispatch` and `fulfill`.

## Lifecycle Diagrams

Home Delivery:
```txt
Kitchen Queue -> Prepare -> Dispatch -> Courier Queue -> Fulfill Delivery -> Fulfilled
```

Branch Pickup:
```txt
Pickup Request / Pickup Queue -> Prepare -> Ready For Pickup -> Fulfill Pickup -> Fulfilled
```

Manual Deduction:
```txt
Search Subscription -> Deduct Meals -> Verify Balance -> Verify Deduction History
```

## Queue Contract Notes

Default kitchen/pickup/courier queues use the clean v2 contract unless `view=legacy` is supplied. `includeRaw=true` is required to expose raw/internal payloads. The Postman pack asserts v2 fields: `ids`, `customer`, `source`, `orderSummary`, `kitchen`, `fulfillment`, `payment`, and `actions`.

## Data Dependencies

- Action lifecycles require real records on `testDate` with allowed current statuses.
- Client pickup creation requires `clientToken` for the subscription owner and restaurant pickup availability for today.
- Manual deduction requires an active subscription with positive remaining balance. Delivery subscriptions can only be manually deducted once per business date.
- Payment validity checks are queue sweeps; pending/superseded/revision mismatch cases must exist in data to exercise those branches.

## Gaps / Unclear Items

- No dedicated token validation endpoint was found beyond `GET /api/dashboard/auth/me` and `GET /api/auth/me`.
- No mock/test-data creation endpoints were found or added. Data setup remains external/manual.
- The requested home-delivery day-1 pickup exception is not exposed through the discovered client pickup request service for delivery-mode subscriptions; the service maps fulfillment-method denial to `INVALID_DELIVERY_MODE`.
- `notify_arrival` exists in policy/transition service, but the transition service admin-only check conflicts with the policy registry listing courier. The collection documents this as a possible `FORBIDDEN`/policy gap.
