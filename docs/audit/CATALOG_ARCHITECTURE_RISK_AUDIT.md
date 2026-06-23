## 1. CRITICAL FIX LIST (P0)

### P0-1 — Premium pricing authority

- Issue: Subscription premium price can resolve from config, catalog fields, builder fields, rules, or constants.
- Root file:
  - [premiumUpgradeConfigService.js](/home/hema/Projects/basicdiet145/src/services/subscription/premiumUpgradeConfigService.js:41)
  - [CatalogService.js](/home/hema/Projects/basicdiet145/src/services/catalog/CatalogService.js:59)
  - [premiumLargeSaladPricingService.js](/home/hema/Projects/basicdiet145/src/services/catalog/premiumLargeSaladPricingService.js:63)
  - [mealBuilderConfigService.js](/home/hema/Projects/basicdiet145/src/services/subscription/mealBuilderConfigService.js:1934)
- Fix type: **ENFORCE SINGLE SOURCE**
- Exact fix instruction:
  - Add one exported `resolvePremiumUpgrade(premiumKey, {session})` function to `premiumUpgradeConfigService.js`.
  - Return canonical `premiumKey`, `selectionType`, `upgradeDeltaHalala`, currency, source IDs, and availability.
  - Make active + enabled + visible mandatory.
  - Migrate catalog, quote, planner, Meal Builder, and identity consumers to this resolver.
  - Remove the 2000 and 2900 constants after all four canonical keys have config rows.
  - Stop using menu, relation, product, and builder prices for subscription premium charges.
  - Preserve those fields only as candidate defaults and one-time-order pricing.
- Risk if not fixed: Different subscription paths can assign different prices or expose hidden upgrades.

### P0-2 — Missing Premium Upgrade dashboard implementation

- Issue: The documented management screen invokes Meal Builder instead of the premium-config API.
- Root file: [premium-meals/index.tsx](/home/hema/Projects/full%20app/client_dashbourd/src/routes/_protected/premium-meals/index.tsx:3)
- Fix type: **MIGRATE**
- Exact fix instruction:
  - Remove `MealBuilderPage` from this route.
  - Implement the existing list, candidates, create, update, state, archive, and readiness contracts.
  - Use `/api/dashboard/premium-upgrades` exclusively.
  - Do not mutate menu products, options, groups, or Meal Builder drafts from this screen.
- Risk if not fixed: Operators cannot administer the backend authority described by the contract.

### P0-3 — Delivery cancellation contract

- Issue: Dashboard/documented reason values are rejected by backend validation.
- Root file:
  - [deliveryWorkflowService.js](/home/hema/Projects/basicdiet145/src/services/deliveryWorkflowService.js:31)
  - [fetchCourierDeliveries.ts](/home/hema/Projects/full%20app/client_dashbourd/src/utils/fetchCourierDeliveries.ts:181)
  - [12_DELIVERY.md](/home/hema/Projects/basicdiet145/docs/dashboard-contracts/12_DELIVERY.md:384)
- Fix type: **ALIGN CONTRACT**
- Exact fix instruction:
  - Keep `CANCELLATION_REASONS` as the backend authority.
  - Replace documented/dashboard reason values with its exact keys.
  - Remove the dashboard’s `customer_unreachable` fallback.
  - Require the action payload to carry an accepted reason selected from the aligned contract.
- Risk if not fixed: Courier cancellation requests are structurally invalid.

---

## 2. ARCHITECTURE FIX PLAN (P1/P2)

### Premium

**What to consolidate**

- P1: Route all subscription premium pricing through `resolvePremiumUpgrade()`.
- P1: Retain `resolveCanonicalPremiumIdentity()` only as canonical-key validation and config resolution.
- P1: Apply one predicate everywhere: `status=active`, `isEnabled=true`, `isVisible=true`.
- P2: Move supported candidate source mappings into [mealPlannerContract.js](/home/hema/Projects/basicdiet145/src/config/mealPlannerContract.js:1).

**What to delete**

- P1: `PREMIUM_MEAL_EXTRA_FEE_HALALA_BY_KEY`.
- P1: Subscription use of `PREMIUM_LARGE_SALAD_FIXED_PRICE_HALALA`.
- P1: Meal Builder literal 2000/2900 defaults.
- P1: Subscription pricing from `BuilderProtein.extraFeeHalala`.
- P1: Name-based premium identity inference after data migration.
- P2: `basic_salad` as a premium pricing fallback.

**What to enforce**

