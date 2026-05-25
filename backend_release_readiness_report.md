# Backend Release Readiness Report

Backend reviewed: `/home/hema/Projects/basicdiet145`

Frontend reference: `/home/hema/Projects/full app/mobile_app-main`

Review date: 2026-05-25, Africa/Cairo

## Overall Backend Readiness

- Score: 62 / 100
- Recommendation: Not ready

The backend exposes most mobile API routes needed by the Flutter app, including auth, refresh, subscriptions, meal planner, payments, one-time orders, and profile read. It is not release-ready because the backend test gate fails and several backend-owned contract issues can affect pricing, checkout reliability, and frontend error handling.

## Critical Backend Issues

### Backend test suite fails

- Severity: Critical
- Category: Build/test readiness
- Backend file path: `tests/meal_planner_types.test.js`
- Line number if possible: `tests/meal_planner_types.test.js:174`, `tests/meal_planner_types.test.js:395-396`
- Related frontend file/API if applicable: `lib/data/network/app_api.dart:205-234`
- What is wrong: `npm test` fails. The run reported `28 passed, 25 failed`.
- Why it matters: a release build should not ship while the configured backend test command is red, especially when failures cover meal planner pricing and slot validation used by mobile flows.
- User impact: users may see wrong premium salad pricing or unstable meal planner validation behavior.
- Suggested fix in plain English: fix the premium salad fixed-price mismatch and repair the `MenuOptionGroup.findOne()` test setup/mocking so meal planner tests run deterministically.
- Type: Backend-only issue

## High Backend Issues

### Premium salad fixed price is inconsistent

- Severity: High
- Category: Meal planner pricing contract
- Backend file path: `src/config/mealPlannerContract.js`, `src/controllers/builderPremiumMealController.js`, `tests/meal_planner_types.test.js`
- Line number if possible: `src/config/mealPlannerContract.js:27`, `src/controllers/builderPremiumMealController.js:21-55`, `tests/meal_planner_types.test.js:174`, `tests/meal_planner_types.test.js:395-396`
- Related frontend file/API if applicable: `lib/data/network/app_api.dart:84-85`, `lib/data/network/app_api.dart:205-234`
- What is wrong: `PREMIUM_LARGE_SALAD_FIXED_PRICE_HALALA` is `2900`, while the premium meals catalog and tests expect/display `3000`.
- Why it matters: catalog, quote, balance, payment, and validation paths can disagree on the premium salad amount.
- User impact: users may see one premium salad price and be quoted, charged, or validated against another.
- Suggested fix in plain English: choose one canonical premium salad price and update config, catalog serialization, pricing services, payment metadata, and tests to use it consistently.
- Type: Backend-only issue

### Meal planner validation tests time out on `menuoptiongroups.findOne()`

- Severity: High
- Category: Test reliability / meal planner validation
- Backend file path: `tests/meal_planner_types.test.js`
- Line number if possible: failing cases occur after the premium salad assertions; exact stack output reported `Operation menuoptiongroups.findOne() buffering timed out after 10000ms`.
- Related frontend file/API if applicable: `lib/data/network/app_api.dart:142-166`, `lib/data/network/app_api.dart:205-206`
- What is wrong: many meal planner slot-validation tests time out waiting for `MenuOptionGroup.findOne()`.
- Why it matters: the tests appear to depend on an unmocked or unavailable database/model call, so the backend cannot prove meal planner validation behavior in CI.
- User impact: invalid meal selection behavior may slip through untested and break timeline/day editing flows.
- Suggested fix in plain English: mock or seed the required `MenuOptionGroup` lookup in the test, or refactor the validator test harness so it does not require a live buffered Mongoose query.
- Type: Backend-only issue

## Medium Backend Issues

### Client profile errors use a non-standard response shape

- Severity: Medium
- Category: API response contract
- Backend file path: `src/controllers/clientProfileController.js`
- Line number if possible: `src/controllers/clientProfileController.js:103-105`, `src/controllers/clientProfileController.js:202-204`
- Related frontend file/API if applicable: `lib/data/network/app_api.dart:75-76`, `lib/data/repository/repository.dart:125-148`
- What is wrong: profile success returns `{ status: true, data: ... }`, but error paths return `{ status: false, message: ... }` instead of the standard `{ ok: false, error: { code, message, details } }` shape.
- Why it matters: frontend error handling is less reliable when backend endpoints return different error schemas.
- User impact: profile failures can show generic or inconsistent messages.
- Suggested fix in plain English: use the shared `errorResponse` helper for profile 401/500 cases and return stable error codes such as `USER_NOT_FOUND` and `INTERNAL`.
- Type: Frontend/backend contract mismatch

### One-time order checkout idempotency key is optional

- Severity: Medium
- Category: Checkout reliability
- Backend file path: `src/controllers/orderController.js`
- Line number if possible: `src/controllers/orderController.js:190-235`
- Related frontend file/API if applicable: `lib/data/network/app_api.dart:261-265`
- What is wrong: the controller parses `Idempotency-Key`, `X-Idempotency-Key`, or body `idempotencyKey`, but duplicate protection only runs if a key is present.
- Why it matters: payment/order creation endpoints are high-risk for duplicate submissions during retries, slow networks, or user double taps.
- User impact: any client that omits the key could create duplicate pending orders/payments.
- Suggested fix in plain English: require idempotency for `POST /api/orders/checkout`, matching the stricter subscription checkout behavior.
- Type: Backend-only issue

### One-time order fulfillment date defaults silently to today

