# Backend Menu and Meal Planner Design System

This README documents the backend design system for the subscription menu and meal planner cycle in this project. It is written as a portable technical brief: you can paste it into ChatGPT or share it with another engineer to explain what was built, why it exists, and where to improve it.

## Purpose

The backend separates the meal planner into three connected layers:

1. Catalog design: what the customer is allowed to choose.
2. Planner validation: whether a daily set of choices is structurally valid.
3. Commercial lifecycle: whether the day can be saved, paid, confirmed, and fulfilled.

The current planner is canonical slot-based. The backend no longer accepts legacy day selection payloads as the source of truth. A client must submit `mealSlots`, and the backend derives compatibility projections such as `selections`, `premiumUpgradeSelections`, `baseMealSlots`, and `materializedMeals`.

## Core Principle

Catalog keys and planner rules are the contract. Mongo documents hold localized names, prices, availability, sort order, UI metadata, and operational references.

Important contract file:

- `src/config/mealPlannerContract.js`

Important runtime services:

- `src/services/catalog/CatalogService.js`
- `src/services/subscription/mealPlannerCatalogService.js`
- `src/services/subscription/mealSlotPlannerService.js`
- `src/services/subscription/subscriptionSelectionService.js`
- `src/services/subscription/subscriptionDayCommercialStateService.js`
- `src/services/admin/mealPlannerMenu.service.js`

## Domain Vocabulary

### Selection Types

The canonical selection types are:

- `standard_meal`: a normal plate meal built from one standard protein and one or two carb selections.
- `premium_meal`: a premium plate meal built from one premium protein and one or two carb selections.
- `premium_large_salad`: a configurable salad product with ingredient groups and a premium salad fee.
- `sandwich`: a complete product selection with no separate protein, carb, or salad payload.

Legacy selection names still exist for compatibility mapping:

- `standard_combo`
- `custom_premium_salad`
- `sandwich`

### Meal Slot

A `mealSlot` represents one meal position inside a subscription day.

Canonical shape:

```json
{
  "slotIndex": 1,
  "slotKey": "slot_1",
  "selectionType": "standard_meal",
  "proteinId": "protein_option_or_builder_id",
  "carbs": [
    { "carbId": "carb_option_or_builder_id", "grams": 150 }
  ]
}
```

The backend normalizes missing `slotKey` values to `slot_{slotIndex}`.

Slot statuses are derived:

- `empty`: no usable selection data.
- `partial`: some data exists but validation failed or the slot is incomplete.
- `complete`: the slot passed validation.

## Catalog Architecture

### Admin Catalog Management

Admin CRUD is exposed through:

- `/api/admin/meal-planner-menu/*`
- `/api/dashboard/meal-planner/*`

Both mounts use the same router:

- `src/routes/adminMealPlannerMenu.routes.js`
- `src/controllers/admin/mealPlannerMenu.controller.js`
- `src/services/admin/mealPlannerMenu.service.js`

Admin resources:

- Categories: `/categories`
- Standard proteins: `/proteins`
- Premium proteins: `/premium-proteins`
- Carbs: `/carbs`
- Sandwiches: `/sandwiches`
- One-time add-ons: `/addons`
- Premium large salad ingredients: `/salad-ingredients`

The admin service enforces:

- localized names with `{ ar, en }`
- snake_case immutable keys
- positive and non-negative numeric validation
- active/inactive soft deletion
- sort ordering
- category auto-creation from the planner contract
- premium key uniqueness
- `SAR` as system currency
- audit logging from the controller when dashboard user metadata exists

### Customer Catalog Read APIs

The broad subscription checkout catalog is:

```http
GET /api/subscriptions/menu
```

It returns subscription plans, delivery choices, legacy-compatible regular meal structures, add-ons, and flow metadata.

The canonical meal planner catalog is:

```http
GET /api/subscriptions/meal-planner-menu
GET /api/subscriptions/meal-planner-menu?includeLegacy=true
```

Default response:

```json
{
  "status": true,
  "data": {
    "builderCatalog": {},
    "builderCatalogV2": {},
    "addonCatalog": {}
  }
}
```

`includeLegacy=true` adds older `regularMeals`, `premiumMeals`, `addons`, and `currency` fields for older clients.

## Builder Catalog V1

`builderCatalog` is the stable canonical planner catalog.

Main fields:

- `categories`
- `proteins`
- `premiumProteins`
- `carbs`
- `sandwiches`
- `premiumLargeSalad`
- `rules`

Standard proteins include:

- `id`
- `key`
- `displayCategoryKey`
- `name`
- `nameI18n`
- `description`
- `descriptionI18n`
- `proteinFamilyKey`
- `proteinFamilyNameI18n`
- `ruleTags`
- `selectionType: "standard_meal"`
- `isPremium: false`
- `sortOrder`

Premium proteins include the same base fields plus:

- `selectionType: "premium_meal"`
- `isPremium: true`
- `premiumKey`
- `extraFeeHalala`

Carbs are filtered to customer-visible options and exclude the large salad pseudo-category from plate meal carb selections.

Sandwiches are subscription-compatible cold sandwich products.

`premiumLargeSalad` contains:

- `enabled`
- `premiumKey`
- `selectionType`
- `presetKey`
- `extraFeeHalala`
- `priceHalala`
- `priceSource`
- `currency`
- `groups`
- `ingredients`

## Builder Catalog V2

`builderCatalogV2` is the newer section-oriented catalog. It is generated from the same source material as V1.

Main shape:

```json
{
  "catalogVersion": "builder_catalog.v2",
  "currency": "SAR",
  "sections": [],
  "rules": {}
}
```

Sections:

- `standard_meal`: meal builder with protein and carb option groups.
- `premium_meal`: meal builder with premium protein and carb option groups.
- `sandwich`: product list.
- `premium_large_salad`: configurable product with option groups.

V2 is better for UI construction because each section owns its option groups, products, UI metadata, relation constraints, and rules.

## Planner Rules

Rules come from `getMealPlannerRules()`.

Current rule version:

```text
meal_planner_rules.v3
```

Important rules:

- Standard and premium plate meals can use at most 2 carb types.
- Total carb grams per plate meal cannot exceed 300g.
- Standard beef is limited to 1 base beef slot per day.
- Premium large salad has fixed group min/max constraints.
- Premium large salad excludes `extra_protein_50g` for subscription salad planning.
- Premium large salad requires exactly one allowed salad protein.

Protein visual groups:

- `chicken`
- `beef`
- `fish`
- `eggs`
- `premium`
- `other`

The standard meal picker can display extended protein options, including variants such as fajita, spicy chicken, meatballs, fish fillet, tuna, and premium proteins in the Premium tab. Validation still depends on the selected option record and selection type.

## Day Planning API Cycle

### 1. Load Catalog

```http
GET /api/subscriptions/meal-planner-menu
```

The client should use `builderCatalog` or `builderCatalogV2` to build the meal picker. IDs submitted later must come from the active catalog options.

### 2. Read Subscription Day

```http
GET /api/subscriptions/:id/days/:date
```

The day response includes shaped planner fields through `shapeMealPlannerReadFields`.

Important read fields:

- `mealSlots`
- `plannerMeta`
- `plannerState`
- `plannerRevisionHash`
- `paymentRequirement`
- `commercialState`
- `premiumSummary`
- `addonSummary`
- `premiumExtraPayment`
- `isFulfillable`
- `canBePrepared`
- `rules`

### 3. Validate Without Saving

```http
POST /api/subscriptions/:id/days/:date/selection/validate
```

Body:

```json
{
  "mealSlots": [],
  "addonsOneTime": []
}
```

This runs the same validation and commercial-state derivation as saving, but does not persist the day.

### 4. Save Draft

```http
PUT /api/subscriptions/:id/days/:date/selection
```

Body:

```json
{
  "mealSlots": [],
  "addonsOneTime": []
}
```

The backend rejects legacy payloads that do not include canonical `mealSlots`.

Save behavior:

- verifies subscription ownership
- resolves the effective planning subscription
- checks active subscription and date range
- checks day modifiability and cutoff policy
- rejects locked or already confirmed days
- builds a canonical meal slot draft
- reconciles one-time add-ons
- derives commercial state
- computes `plannerRevisionHash`
- upserts `SubscriptionDay`
- synchronizes compatibility fields
- consumes or releases premium and add-on balances atomically
- persists premium/add-on pending payment state
- returns the shaped day payload

The save endpoint is idempotent when the new planner revision hash matches the existing day.

### 5. Handle Payments If Needed

After saving, inspect:

```json
{
  "paymentRequirement": {
    "requiresPayment": true,
    "canCreatePayment": true,
    "pendingAmountHalala": 2900,
    "blockingReason": "PREMIUM_PAYMENT_REQUIRED"
  }
}
```

Unified day payments:

```http
POST /api/subscriptions/:id/days/:date/payments
POST /api/subscriptions/:id/days/:date/payments/:paymentId/verify
```

The planner revision hash protects payment correctness. If the client changes meal slots after creating a payment, the backend can mark payment state as `revision_mismatch`.

### 6. Confirm Day