- P1: `premiumKey` required at quote, checkout, activation, planner, balance, and payment boundaries.
- P1: Config absence for a requested premium key must produce a controlled unavailable/configuration result once migration is complete.
- P2: `mapConfigToDTO()` must calculate publication and relation validity using the candidate eligibility resolver, not placeholders.

### Subscription

**What to consolidate**

- P1: Quote, activation, renewal, planner, and timeline reads must use canonical `premiumKey`.
- P1: Backend DTOs must expose premium coverage, pending count, and pending amount already calculated.

**What to delete**

- P1: Name matching and localized-name inference from activation and read paths.
- P2: `premiumMealId` and `proteinId` acceptance from new quote requests.
- P2: Legacy ID matching after stored contracts and balances are migrated.

**What to enforce**

- P1: All newly persisted premium balance and entitlement rows require `premiumKey`.
- P1: Premium pricing snapshots must contain the resolved config revision/source.
- P2: Legacy records remain read-only compatibility inputs; they cannot define new prices or identities.

### Delivery

**What to consolidate**

- P1: Make [opsTransitionService.js](/home/hema/Projects/basicdiet145/src/services/dashboard/opsTransitionService.js:33) the only delivery/subscription-day mutation entry point.
- P1: Move the final transition table into that service and make courier controllers delegate to it.
- P1: Synchronize `SubscriptionDay.status` and `Delivery.status` inside the same transaction.

**What to delete**

- P1: Unused [subscriptionDayTransitionService.js](/home/hema/Projects/basicdiet145/src/services/subscription/subscriptionDayTransitionService.js:1).
- P1: Competing transition definitions in [state.js](/home/hema/Projects/basicdiet145/src/utils/state.js:1) after their rules are absorbed.
- P1: Direct status assignment in courier controllers.
- P2: `ready_for_delivery → fulfilled`; require dispatch first.
- P2: `scheduled` eligibility for arriving-soon.

**What to enforce**

- P1: Delivery sequence: `in_preparation → ready_for_delivery → out_for_delivery → fulfilled`.
- P1: Cancellation and fulfillment must update both persisted state documents atomically.
- P2: All courier mutation responses must use `deliveryMapper`.

### Pickup

**What to consolidate**

- P1: Move pickup-request transition rules out of the local function in `opsTransitionService` into the same canonical transition policy.
- P1: Keep reservation, consumption, and release in `subscriptionPickupRequestBalanceService`; invoke them only from canonical transitions.
- P1: Route no-show settlement through the canonical pickup transition.

**What to delete**

- P1: Direct pickup status mutation in settlement and operations handlers after canonical transition methods exist.
- P2: Caller-dependent duplicate protection as the only guard.

**What to enforce**

- P1: A transition and its credit side effect occur within one transaction.
- P2: Canonical request identity must be derived from subscription, date, and normalized selection; `idempotencyKey` remains request replay protection.

### Dashboard

**What to consolidate**

- P1: Consume backend `allowedActions`, premium totals, balances, and payment requirements directly.
- P2: Use one canonical operations DTO shape.

**What to delete**

- P1: `FALLBACK_PICKUP_ACTIONS_BY_STATUS` in [oneTimeOrderActions.ts](/home/hema/Projects/full%20app/client_dashbourd/src/lib/oneTimeOrderActions.ts:10).
- P1: Legacy `/api/admin/builder-premium-meals` usage from subscription creation.
- P1: `premiumMealId` form fields.
- P2: Multi-alias business fallbacks in `operationsBoard.ts` after DTO migration.
- P2: UI wording that describes upgrades as additional meals.

**What to enforce**

- P1: Subscription creation submits `{premiumKey, qty}`.
- P1: Dashboard renders backend premium coverage and payment data.
- P2: SAR conversion remains display formatting only; submitted values use the documented halala field.

### Flutter

**What to consolidate**

- P1: Consume backend-provided premium coverage and pending-payment DTO fields.
- P1: Build quote, checkout, and planner writes using `premiumKey`.

**What to delete**

- P1: `evaluatePremiumUsage()` and generic-credit premium calculations as commercial authorities.
- P1: Premium matching by ID or normalized name.
- P2: Premium salad identity/price derivation from product fields.
- P2: Legacy selection-type normalization after backend read DTO migration.

**What to enforce**

- P1: Flutter may display backend calculations but must not decide premium coverage or charge amount.

---

## 3. SINGLE SOURCE OF TRUTH ENFORCEMENT MAP

### Pricing

**Only authority**

- [premiumUpgradeConfigService.js](/home/hema/Projects/basicdiet145/src/services/subscription/premiumUpgradeConfigService.js:41)
- Canonical API: `resolvePremiumUpgrade(premiumKey, {session})`

