# Backend Refactor Brief: Menu And Meal Planner Cycle

Date: 2026-06-06
Audience: backend engineer
Scope: backend/database/API only for menu and subscription meal planner.

## Executive Decision

Refactor the meal planner so it follows the same catalog pattern as the client menu:

`section/category -> product -> option group -> option -> product-specific relation rules/prices`

The seed already models this correctly in `scripts/seed-catalog.js`. The refactor should stop treating the meal planner as a separate legacy builder system and make it a subscription-facing view of the same canonical menu catalog.

The backend should become easier for:

- frontend dashboard: manage menu/planner from one product-centric catalog;
- mobile app: render planner screens from one stable response without hardcoded business rules;
- backend: validate, price, publish, and migrate from one source of truth;
- operations/kitchen: receive materialized snapshots after confirmation without depending on old planner IDs.

## Source Files Used For This Brief

- `scripts/seed-catalog.js`
- `docs/basic_diet_menu_documentation.md`
- `src/models/MenuCategory.js`
- `src/models/MenuProduct.js`
- `src/models/MenuOptionGroup.js`
- `src/models/MenuOption.js`
- `src/models/ProductOptionGroup.js`
- `src/models/ProductGroupOption.js`
- `src/models/SubscriptionDay.js`
- `src/services/orders/menuCatalogService.js`
- `src/services/catalog/CatalogService.js`
- `src/services/subscription/mealSlotPlannerService.js`
- `src/services/admin/mealPlannerMenu.service.js`
- `docs/audit/CATALOG_ARCHITECTURE_RISK_AUDIT.md`

Note: the named skill `senior-fullstack-leader` was found locally and used for the architecture approach. Its optional reference files were not present in the local skill folder, so this brief applies the skill's core architecture/API/database guidance directly.

## What The Client Menu Pattern Actually Is

From `basic_diet_menu_documentation.md`, the client menu has:

- 8 visible customer categories.
- 53 listed items.
- Mostly simple fixed-price products.
- A few configurable products:
  - `basic_salad`: configurable salad with required/optional groups.
  - `greek_yogurt`: optional toppings.
  - `meal_grilled_chicken`: required carb base.
- Nutrition-first presentation: calories/macros matter to UI.

From `seed-catalog.js`, the backend implementation pattern is richer and more useful:

- categories are app/admin sections:
  - `custom_order`
  - `meals`
  - `carbs`
  - `light_options`
  - `cold_sandwiches`
  - `sourdough`
  - `desserts`
  - `juices`
  - `drinks`
  - `ice_cream`
- groups are reusable:
  - `proteins`
  - `carbs`
  - `leafy_greens`
  - `vegetables_legumes`
  - `cheese_nuts`
  - `fruits`
  - `sauces`
  - `extra_protein_50g`
- products attach groups with product-specific rules:
  - `ProductOptionGroup.minSelections`
  - `ProductOptionGroup.maxSelections`
  - `ProductOptionGroup.isRequired`
- products attach only allowed options with product-specific prices:
  - `ProductGroupOption.extraPriceHalala`
  - `ProductGroupOption.extraWeightUnitGrams`
  - `ProductGroupOption.extraWeightPriceHalala`

This is the pattern to follow for the meal planner.

## Current Problem

The backend currently has two overlapping menu/planner worlds.

Canonical menu world:

- `MenuCategory`
- `MenuProduct`
- `MenuOptionGroup`
- `MenuOption`
- `ProductOptionGroup`
- `ProductGroupOption`
- `MenuVersion`
- `MenuAuditLog`

Legacy planner world:

- `BuilderProtein`
- `BuilderCarb`
- `BuilderCategory`
- `Meal`
- `MealCategory`
- `Sandwich`
- `SaladIngredient`
- old fields inside `SubscriptionDay.mealSlots`

The seed comments already say `Menu*` collections are canonical and `Builder*`, `Sandwich`, and `SaladIngredient` are temporary mirrors. But the planner services still read those mirrors in important paths.

