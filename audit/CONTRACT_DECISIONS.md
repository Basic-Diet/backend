# Contract Decisions

Status: candidates documented from the July 14, 2026 five-run diagnostic pass. These are not approvals to change behavior; each item needs owner/product confirmation before tests are updated.

## AUTH-RESET-001 - Admin User Creation And Reset Password

- Domain: authentication.
- Previous expectation: admin create-user tests expected `201` without supplying a temporary password and later expected mobile login to return `403 PENDING_ACTIVATION`.
- Current behavior: create user returns `400 INVALID` with `A temporary password (minimum 6 characters) is required when creating a user`; follow-on login returns `401 INVALID_CREDENTIALS`.
- Source-code evidence: controller/service currently enforces explicit temporary password input for admin-created users.
- Adjacent test evidence: `tests/mobileAuthPasswordRefresh.test.js` passes in all five full-suite runs.
- Security/business reasoning: returning or inventing temporary passwords in API responses is sensitive and should not be added only to satisfy stale tests.
- Final accepted behavior: pending.
- Tests updated: none in this pass.
- Client compatibility impact: dashboard/admin user creation UI may need to supply a temporary password explicitly if this behavior is accepted.

## PICKUP-STATUS-001 - Pickup Initial Status

- Domain: pickup requests.
- Previous expectation: tests perform `prepare` as an initial operation or expect a pre-`in_preparation` lifecycle.
- Current behavior: operations reject `prepare` in the current state; new pickup creation appears to begin at `in_preparation`.
- Source-code evidence: pickup route/service rejects invalid transitions with `INVALID_TRANSITION`.
- Adjacent test evidence: pickup overview, balance service, and settlement pass; client/ops/routes tests fail.
- Security/business reasoning: repeated state transitions must remain idempotent and role-safe; no test should bypass lifecycle checks.
- Final accepted behavior: pending.
- Tests updated: none in this pass.
- Client compatibility impact: mobile/dashboard clients may need to treat `in_preparation` as the initial visible pickup state if confirmed.

## ORDER-PERM-001 - Courier And Dashboard Permissions

- Domain: order and delivery operations.
- Previous expectation: selected delivery dispatch/operation tests expected `200` from dashboard/courier flows.
- Current behavior: runtime returns `403 FORBIDDEN` for insufficient dashboard permissions and rejects invalid transitions.
- Source-code evidence: delivery/action handlers enforce role and state gates.
- Adjacent test evidence: `oneTimeOrderOps`, `operationsDeliveryFlowContract`, `orderPaymentIdempotency`, and `orderQueryParity` pass.
- Security/business reasoning: relaxing permission checks would be a security regression.
- Final accepted behavior: pending.
- Tests updated: none in this pass.
- Client compatibility impact: dashboard roles and courier actions must match the current permission model.

## ADDON-SOURCE-001 - Add-on Source And Readback Shape

- Domain: add-on selection and read models.
- Previous expectation: tests expect older source IDs/source model/fallback totals.
- Current behavior: readback validation fails on source, and fallback balance expectations conflict with dynamic/catalog-backed data.
- Source-code evidence: add-on readback and balance services now prefer persisted source/snapshot data over static fallback.
- Adjacent test evidence: add-on public contract, pricing matrix, dashboard/mobile parity, add-on payment E2E, and credit allocation pass.
- Security/business reasoning: snapshots should remain immutable enough for paid selections while live catalog reads should be explicit.
- Final accepted behavior: pending.
- Tests updated: none in this pass.
- Client compatibility impact: clients may need to read stable keys/snapshots instead of legacy source labels.

## VAT-ORDER-001 - VAT Requires Valid Orders

- Domain: VAT/order pricing.
- Previous expectation: VAT integration fixture priced an order with no items.
- Current behavior: runtime rejects with `EMPTY_ORDER` / `Order must include at least one item`.
- Source-code evidence: `priceOrderCart` validates non-empty order items before pricing.
- Adjacent test evidence: VAT unit tests, inclusive pricing, and response naming tests pass.
- Security/business reasoning: pricing an empty order would weaken order validation and accounting accuracy.
- Final accepted behavior: valid orders are required for VAT integration tests, pending owner confirmation.
- Tests updated: none in this pass.
- Client compatibility impact: no valid client should depend on empty-order pricing.

## MEAL-BUILDER-FIXTURE-001 - Dynamic Catalog Fixture Validity

- Domain: meal builder and planner catalog.
- Previous expectation: older fixtures relied on legacy canonical/static fallback data and incomplete premium relations.
- Current behavior: publish/readiness validation requires DB-backed premium proteins, premium salad product/group relations, active options, and pricing configuration.
- Source-code evidence: readiness checks report missing premium proteins, missing premium salad, and unavailable product-option relations.
- Adjacent test evidence: dynamic premium flow, builder catalog V2 contract, catalog validator consistency, menu/dashboard/mobile parity, and premium pricing safety pass.
- Security/business reasoning: restoring static fallback would mask data integrity problems and contradict the backend stabilization goal.
- Final accepted behavior: pending; expected direction is database-backed fixture factories.
- Tests updated: none in this pass.
- Client compatibility impact: planner clients should receive catalog-backed payloads only when required catalog records are valid and published.