- Severity: Medium
- Category: Order contract / date handling
- Backend file path: `src/controllers/orderController.js`
- Line number if possible: `src/controllers/orderController.js:145-151`, `src/controllers/orderController.js:218-219`
- Related frontend file/API if applicable: `lib/data/request/order_quote_request.dart:5-20`, `lib/data/request/create_order_request.dart:5-28`
- What is wrong: if `fulfillmentDate`, `requestedFulfillmentDate`, or `deliveryDate` is absent, backend uses the current KSA date.
- Why it matters: the mobile app currently omits this field, so the date contract is implicit and can drift from UI expectations.
- User impact: a user can unintentionally create an order for today if the UI later implies future scheduling.
- Suggested fix in plain English: either require `fulfillmentDate` for quote/checkout or document today-only behavior and have Flutter display the effective date clearly.
- Type: Frontend/backend contract mismatch

### Subscription checkout generic 500 response includes internal exception text

- Severity: Medium
- Category: Security / error response contract
- Backend file path: `src/controllers/subscriptionController.js`
- Line number if possible: `src/controllers/subscriptionController.js:1105-1106`
- Related frontend file/API if applicable: `lib/data/network/app_api.dart:101-104`
- What is wrong: unexpected checkout errors are returned as `Checkout failed: ${err.message}`.
- Why it matters: internal exception text can expose implementation details and is not stable for client-side error handling.
- User impact: users may see technical checkout failure text instead of a stable, supportable message.
- Suggested fix in plain English: log detailed errors server-side and return a stable public code/message such as `CHECKOUT_UNAVAILABLE`.
- Type: Backend-only issue

## Low Backend Issues

### Profile controller logs directly to console

- Severity: Low
- Category: Observability
- Backend file path: `src/controllers/clientProfileController.js`
- Line number if possible: `src/controllers/clientProfileController.js:202-204`
- Related frontend file/API if applicable: `lib/data/network/app_api.dart:75-76`
- What is wrong: `getClientProfile` catches errors with `console.error` and a non-standard JSON response.
- Why it matters: production diagnosis is weaker without centralized structured logging and stable error codes.
- User impact: not directly visible, but support/debugging can take longer.
- Suggested fix in plain English: use the backend logger/error middleware pattern used by higher-risk flows.
- Type: Backend-only issue

## Backend Test Results

1. `nl -ba package.json | sed -n '1,180p'`
   - Result: success.
   - Purpose: verified available backend scripts and avoided migration/seed commands.

2. `rg` route/controller/contract searches
   - Result: success.
   - Purpose: compared backend routes, controllers, error shapes, auth middleware, payment/order/subscription handlers, and tests against Flutter API methods.

3. `npm test`
   - Result: failed, exit code 1.
   - Script run: `node tests/meal_planner_types.test.js`
   - Output summary: `28 passed, 25 failed`.
   - Notable failure: `CUSTOM_PREMIUM_SALAD_FIXED_PRICE_HALALA: expected 3000, got 2900`.
   - Notable failure: `custom_premium_salad entitlement fixed price remains 3000: fixed price: expected 3000, got 2900`.
   - Notable failure pattern: multiple `Operation menuoptiongroups.findOne() buffering timed out after 10000ms` failures in meal planner slot-validation cases.

Not run:

- `npm run test:mobile-contracts` was not run because the lighter configured backend `npm test` gate already failed and the mobile-contract script is heavier integration-style testing.
- No seed, migration, or data-mutating commands were run.
- Payment provider live callbacks were not exercised.

## Unverified Items

- `npm run test:mobile-contracts` was not run because `npm test` already failed and the mobile-contract script is heavier integration-style testing.
- Full backend integration tests, live payment callbacks, production database behavior, migrations, seeds, and deployment health checks were not verified.
- No data-mutating commands were run.

## Backend / Frontend Contract Risks Caused By Backend

- Premium salad pricing is backend-inconsistent: `src/config/mealPlannerContract.js:27` says `2900`, while catalog/tests/payment expectations use `3000`. This can create frontend catalog/quote/payment mismatch.
- Client profile backend errors use `{ status:false, message }` instead of the standard structured error response, which weakens Flutter error mapping.
- One-time order checkout does not require idempotency, even though Flutter sends it and subscription checkout requires it.
- One-time order fulfillment date defaults silently to today. This makes the effective date backend-dependent unless Flutter displays or sends it.
- Subscription checkout unexpected 500 responses include internal exception text, so Flutter cannot rely on stable public checkout error messages.

## Backend Release Gate

Do not release backend until:

1. `npm test` passes.
2. Premium salad pricing is canonical across config, catalog, quotes, payments, and tests.
3. `MenuOptionGroup.findOne()` timeout failures are fixed in the meal planner test path.
4. One-time order checkout idempotency policy is finalized and enforced or explicitly documented.
5. Profile errors use the standard structured error response.
6. Order fulfillment date behavior is explicitly contracted with the Flutter app.

## Final Audit Status

- Ready? No
- Main blockers: `npm test` fails, `tests/meal_planner_types.test.js` has premium salad price failures, meal planner validation tests time out on `menuoptiongroups.findOne()`, and backend-owned contract risks remain for profile errors, order idempotency, order fulfillment date behavior, and subscription checkout error messages.
- Minimum required fixes before release: make `npm test` pass, align premium salad pricing across config/catalog/payments/tests, fix the meal planner test timeout path, standardize profile error responses, finalize one-time order idempotency, and explicitly contract fulfillment date behavior with Flutter.
- What was not verified: `npm run test:mobile-contracts`, full backend integration tests, live payment callbacks, migrations/seeds, production database behavior, and deployment health checks.
- Audit-only note: this report is documentation-only; no backend code fixes, source refactors, commits, formatting, generators, migrations, seed commands, or data-mutating commands were made during this final QA pass.