That creates these backend and UI/UX problems:

- dashboard menu edits can drift from planner validation;
- mobile receives a menu-like catalog but writes old planner-shaped payloads;
- backend validation has to query multiple model families;
- premium salad rules are partly seed relations and partly hardcoded constants;
- frontend/mobile must understand too many legacy concepts;
- publishing/menu versioning is not the single authority for planner catalog availability.

## Target Architecture

### One Catalog, Two Customer Surfaces

Use one canonical menu catalog and expose two customer-facing projections:

1. One-time menu projection:
   - current `publicMenuV2`;
   - category/product/action style;
   - browse, customize, direct add.

2. Subscription planner projection:
   - new canonical planner contract;
   - section/product/group/option style;
   - slot planning, validation, premium/payment state.

Both projections must read the same canonical rows:

```txt
MenuCategory
  -> MenuProduct
    -> ProductOptionGroup
      -> MenuOptionGroup
        -> ProductGroupOption
          -> MenuOption
```

Do not create a new planner catalog database model unless there is a proven performance reason. The existing relation model is the right domain shape.

### Backend Layering

Recommended layers:

```txt
routes
  -> controllers
    -> services
      -> catalog reader / validator / pricing / projector
        -> mongoose models
```

Controllers should not own business rules. The planner business rules belong in services.

## Database Refactor

### Keep Existing Canonical Models

Keep these as the primary data model:

- `MenuCategory`
- `MenuProduct`
- `MenuOptionGroup`
- `MenuOption`
- `ProductOptionGroup`
- `ProductGroupOption`
- `MenuVersion`
- `CatalogItem`

### Add Small Planner Metadata

Add an optional embedded `planner` object to `MenuProduct` and `MenuOption` only where needed.

Recommended `MenuProduct.planner`:

```js
planner: {
  enabled: Boolean,
  sectionKey: String,
  selectionType: {
    type: String,
    enum: ["standard_meal", "premium_meal", "premium_large_salad", "sandwich", "addon"]
  },
  slotBehavior: {
    type: String,
    enum: ["configurable_product", "product_list", "direct_add"]
  },
  premiumKey: String,
  premiumCreditCost: Number,
  fulfillmentSkuTemplate: String
}
```

Recommended `MenuOption.planner`:

```js
planner: {
  selectionType: String,
  proteinFamilyKey: String,
  displayCategoryKey: String,
  isPremium: Boolean,
  premiumKey: String,
  premiumCreditCost: Number,
  ruleTags: [String]
}
```

Important: do not duplicate relation-level price/rule data into this metadata. Product-specific availability and price must stay in `ProductOptionGroup` and `ProductGroupOption`.

### Normalize Group Keys

The seed uses `vegetables_legumes`; the planner contract currently uses `vegetables` in some places. Pick one canonical API key and alias internally.

Recommendation:

- DB group key remains `vegetables_legumes` because seed/menu already uses it.
- Planner response may expose `canonicalGroupKey: "vegetables"` only if mobile already depends on it.
- Validator must accept old aliases during migration but store canonical DB group keys in new slots.

### Nutrition

The client menu is nutrition-first. Expand nutrition support consistently:

- `MenuOption.nutrition` already exists.
- Add `MenuProduct.nutrition` if missing:

```js
nutrition: {
  calories: Number,
  proteinGrams: Number,
  carbGrams: Number,
  fatGrams: Number
}
```

Return nutrition in both one-time menu and planner projections. Mobile should not need a separate nutrition lookup.

### SubscriptionDay Canonical Slot Shape

New writes should store canonical menu IDs:

```js
mealSlots: [
  {
    slotIndex: 1,
    slotKey: "slot_1",
    status: "empty" | "partial" | "complete",
    selectionType: "standard_meal",
    productId: ObjectId,          // MenuProduct
    productKey: "basic_meal",
    selectedOptions: [
      {
        groupId: ObjectId,        // MenuOptionGroup
        groupKey: "proteins",
        optionId: ObjectId,       // MenuOption
        optionKey: "grilled_chicken",
        quantity: 1,
        grams: null,
        extraPriceHalala: 0
      },
      {
        groupId: ObjectId,
        groupKey: "carbs",
        optionId: ObjectId,
        optionKey: "white_rice",
        quantity: 1,
        grams: 150,
        extraPriceHalala: 0
      }
    ],
    pricingSnapshot: {
      basePriceHalala: 0,
      optionsTotalHalala: 0,
      premiumExtraFeeHalala: 0,
      totalHalala: 0,
      currency: "SAR"
    },
    displaySnapshot: {
      name: { ar: "", en: "" },
      imageUrl: "",
      summary: { ar: "", en: "" },
      calories: 0,
      macros: {
        proteinGrams: 0,
        carbGrams: 0,
        fatGrams: 0
      }
    },
    fulfillmentSnapshot: {
      operationalSku: "",
      kitchenLabel: { ar: "", en: "" }
    },
    premium: {
      isPremium: false,
      premiumKey: null,
      source: "none",
      creditCost: 0
    },
    updatedAt: Date
  }
]
```

Keep old fields temporarily:

- `proteinId`
- `carbId`
- `carbs`
- `sandwichId`
- `salad`
- `customSalad`
- `materializedMeals`
- `selections`
- `baseMealSlots`
- `premiumUpgradeSelections`

But new API examples and new frontend/mobile work must not use them.

## Canonical Product Mapping

The planner should use the seeded product pattern.

### Standard Meal

Product:

- `basic_meal`
- category: `custom_order`
- pricing model: `per_100g`
- available for: `one_time`, `subscription`
- UI: `hero_builder`

Required groups:

- `proteins`: min 1, max 1
- `carbs`: min 1, max 2

Allowed options:

- proteins from the product relation, not hardcoded in mobile;
- carbs from the product relation, not hardcoded in mobile.

### Premium Meal

Do not make premium meal a separate legacy builder. Model it as a planner section using the same `basic_meal` product pattern with a premium protein relation/filter.

Product:

- still uses `basic_meal` as the configurable meal product unless backend creates a dedicated `premium_meal` virtual section.

Groups:

- `proteins`: premium options only;
- `carbs`: same carb group/rules as standard meal.

Premium extra fee must come from option metadata or relation metadata, then be snapshotted on save.

### Premium Large Salad

Product:

- `premium_large_salad`
- category: `custom_order`
- pricing model: `fixed`
- available for: `subscription`
- UI: `large_salad`

Groups:

- `leafy_greens`: min 0, max 2
- `vegetables_legumes`: min 0, max 19
- `fruits`: min 0, max 4
- `proteins`: min 1, max 1
- `cheese_nuts`: min 0, max 2
- `sauces`: min 1, max 1

Important:

- `extra_protein_50g` should not be active/visible/available for subscription `premium_large_salad`.
- The planner validator should enforce product relations, so this exclusion comes naturally from the relation table.
- Keep the hardcoded exclusion list only as a migration safety net until relation-driven validation is fully trusted.

### Sandwich

Product list section:

- source products from `cold_sandwiches` where `availableFor` includes `subscription`;
- use `MenuProduct`, not `Meal` or `Sandwich`, for new planner payloads.

### Planner Addons

Use `MenuProduct` or `Addon`, but pick one canonical path.

Recommendation:

- short term: keep existing `Addon` for subscription billing compatibility;
- medium term: link add-ons to `MenuProduct` for menu identity, nutrition, image, and visibility;
- response should normalize add-ons into the same product card shape as menu products.

## Target API Contract

### Planner Catalog Endpoint

Endpoint:

```txt
GET /api/subscriptions/meal-planner-menu?lang=ar
```

Default response should be canonical only:

```json
{
  "status": true,
  "data": {
    "contractVersion": "meal_planner_menu.v3",
    "catalogHash": "sha256...",
    "publishedVersionId": "string",
    "currency": "SAR",
    "sections": [
      {
        "id": "section:standard_meal",
        "key": "standard_meal",
        "type": "configurable_product",
        "name": "Standard Meal",
        "nameI18n": { "ar": "", "en": "" },
        "ui": {
          "cardVariant": "hero_builder_collection",
          "layout": "vertical_hero_list"
        },
        "products": [
          {
            "id": "MenuProduct id",
            "key": "basic_meal",
            "selectionType": "standard_meal",
            "itemType": "basic_meal",
            "pricing": {
              "model": "per_100g",
              "basePriceHalala": 1900,
              "currency": "SAR"
            },
            "nutrition": {},
            "action": {
              "type": "open_builder",
              "requiresBuilder": true
            },
            "ui": {
              "cardVariant": "hero_builder",
              "imageRatio": "wide"
            },
            "optionGroups": [
              {
                "groupId": "MenuOptionGroup id",
                "key": "proteins",
                "nameI18n": { "ar": "", "en": "" },
                "minSelections": 1,
                "maxSelections": 1,
                "isRequired": true,
                "ui": { "displayStyle": "radio_cards" },
                "optionSections": [
                  {
                    "key": "chicken",
                    "nameI18n": { "ar": "", "en": "Chicken" },
                    "optionIds": []
                  }
                ],
                "options": [
                  {
                    "optionId": "MenuOption id",
                    "key": "grilled_chicken",
                    "nameI18n": { "ar": "", "en": "" },
                    "imageUrl": "",
                    "nutrition": {},
                    "extraPriceHalala": 0,
                    "proteinFamilyKey": "chicken",
                    "displayCategoryKey": "chicken",
                    "isPremium": false,
                    "ruleTags": []
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "rules": {
      "version": "meal_planner_rules.v4",
      "beef": {
        "maxSlotsPerDay": 1
      }
    }
  }
}
```

Legacy output:

```txt
GET /api/subscriptions/meal-planner-menu?lang=ar&includeLegacy=true
```

Only this mode should return:

- `builderCatalog`
- `builderCatalogV2`
- `regularMeals`
- `premiumMeals`
- `addons`

### Planner Validation Endpoint

Endpoint:

```txt
POST /api/subscriptions/:id/days/:date/selection/validate
```

Canonical request:

```json
{
  "contractVersion": "meal_planner_menu.v3",
  "catalogHash": "sha256...",
  "mealSlots": [
    {
      "slotIndex": 1,
      "selectionType": "standard_meal",
      "productId": "MenuProduct id",
      "selectedOptions": [
        {
          "groupId": "MenuOptionGroup id",
          "optionId": "MenuOption id",
          "grams": null,
          "quantity": 1
        }
      ]
    }
  ],
  "addonsOneTime": []
}
```

Response:

```json
{
  "status": true,
  "data": {
    "valid": true,
    "normalizedMealSlots": [],
    "plannerMeta": {
      "requiredSlotCount": 2,
      "completeSlotCount": 2,
      "partialSlotCount": 0,
      "premiumSlotCount": 0,
      "premiumTotalHalala": 0,
      "isConfirmable": true
    },
    "paymentRequirement": {
      "required": false,
      "amountHalala": 0,
      "currency": "SAR"
    },
    "slotErrors": []
  }
}
```

### Save Draft Endpoint

Endpoint:

```txt
PUT /api/subscriptions/:id/days/:date/selection
```

Behavior:

- validate canonical slot payload;
- reject stale/unpublished/disabled products, groups, and options;
- write canonical `mealSlots`;
- compute planner meta;
- compute premium/addon payment requirement;
- project legacy fields only for downstream compatibility;
- return the same normalized day shape used by timeline and day detail.

### Confirm Endpoint

Endpoint:

```txt
POST /api/subscriptions/:id/days/:date/confirm
```

Behavior:

- revalidate stored canonical slots against the current published catalog;
- block if incomplete, unpaid, locked, frozen, skipped, stale, or outside cutoff policy;
- snapshot product names, images, nutrition, prices, kitchen labels, and operational SKUs;
- set planner state to `confirmed`;
- preserve the confirmed snapshot even if menu changes tomorrow.

## Services To Build Or Refactor

### 1. `mealPlannerCatalogV3Service`

Create:

```txt
src/services/subscription/mealPlannerCatalogV3Service.js
```

Responsibilities:

- read only canonical `Menu*` and relation models;
- build planner sections from seeded product patterns;
- return `standard_meal`, `premium_meal`, `sandwich`, `premium_large_salad`;
- include products, option groups, options, selection rules, UI metadata, nutrition, pricing, and action metadata;
- include `catalogHash` and `publishedVersionId`;
- support `lang`;
- avoid N+1 queries.

The implementation can reuse logic from `CatalogService.buildSubscriptionBuilderCatalogV2()`, but it should not first build legacy `builderCatalog` arrays. Canonical catalog should be first-class.

### 2. `mealPlannerSelectionValidator`

Create:

```txt
src/services/subscription/mealPlannerSelectionValidator.js
```

Responsibilities:

- validate submitted `productId`;
- validate product supports the submitted `selectionType`;
- validate selected groups are attached to that product;
- validate selected options are attached to that product and group;
- enforce relation-level min/max/isRequired;
- enforce grams/quantity rules;
- enforce beef daily limit;
- enforce premium credit/payment logic;
- compute price from product price plus relation option overrides;
- return normalized slots and frontend-safe errors.

The validator must not query `BuilderProtein`, `BuilderCarb`, `Meal`, `MealCategory`, `Sandwich`, or `SaladIngredient` for canonical payloads.

### 3. `legacyMealPlannerAdapter`

Create:

```txt
src/services/subscription/legacyMealPlannerAdapter.js
```

Responsibilities:

- convert old payload fields to canonical product/group/option selections;
- read old days safely;
- map old IDs to `MenuOption`/`MenuProduct` IDs where possible;
- add warnings/logs for unmapped records;
- keep old clients alive during migration.

This adapter is temporary. Keep it isolated.

### 4. Refactor `mealSlotPlannerService`

Change `buildMealSlotDraft()` into a small orchestrator:

```txt
if payload is canonical:
  call mealPlannerSelectionValidator
else:
  call legacyMealPlannerAdapter, then validator
project compatibility fields
return normalized draft
```

Do not keep adding business logic directly to the current large service.

### 5. Refactor Admin Meal Planner Management

Current admin meal-planner routes write legacy models. That keeps the drift alive.

Recommended:

- dashboard planner/menu management should use `/api/dashboard/menu/*`;
- old `/api/admin/meal-planner-menu/*` routes should become adapters over `Menu*` models;
- any create/update/toggle/delete should invalidate planner catalog cache;
- any dashboard edit should be visible in planner after publish.

## Publishing And Versioning

The menu pattern depends on publishing. The planner should too.

Required behavior:

- `MenuVersion` must include planner snapshot, not only public one-time menu snapshot;
- publishing must fail if planner catalog generation fails;
- no silent `{}` snapshot fallback;
- rollback must restore one-time menu and planner catalog behavior;
- response includes `publishedVersionId` or `catalogHash`;
- mobile can cache by hash/version.

Suggested `MenuVersion.snapshot` structure:

```js
snapshot: {
  publicMenuV2: {},
  mealPlannerMenuV3: {},
  dashboardCatalog: {
    categories: [],
    products: [],
    optionGroups: [],
    options: [],
    productGroups: [],
    productGroupOptions: []
  },
  validation: {
    ok: true,
    errors: [],
    warnings: []
  }
}
```

## Migration Plan

### Phase 0: Freeze The Contract

- Keep current endpoints.
- Add new canonical response under the existing planner endpoint.
- Keep legacy output behind `includeLegacy=true`.
- Add contract tests first.

### Phase 1: Canonical Read