```http
POST /api/subscriptions/:id/days/:date/confirm
```

Confirmation revalidates the saved `mealSlots`. It requires:

- day status is `open`
- planner state is not already `confirmed`
- no partial slots
- complete slot count is at least the required count
- no pending premium or add-on payment
- commercial state is `ready_to_confirm`

On success:

- `plannerState` becomes `confirmed`
- `planningState` becomes `confirmed`
- `planningMeta` is updated for legacy compatibility
- `plannerRevisionHash` is refreshed
- day becomes commercially `confirmed`
- `isFulfillable` and `canBePrepared` can become true if the day remains operationally open

### 7. Bulk Save

```http
PUT /api/subscriptions/:id/days/selections/bulk
```

Supported body styles:

```json
{
  "dates": ["2026-04-15", "2026-04-16"],
  "mealSlots": []
}
```

or:

```json
{
  "days": [
    {
      "date": "2026-04-15",
      "mealSlots": [],
      "addonsOneTime": []
    }
  ]
}
```

Bulk payloads without canonical `mealSlots` are rejected per date.

## Slot Validation Rules

### Shared Slot Rules

Every slot must have:

- positive integer `slotIndex`
- selection type
- unique `slotIndex`
- unique `slotKey` when supplied

The day cannot exceed its required or maximum slot count.

### Standard Meal

Allowed:

- standard protein
- one or two carb selections

Forbidden:

- premium protein
- sandwich ID
- salad payload

Errors include:

- `PROTEIN_REQUIRED`
- `INVALID_PROTEIN_TYPE`
- `CARBS_REQUIRED`
- `TOO_MANY_CARBS`
- `INVALID_CARB_ID`
- `DUPLICATE_CARB`
- `INVALID_GRAMS`
- `CARB_LIMIT_EXCEEDED`
- `STANDARD_MEAL_EXCLUSIVITY_VIOLATION`

### Premium Meal

Allowed:

- premium protein
- one or two carb selections

Premium protein identity can resolve by:

- `_id`
- `id`
- `premiumKey`
- `key`

If the user has premium balance for the selected `premiumKey`, the slot is covered by balance. Otherwise, it becomes `pending_payment`.

Errors include:

- `PROTEIN_REQUIRED`
- `INVALID_PROTEIN_TYPE`
- carb errors
- `PREMIUM_MEAL_EXCLUSIVITY_VIOLATION`

### Premium Large Salad

Allowed:

- salad group payload
- exactly one allowed subscription salad protein
- ingredient selections that match group configuration

Forbidden:

- plate meal carbs
- sandwich ID
- excluded subscription salad option groups
- premium proteins as salad proteins

Errors include:

- `CARBS_NOT_ALLOWED`
- `SANDWICH_NOT_ALLOWED`
- `SALAD_STRUCTURE_REQUIRED`
- `INVALID_SALAD_GROUP`
- `SALAD_OPTION_NOT_ALLOWED`
- `SALAD_PROTEIN_REQUIRED`
- `SALAD_SAUCE_REQUIRED`
- `SALAD_GROUP_MIN_SELECT`
- `SALAD_GROUP_MAX_SELECT_EXCEEDED`
- `DUPLICATE_SALAD_INGREDIENT`
- `SALAD_PROTEIN_INVALID`
- `SALAD_PROTEIN_NOT_ALLOWED`
- `INVALID_SALAD_INGREDIENT`
- `SALAD_INGREDIENT_GROUP_MISMATCH`
- `SALAD_PROTEIN_MISMATCH`

### Sandwich

Allowed:

- `sandwichId`

Forbidden:

- `proteinId`
- carbs
- salad payload

Errors include:

- `SANDWICH_ID_REQUIRED`
- `INVALID_SANDWICH_MEAL`
- `SANDWICH_EXCLUSIVITY_VIOLATION`

## Commercial State System

Commercial state is derived by `buildDayCommercialState`.

The backend computes:

- `plannerRevisionHash`
- `premiumSummary`
- `addonSummary`
- `premiumExtraPayment`
- `paymentRequirement`
- `commercialState`
- `isFulfillable`
- `canBePrepared`

### Planner Revision Hash

The revision hash is a SHA-256 hash of normalized meal slots and add-on selections.

It normalizes:

- slot index
- slot key
- status
- selection type
- protein ID
- sandwich ID
- sorted carb selections
- normalized salad groups
- premium source
- premium fee
- add-on ID/source/price

This hash is used to:

- make save operations idempotent
- attach payments to the exact planner revision
- detect payment revision mismatch after edits

### Payment Requirement

`paymentRequirement` tells the client if the user must pay before confirmation.

Important fields:

- `status`
- `requiresPayment`
- `pricingStatus`
- `blockingReason`
- `canCreatePayment`
- `premiumSelectedCount`
- `premiumPendingPaymentCount`
- `addonSelectedCount`
- `addonPendingPaymentCount`
- `pendingAmountHalala`
- `amountHalala`
- `currency`

Blocking reasons include:

- `LOCKED`
- `PAYMENT_REVISION_MISMATCH`
- `PRICING_FAILED`
- `PRICING_PENDING`
- `PREMIUM_PAYMENT_REQUIRED`
- `ADDON_PAYMENT_REQUIRED`
- `PLANNING_INCOMPLETE`
- `PLANNER_UNCONFIRMED`

### Commercial State Values

- `draft`: planning is incomplete or invalid.
- `payment_required`: planning is complete but payment is still required.
- `ready_to_confirm`: planning is complete and no payment is required.
- `confirmed`: planner has been confirmed.

## Persistence and Compatibility Projections

The canonical persisted field is:

- `SubscriptionDay.mealSlots`

Derived compatibility fields:

- `materializedMeals`
- `selections`
- `premiumUpgradeSelections`
- `baseMealSlots`
- `plannerMeta`
- `planningMeta`

Operational projection behavior:

- Plate meals materialize one primary carb for kitchen compatibility while keeping the full `carbs[]` split on the canonical slot.
- Premium large salad materializes as `salad:premium_large_salad`.
- Sandwiches materialize as `sandwich:{sandwichId}`.
- Premium selections are projected into `premiumUpgradeSelections`.
- Base selections are projected into `baseMealSlots`.

These fields should not be treated by the client as the planner source of truth.

## Availability and Catalog Compatibility

The catalog builder and slot validator both check active and subscription-compatible catalog records.

Catalog sources include:

- `MenuOptionGroup`
- `MenuOption`
- `MenuProduct`
- `MenuCategory`
- `BuilderProtein`
- `BuilderCarb`
- `Sandwich`
- `SaladIngredient`
- `Addon`

Global catalog availability is filtered through:

- `src/services/catalog/catalogAvailabilityService.js`

The system supports compatibility between newer menu catalog records and older builder catalog records during validation.

## Client Guidance

Recommended client behavior:

- Build UI from `builderCatalogV2` when available.
- Fall back to `builderCatalog` if needed.
- Use backend IDs exactly as returned by the catalog.
- Do not construct rules locally when `rules` and `plannerMeta` are returned.
- Use `/selection/validate` for pre-save feedback.
- Use `/selection` to save draft.
- Inspect `paymentRequirement` before showing confirm.
- Create and verify day payment only when `paymentRequirement.canCreatePayment` is true.
- Call `/confirm` only when `commercialState` is `ready_to_confirm`.
- Treat `mealSlots` as canonical.
- Treat `selections`, `premiumUpgradeSelections`, and `materializedMeals` as compatibility/read-only projections.

## Improvement Backlog

These are high-value improvement areas to discuss with ChatGPT or another engineer:

1. Replace the no-op meal planner catalog cache invalidation with a real cache strategy or remove the abstraction.
2. Decide whether `builderCatalogV2` should become the only supported frontend contract.
3. Move remaining legacy builder model dependencies into a clear compatibility adapter.
4. Add a generated OpenAPI schema for `MealSlot`, `builderCatalog`, `builderCatalogV2`, `plannerMeta`, and `paymentRequirement`.
5. Add contract tests that compare catalog output against validation behavior so the UI never receives options that saving rejects.
6. Add tests for premium large salad group edge cases and payment revision mismatch.
7. Add admin-side health checks for orphaned catalog keys, unavailable linked products, duplicate premium keys, and missing required menu option groups.
8. Consider a catalog version field in saved day slots to make future migrations easier.
9. Create a migration playbook for old clients still reading legacy fields.
10. Improve naming consistency between `plannerState`, `planningState`, `plannerMeta`, and `planningMeta`.

## Quick Prompt for ChatGPT

Use this prompt when asking ChatGPT to help improve the system:

```text
I built a Node.js/MongoDB backend meal planner for a subscription food app. The canonical planner input is mealSlots. The backend exposes /subscriptions/meal-planner-menu with builderCatalog and builderCatalogV2, validates day plans through mealSlotPlannerService, saves drafts through subscriptionSelectionService, derives payment/commercial state through subscriptionDayCommercialStateService, and confirms days only after complete planning and payment settlement.

Please review the architecture for maintainability, API contract clarity, validation consistency, payment safety, and frontend developer experience. Suggest concrete improvements without breaking the canonical mealSlots contract.
```