**MUST KEEP**

- `PremiumUpgradeConfig.upgradeDeltaHalala`
- Candidate-derived price only as an initial admin form value.
- One-time order pricing isolated in order pricing services.

**MUST REMOVE**

- `CatalogService.PREMIUM_MEAL_EXTRA_FEE_HALALA_BY_KEY`
- Subscription use of `PREMIUM_LARGE_SALAD_FIXED_PRICE_HALALA`
- Meal Builder 2000/2900 literals
- Subscription price fallback to option/relation/product/builder fields
- Flutter premium charge calculations

**MUST MIGRATE**

- CatalogService
- canonicalMealSlotPlannerService
- mealSlotPlannerService
- mealBuilderConfigService
- subscriptionQuoteService
- premiumIdentity
- subscription activation/payment services

### Identity

**Only authority**

- `premiumKey`, validated by a reduced `resolveCanonicalPremiumIdentity({premiumKey})` in [premiumIdentity.js](/home/hema/Projects/basicdiet145/src/utils/subscription/premiumIdentity.js:117).

**MUST KEEP**

- Canonical key normalization.
- Explicit alias conversion only during stored-data migration.

**MUST REMOVE**

- Localized-name inference.
- `premiumMealId`/`proteinId` identity fallback.
- Flutter name and legacy-ID matching.
- New `legacy_<id>` identities.

**MUST MIGRATE**

- Existing premium balances.
- Contract snapshots.
- Checkout drafts.
- Subscription-day premium selections.
- Timeline/read DTOs.

### State

**Only authority**

- [opsTransitionService.js](/home/hema/Projects/basicdiet145/src/services/dashboard/opsTransitionService.js:33)

**MUST KEEP**

- Transactional state changes.
- Delivery synchronization.
- Pickup balance service for credit mutation.
- Fulfillment service as a transition side-effect dependency.

**MUST REMOVE**

- `subscriptionDayTransitionService.js`
- `utils/state.js` after consolidation
- Local pickup transition tables
- Direct controller status writes
- Direct settlement status writes

**MUST MIGRATE**

- Courier collect, deliver, cancel, and arriving-soon handlers.
- Order courier mutations.
- Pickup preparation, fulfillment, cancellation, and no-show settlement.

---

## 4. DEPRECATION PLAN

### Disable after consumer migration

- `/api/admin/builder-premium-meals` as a subscription premium source.
- Public legacy builder premium catalog route.
- Legacy premium ID acceptance in quote/checkout.
- `legacy_meal_count` for new pickup requests.

### Remove

- [premiumProteinService.js](/home/hema/Projects/basicdiet145/src/services/premiumProteinService.js:1).
- [subscriptionDayTransitionService.js](/home/hema/Projects/basicdiet145/src/services/subscription/subscriptionDayTransitionService.js:1).
- Hardcoded premium protein/salad prices.
- `basic_salad` premium-price fallback.
- Premium name inference after stored data has canonical keys.
- Dashboard status-derived action tables.
- Flutter premium accounting and identity fallbacks.

### Keep temporarily as read-only compatibility

- Legacy `BuilderProtein` and builder IDs on historical records.
- Legacy selection-type readers.
- Grandfathered subscription contract reads.
- Historical `premiumMealId` and `proteinId` fields.
- Legacy pickup request records without canonical item selection.

These compatibility paths must not price, identify, or authorize new writes.

---

## 5. SAFE EXECUTION ORDER

1. Add the canonical premium pricing resolver to `premiumUpgradeConfigService.js` while retaining internal compatibility fallback.

2. Populate complete `PremiumUpgradeConfig` rows for every canonical `premiumKey` and migrate stored premium identities to `premiumKey`.

3. Migrate quote, activation, catalog, planner, Meal Builder, and payment consumers to the resolver.

4. Change dashboard subscription creation to submit `{premiumKey, qty}`.

5. Change Flutter to consume backend premium coverage and pending-payment values.

6. Remove name/ID identity inference from new write paths.

7. Remove hardcoded 2000/2900 values and catalog/builder pricing fallbacks.

8. Implement the dashboard Premium Upgrade Config screen and disable Meal Builder usage on that route.

9. Consolidate transition rules into `opsTransitionService.js`.

10. Migrate courier, order, delivery, pickup, fulfillment, and settlement mutations to the canonical transition service.

11. Remove competing state tables and direct status writes.

12. Align delivery cancellation reason codes and unified courier mutation DTOs.

13. Remove frontend action synthesis and multi-shape business fallbacks.

14. Disable legacy builder-premium subscription routes and remove statically unused legacy services.