- Implement `mealPlannerCatalogV3Service`.
- Ensure it reads seeded `Menu*` pattern directly.
- Ensure `standard_meal`, `premium_meal`, `sandwich`, and `premium_large_salad` are complete.
- Keep the old `builderCatalogV2` as compatibility only.

### Phase 2: Canonical Validate

- Implement `mealPlannerSelectionValidator`.
- Wire validation endpoint to canonical payloads.
- Keep legacy adapter for old payloads.

### Phase 3: Canonical Save

- Store `productId` and `selectedOptions` in `SubscriptionDay.mealSlots`.
- Still project old fields if kitchen/ops need them.
- Return normalized canonical day.

### Phase 4: Canonical Confirm

- Confirm from canonical slots.
- Create immutable display/pricing/fulfillment snapshots.
- Keep kitchen/ops stable even after menu changes.

### Phase 5: Admin Refactor

- Make meal-planner admin editing use canonical dashboard menu endpoints.
- Old admin planner endpoints should adapt to `Menu*` or be deprecated.

### Phase 6: Data Migration

Add:

```txt
scripts/migrate-subscription-days-to-canonical-menu-slots.js
```

Modes:

- `--dry-run`
- `--write`
- `--report output/planner-slot-migration-report.json`

Migration maps:

- old protein IDs -> `MenuOption` in `proteins`;
- old carb IDs -> `MenuOption` in `carbs`;
- old sandwich IDs -> `MenuProduct` in `cold_sandwiches`;
- old salad ingredient IDs -> canonical salad option groups/options;
- old premium salad key `custom_premium_salad` -> `premium_large_salad`.

Never silently drop old selections. Report unmapped rows.

## Validation Error Shape

Use one shape everywhere:

```json
{
  "slotIndex": 1,
  "fieldPath": "mealSlots[0].selectedOptions[1].optionId",
  "code": "OPTION_NOT_ATTACHED_TO_PRODUCT",
  "message": "Selected option is not available for this product",
  "details": {
    "productId": "",
    "groupId": "",
    "optionId": ""
  }
}
```

Recommended codes:

- `CATALOG_VERSION_STALE`
- `PRODUCT_REQUIRED`
- `PRODUCT_NOT_FOUND`
- `PRODUCT_NOT_AVAILABLE`
- `PRODUCT_NOT_ALLOWED_FOR_SUBSCRIPTION`
- `SELECTION_TYPE_MISMATCH`
- `GROUP_NOT_ATTACHED_TO_PRODUCT`
- `REQUIRED_GROUP_MISSING`
- `GROUP_MIN_SELECTION`
- `GROUP_MAX_SELECTION`
- `OPTION_NOT_IN_GROUP`
- `OPTION_NOT_ATTACHED_TO_PRODUCT`
- `OPTION_NOT_AVAILABLE`
- `DUPLICATE_OPTION`
- `INVALID_QUANTITY`
- `INVALID_GRAMS`
- `CARB_LIMIT_EXCEEDED`
- `BEEF_LIMIT_EXCEEDED`
- `PREMIUM_PAYMENT_REQUIRED`
- `PLANNER_INCOMPLETE`

## Performance Requirements

Catalog:

- batch load products, product-group relations, groups, product-option relations, and options;
- no per-product/per-group query loops for hot catalog endpoint;
- cache by `lang + publishedVersionId/catalogHash`;
- invalidate cache on publish, rollback, and menu edit.

Validation:

- collect all submitted product/group/option IDs first;
- load all required catalog docs and relations in batches;
- validate in memory after batch load;
- preserve transaction/session support for save/confirm.

Indexes to review/add:

- `MenuProduct`: `{ availableFor: 1, isActive: 1, isVisible: 1, isAvailable: 1, publishedAt: 1, sortOrder: 1 }`
- `MenuOption`: `{ groupId: 1, availableForSubscription: 1, isActive: 1, isVisible: 1, isAvailable: 1, publishedAt: 1 }`
- `ProductOptionGroup`: `{ productId: 1, groupId: 1, isActive: 1, isVisible: 1, isAvailable: 1 }`
- `ProductGroupOption`: `{ productId: 1, groupId: 1, optionId: 1, isActive: 1, isVisible: 1, isAvailable: 1 }`
- `SubscriptionDay`: keep `{ subscriptionId: 1, date: 1 }` unique.

## Acceptance Tests

Backend engineer should add/keep these before completing the refactor:

1. `GET /api/subscriptions/meal-planner-menu` returns canonical `sections` by default.
2. `includeLegacy=true` returns old fields without changing default contract.
3. Catalog contains section keys: `standard_meal`, `premium_meal`, `sandwich`, `premium_large_salad`.
4. Standard meal uses `basic_meal` product and relation-driven `proteins`/`carbs`.
5. Premium meal uses premium protein relation data and creates premium payment requirement when balance is missing.
6. Premium large salad uses `premium_large_salad` product and does not expose `extra_protein_50g`.
7. Sandwich section uses subscription-enabled `MenuProduct` rows from `cold_sandwiches`.
8. Relation min/max/isRequired errors are returned with field paths.
9. `ProductGroupOption.extraPriceHalala` overrides global option price.
10. Disabled product/group/option/relation is rejected by validation.
11. Dashboard menu edit plus publish changes planner catalog.
12. Publish fails if planner catalog snapshot fails.
13. Canonical save writes `productId` and `selectedOptions` into `SubscriptionDay.mealSlots`.
14. Confirm snapshots display/pricing/fulfillment data.
15. Legacy payload adapter converts old payloads to canonical slots.
16. Migration dry-run reports unmapped records and does not mutate DB.
17. Mobile cache hash/version is stable when catalog has not changed.

## Files To Touch First

Primary:

- `src/services/subscription/mealPlannerCatalogService.js`
- `src/services/subscription/mealSlotPlannerService.js`
- `src/services/subscription/subscriptionSelectionService.js`
- `src/services/catalog/CatalogService.js`
- `src/services/orders/menuCatalogService.js`
- `src/controllers/menuController.js`
- `src/models/SubscriptionDay.js`
- `src/models/MenuProduct.js`
- `src/models/MenuOption.js`

New:

- `src/services/subscription/mealPlannerCatalogV3Service.js`
- `src/services/subscription/mealPlannerSelectionValidator.js`
- `src/services/subscription/legacyMealPlannerAdapter.js`
- `scripts/migrate-subscription-days-to-canonical-menu-slots.js`

Admin/dashboard:

- `src/routes/adminMealPlannerMenu.routes.js`
- `src/services/admin/mealPlannerMenu.service.js`
- `src/controllers/dashboard/menuController.js`

Tests:

- `tests/builderCatalogV2Contract.test.js`
- `tests/mealPlannerCanonicalContract.test.js`
- `tests/mealPlanner.integration.test.js`
- `tests/seedCatalogRebuild.integration.test.js`
- `tests/weeklyMenuDashboard.test.js`
- add `tests/mealPlannerCatalogV3Contract.test.js`
- add `tests/mealPlannerCanonicalSelectionValidator.test.js`

## Definition Of Done

The backend refactor is complete when:

- meal planner read contract follows the same section/product/group/option pattern as the menu;
- mobile can render planner UI from one response without hardcoding allowed proteins/carbs/salad groups;
- dashboard edits canonical menu rows and planner reflects those edits after publish;
- validation and pricing read the same relations returned to frontend/mobile;
- `SubscriptionDay` stores canonical product/option selections for new writes;
- old planner fields are compatibility output only;
- publish/versioning includes planner snapshots;
- tests cover catalog, validation, stale data, payment, save, confirm, publish, dashboard edit propagation, and migration.

## Backend Engineer Rule

When implementing, do not start by adding more compatibility fields to the old planner path. Start from the seed's canonical menu relation model, make the planner a projection of that model, then adapt old data into it. That is the clean path that will make the dashboard, mobile app, and backend easier at the same time.
