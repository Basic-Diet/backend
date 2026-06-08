# Meal Builder Current Backend Audit

Status: backend audit plus implementation follow-up.

This document originally described the backend before the Dashboard Meal Builder implementation. The follow-up implementation added a new `MealBuilderConfig` model, Dashboard draft/publish APIs, a public Flutter builder endpoint, readiness checks, and published-builder validation gates.

Primary references reviewed:

- `docs/SUBSCRIPTION_MENU_SYSTEM_README.md`
- `docs/SUBSCRIPTION_MENU_SYSTEM_REVIEW.md`
- `docs/SUBSCRIPTION_MENU_SYSTEM_SOURCE_OF_TRUTH.md`
- `docs/MENU_MEAL_PLANNER_V3_BACKEND_CONTRACT.md`
- `docs/MENU_MEAL_PLANNER_BACKEND_REFACTOR_BRIEF.md`
- `docs/MENU_MEAL_PLANNER_BACKEND_VERIFICATION_GATE.md`
- `docs/audit/CATALOG_ARCHITECTURE_RISK_AUDIT.md`

## 1. Executive Summary

The backend already has a product-centered catalog and composer for Dashboard, plus a canonical v3 subscription meal planner contract for Flutter. The catalog models global menu entities (`MenuCategory`, `MenuProduct`, `MenuOptionGroup`, `MenuOption`) and explicit relation collections (`ProductOptionGroup`, `ProductGroupOption`). The subscription planner currently builds a fixed set of sections from these models: standard meal, premium meal, sandwiches, and premium large salad.

The backend does not yet have a Dashboard Meal Builder configuration model where admins can assemble arbitrary ordered cards from option groups, product categories, or selected products, save drafts, publish builder layouts, and have Flutter consume only that published layout.

| Area | Current State | Reusable For New Meal Builder? | Notes |
| --- | --- | --- | --- |
| Option Groups | Existing | Yes | `MenuOptionGroup` is the global group source; product-specific group rules live in `ProductOptionGroup`. |
| Options | Existing | Yes | `MenuOption` is the global option source; relation overrides live in `ProductGroupOption`. |
| Products | Existing | Yes | `MenuProduct` has category, channel, publish, visibility, availability, pricing, UI, and sort fields. |
| Categories | Existing | Partial | `MenuCategory` is model-based for product categories. Legacy meal categories also exist separately as `MealCategory`. |
| Product-option relations | Existing | Partial | Relations support product to group and product/group to option, but not a generic builder-section layout. |
| Dashboard composer | Existing | Partial | Strong product-centered composer under `/api/dashboard/menu/*`; no dedicated meal builder draft/publish surface. |
| Subscription planner v3 | Existing | Partial | Canonical v3 read/write/validation exists, but section layout is hard-coded in `CatalogService`. |
| Ordering/sort | Existing | Partial | Most catalog entities and relations have `sortOrder`; builder section ordering is currently code-defined. |
| Availability filtering | Existing | Partial | Active/visible/available/published/channel/global `CatalogItem` filtering exists; no builder config filtering yet. |
| Readiness checks | Existing | Partial | `/api/dashboard/health/meal-planner` validates current fixed planner requirements, not future builder config integrity. |

Can the current backend already support the new Dashboard Meal Builder idea without new backend work? Partially.

It can reuse catalog entities, product-option relations, channel filtering, publish state, stale validation errors, and readiness patterns. It cannot yet persist or expose an admin-authored builder layout with ordered cards, section title overrides, card type selection, draft/publish lifecycle, or validation against a published builder configuration.

## 2. Current Backend Data Model

### MenuProduct

- File path: `src/models/MenuProduct.js`
- Main fields: `categoryId`, `catalogItemId`, `key`, localized `name`/`description`, `imageUrl`, `itemType`, `pricingModel`, `priceHalala`, weight fields, `availableFor`, `isCustomizable`, `isActive`, `isVisible`, `isAvailable`, `sortOrder`, `ui`, `branchAvailability`, `versionId`, `publishedAt`.
- Business meaning: global sellable/product card entity for one-time and subscription channels.
- Relationship to other models: belongs to `MenuCategory`; can link one immutable `CatalogItem`; can attach `MenuOptionGroup` rows via `ProductOptionGroup`; can attach allowed `MenuOption` rows via `ProductGroupOption`.
- Used by Dashboard? Yes, through `/api/dashboard/menu/products*` and product composer.
- Used by Flutter? Yes, through one-time menu and subscription planner catalog.
- Used by subscription planner? Yes. `basic_meal`, `premium_large_salad`, and cold sandwich products are loaded by `src/services/catalog/CatalogService.js`.
- Relevant sort/order fields: `sortOrder`; query fallback often `createdAt: -1`.
- Relevant availability fields: `isActive`, `isVisible`, `isAvailable`, `availableFor`, `publishedAt`, linked `CatalogItem.isActive/isAvailable`.
- Known limitations: no builder-specific section/card membership; one `categoryId` only; publish is global catalog publish, not builder-layout publish.

### MenuOption

- File path: `src/models/MenuOption.js`
- Main fields: `groupId`, `catalogItemId`, `key`, localized `name`/`description`, `imageUrl`, price override defaults, `availableFor`, `availableForSubscription`, nutrition, protein metadata, `ruleTags`, `selectionType`, `isActive`, `isVisible`, `isAvailable`, `sortOrder`, `publishedAt`.
- Business meaning: global selectable option, normally owned by one suggested/global group.
- Relationship to other models: belongs to one `MenuOptionGroup`; can link one `CatalogItem`; can be allowed for a product through `ProductGroupOption`.
- Used by Dashboard? Yes, through `/api/dashboard/menu/options*`, group option lists, and product composer.
- Used by Flutter? Yes, as planner selected options and option-group children.
- Used by subscription planner? Yes. Proteins, carbs, and premium large salad children come from `MenuOption`.
- Relevant sort/order fields: `sortOrder`; relation sort can override effective option order.
- Relevant availability fields: `isActive`, `isVisible`, `isAvailable`, `availableFor`, `availableForSubscription`, `publishedAt`, linked `CatalogItem`.
- Known limitations: an option has one global `groupId`; it cannot globally belong to multiple groups, although it can be related to multiple products in that same group context.

### MenuOptionGroup

- File path: `src/models/MenuOptionGroup.js`
- Main fields: `key`, localized `name`/`description`, `isActive`, `isVisible`, `isAvailable`, `sortOrder`, `ui.displayStyle`, `publishedAt`.
- Business meaning: global option group, such as `proteins`, `carbs`, or salad groups.
- Relationship to other models: owns suggested `MenuOption` rows through `MenuOption.groupId`; attaches to products through `ProductOptionGroup`.
- Used by Dashboard? Yes, through `/api/dashboard/menu/option-groups*` and composer.
- Used by Flutter? Yes, through `builderCatalogV2` and `plannerCatalog` option groups.
- Used by subscription planner? Yes. Required groups are read from canonical relations and hard-coded keys.
- Relevant sort/order fields: global `sortOrder`; product relation `sortOrder`.
- Relevant availability fields: `isActive`, `isVisible`, `isAvailable`, `publishedAt`; relation also has availability.
- Known limitations: global group is not itself a builder card config; min/max/required are product relation fields, not global group fields.

### ProductOptionGroup

- File path: `src/models/ProductOptionGroup.js`
- Main fields: `productId`, `groupId`, `minSelections`, `maxSelections`, `isRequired`, `isActive`, `isVisible`, `isAvailable`, `sortOrder`.
- Business meaning: direct product-to-option-group relation and selection rules for that product.
- Relationship to other models: joins `MenuProduct` and `MenuOptionGroup`; must exist before allowed options are meaningful.
- Used by Dashboard? Yes, product composer group attach/rules/visibility/availability endpoints.
- Used by Flutter? Yes, serialized into product option groups and used by planner validation.
- Used by subscription planner? Yes, canonical v3 validator requires active relation for selected group.
- Relevant sort/order fields: `sortOrder`.
- Relevant availability fields: `isActive`, `isVisible`, `isAvailable`.
- Known limitations: product-scoped only; not a standalone builder-section relation.

### ProductGroupOption

- File path: `src/models/ProductGroupOption.js`
- Main fields: `productId`, `groupId`, `optionId`, relation-level price/weight overrides, `isActive`, `isVisible`, `isAvailable`, `sortOrder`.
- Business meaning: allowed option inside a product's option group, with optional product-specific pricing.
- Relationship to other models: joins `MenuProduct`, `MenuOptionGroup`, and `MenuOption`.
- Used by Dashboard? Yes, product composer option attach/replace/update/delete endpoints.
- Used by Flutter? Yes, exposed as allowed options under product option groups.
- Used by subscription planner? Yes, canonical v3 validation rejects missing or unavailable relations.
- Relevant sort/order fields: `sortOrder`; falls back to option sort in some builders.
- Relevant availability fields: `isActive`, `isVisible`, `isAvailable`.
- Known limitations: no per-builder-card availability; stale relations are detected during validation/readiness but not automatically repaired.

### CatalogItem

- File path: `src/models/CatalogItem.js`
- Main fields: immutable `key`, localized `nameI18n`/`descriptionI18n`, `imageUrl`, `itemKind`, nutrition, `isActive`, `isAvailable`.
- Business meaning: stable global inventory/catalog identity that menu entities can link to.
- Relationship to other models: referenced by `MenuProduct.catalogItemId` and `MenuOption.catalogItemId`.
- Used by Dashboard? Yes, `/api/dashboard/catalog-items*`, product/option linking, and readiness checks.
- Used by Flutter? Indirectly. Unavailable linked catalog items are filtered out of planner/menu responses.
- Used by subscription planner? Yes, via `catalogAvailabilityService`.
- Relevant sort/order fields: none.
- Relevant availability fields: `isActive`, `isAvailable`.
- Known limitations: does not model builder layout, category placement, or product-option rules.

### Meal

- File path: `src/models/Meal.js`
- Main fields: localized `name`/`description`, nutrition, `categoryId`, `type`, `availableForOrder`, `availableForSubscription`, `price`, `sortOrder`, `isActive`.
- Business meaning: legacy/compatibility meal row for regular meals and sandwiches.
- Relationship to other models: belongs to `MealCategory`; legacy sandwich paths may use `Meal`.
- Used by Dashboard? Yes, legacy admin routes under `/api/dashboard/meals` and admin route family.
- Used by Flutter? Yes, when `includeLegacy=true` or old planner fields are consumed.
- Used by subscription planner? Legacy fallback and sandwich compatibility paths use it.
- Relevant sort/order fields: `sortOrder`.
- Relevant availability fields: `isActive`, `availableForOrder`, `availableForSubscription`.
- Known limitations: separate from product-centered `MenuProduct`; new builder should not expand this legacy path.

### MealCategory

- File path: `src/models/MealCategory.js`
- Main fields: `key`, localized `name`/`description`, `isActive`, `sortOrder`.
- Business meaning: legacy meal category for `Meal` rows.
- Relationship to other models: referenced by `Meal.categoryId`.
- Used by Dashboard? Yes, legacy admin meal endpoints.
- Used by Flutter? Yes for legacy regular meal sections.
- Used by subscription planner? Legacy menu build path.
- Relevant sort/order fields: `sortOrder`.
- Relevant availability fields: `isActive`.
- Known limitations: not the product-centered `MenuCategory` used by current composer.

### BuilderProtein

- File path: `src/models/BuilderProtein.js`
- Main fields: `key`, localized text, `displayCategoryId`, `displayCategoryKey`, `proteinFamilyKey`, `ruleTags`, `selectionType`, `isPremium`, `premiumKey`, premium fees/credits, `availableForSubscription`, `isActive`, `sortOrder`, nutrition.
- Business meaning: legacy builder protein entity retained for compatibility and old planner records.
- Relationship to other models: belongs to `BuilderCategory`; can be mirrored from `MenuOption` image updates.
- Used by Dashboard? Yes, legacy `/api/admin/meal-planner-menu/proteins` and alias `/api/dashboard/meal-planner/proteins`.
- Used by Flutter? Legacy planner/write compatibility.
- Used by subscription planner? Legacy `mealSlotPlannerService` supports it; canonical v3 primarily uses `MenuOption`.
- Relevant sort/order fields: `sortOrder`.
- Relevant availability fields: `isActive`, `availableForSubscription`.
- Known limitations: duplicate concept relative to `MenuOption`; not recommended as the new builder source.

### BuilderCarb

- File path: `src/models/BuilderCarb.js`
- Main fields: `key`, localized text, `displayCategoryId`, `displayCategoryKey`, `availableForSubscription`, `isActive`, `sortOrder`, nutrition, `legacyMappings`.
- Business meaning: legacy builder carb entity.
- Relationship to other models: belongs to `BuilderCategory`.
- Used by Dashboard? Yes, legacy meal planner admin routes.
- Used by Flutter? Legacy planner compatibility.
- Used by subscription planner? Legacy validation path and old saved days.
- Relevant sort/order fields: `sortOrder`.
- Relevant availability fields: `isActive`, `availableForSubscription`.
- Known limitations: duplicate concept relative to carb `MenuOption` rows.

### SaladIngredient

- File path: `src/models/SaladIngredient.js`
- Main fields: localized `name`, `groupKey`, `price`, `calories`, `maxQuantity`, `isActive`, `sortOrder`.
- Business meaning: legacy custom salad ingredient.
- Relationship to other models: grouped by enum from `mealPlannerContract`.
- Used by Dashboard? Yes, legacy/admin salad ingredient routes.
- Used by Flutter? Legacy premium salad/custom salad compatibility.
- Used by subscription planner? Legacy premium large salad validation still loads it.
- Relevant sort/order fields: `sortOrder`.
- Relevant availability fields: `isActive`.
- Known limitations: product-centered premium large salad now uses `MenuOption` relations where possible.

### Subscription

- File path: `src/models/Subscription.js`
- Main fields: `userId`, `planId`, status dates, meal balances, addon balances/selections, premium balances/selections, contract fields, delivery/pickup fields.
- Business meaning: customer subscription contract and balances.
- Relationship to other models: references `Plan`, `SubscriptionDay`, `Addon`, `User`.
- Used by Dashboard? Yes, subscription admin/ops routes.
- Used by Flutter? Yes, client subscription flows.
- Used by subscription planner? Yes, meal-per-day limits, premium balance, payment state.
- Relevant sort/order fields: none for menu layout.
- Relevant availability fields: parent subscription `status`; contract fields.
- Known limitations: does not store builder layout, only subscription contract snapshots and day planning.

### SubscriptionDay

- File path: `src/models/SubscriptionDay.js`
- Main fields: `subscriptionId`, `date`, day `status`, legacy `selections`, `addonSelections`, `premiumUpgradeSelections`, `mealSlots`, `plannerMeta`, `materializedMeals`, payment states, fulfillment states.
- Business meaning: per-day plan, saved selected meal slots, add-ons, premium/payment status.
- Relationship to other models: references `Subscription`, `Meal`, `Addon`, `BuilderProtein`, `BuilderCarb`, `MenuProduct`, `MenuOptionGroup`, `MenuOption`.
- Used by Dashboard? Yes, subscription day read/ops.
- Used by Flutter? Yes, day read/save/validate/confirm.
- Used by subscription planner? Yes, primary persisted selection state.
- Relevant sort/order fields: `slotIndex`/`slotKey`, not catalog order.
- Relevant availability fields: day `status`, planner/payment readiness fields.
- Known limitations: saved selections validate against current catalog, not a future published builder config.

### Plan / SubscriptionPlan

- File path: `src/models/Plan.js`
- Main fields: `key`, localized text, `daysCount`, `durationDays`, `currency`, nested `gramsOptions.mealsOptions`, skip/freeze policy, `active`, `available`, `isAvailable`, `isActive`, `sortOrder`.
- Business meaning: subscription package definition.
- Relationship to other models: referenced by `Subscription.planId`.
- Used by Dashboard? Yes, admin plan routes.
- Used by Flutter? Yes, subscription catalog/checkout.
- Used by subscription planner? Indirectly through meal limits and contract.
- Relevant sort/order fields: plan `sortOrder`, nested grams/meals `sortOrder`.
- Relevant availability fields: `active`, `available`, `isActive`, `isAvailable`.
- Known limitations: no builder layout relation.

### Addon

- File path: `src/models/Addon.js`
- Main fields: localized text, image, price fields, `isActive`, `sortOrder`, `billingMode`, `kind`, `type`, `pricingModel`, `billingUnit`, `category`, `menuProductId`.
- Business meaning: subscription add-on plans/items and legacy add-on catalog.
- Relationship to other models: can link to `MenuProduct`; referenced by subscription add-on balances/selections.
- Used by Dashboard? Yes, admin add-on routes.
- Used by Flutter? Yes, subscription checkout/add-on balance and legacy planner add-ons.
- Used by subscription planner? Current daily add-on choices are mostly built from `MenuProduct`, not `Addon`.
- Relevant sort/order fields: `sortOrder`.
- Relevant availability fields: `isActive`.
- Known limitations: daily add-on choices use mapped one-time `MenuProduct` categories; this is easy to confuse with `Addon`.

### Identity Mapping Models

- File paths: `src/models/SharedMenuIdentity.js`, `src/models/MenuIdentityLink.js`, `src/models/MenuIdentitySuggestion.js`.
- Main fields: shared identity `key`, `type`, localized names/aliases, `canonicalFamilyKey`, tags, link `channel`, `sourceModel`, `sourceId`, `sourceKey`, confidence/status.
- Business meaning: audit/link layer to map equivalent entities across one-time and subscription catalogs.
- Relationship to other models: links identities to `MenuProduct`, `MenuOption`, `MenuCategory`, legacy builder models, `Addon`, and sandwich rows.
- Used by Dashboard? Yes, read-only identity audit and suggestion endpoints.
- Used by Flutter? No direct contract.
- Used by subscription planner? Indirectly useful for migration/readiness, not active validation.
- Relevant sort/order fields: none.
- Relevant availability fields: identity/link `isActive`.
- Known limitations: mapping does not create builder sections or enforce planner layout.

## 3. Existing Relations Map

### Product to Option Group Relations

- Is there a direct relation? Yes.
- Where stored? `ProductOptionGroup` collection, with unique index `{ productId, groupId }`.
- How validated? Dashboard composer validates product/group existence and relation fields in `src/services/orders/menuCatalogService.js`. Canonical planner validation checks the relation exists and is active/visible/available in `src/services/subscription/canonicalMealSlotPlannerService.js`.
- How exposed to dashboard? `GET /api/dashboard/menu/products/:productId/composer` and `/option-groups` endpoints expose linked groups with rules, status, and `sortOrder`.
- How exposed to Flutter? `CatalogService.buildV3ProductOptionGroups()` serializes product option groups into `plannerCatalog.sections[].products[].optionGroups`.

### Product to Option Relations

- Is there a direct relation? Yes, through `ProductGroupOption`.
- Where stored? `ProductGroupOption` collection, unique index `{ productId, groupId, optionId }`.
- Does relation support extra price? Yes: `extraPriceHalala`, `extraWeightUnitGrams`, `extraWeightPriceHalala`.
- Does relation support availability? Yes: `isActive`, `isVisible`, `isAvailable`.
- Does relation support sort order? Yes: `sortOrder`.
- How is stale relation handled? Reads filter unavailable rows; saves/validates return stale planner errors such as `PLANNER_PRODUCT_OPTION_RELATION_NOT_FOUND` and `PLANNER_PRODUCT_OPTION_RELATION_UNAVAILABLE`.

### Option Group to Options

- Is it embedded? No.
- Is it referenced? Yes. `MenuOption.groupId` references `MenuOptionGroup`.
- Is it dynamic? Dashboard can create/list options under a group and can attach any active option to a product group relation.
- Can an option belong to multiple groups? Globally, no; one `MenuOption.groupId`. It can be linked to multiple products through relation rows.
- What happens if option is inactive? Dashboard lists exclude inactive by default; Flutter planner filters inactive/unpublished/unavailable; save/validate rejects stale selections.

### Product to Category

- Where category is stored? `MenuProduct.categoryId` references `MenuCategory`.
- Is category model-based or string/key-based? Product-centered catalog is model-based. Legacy `Meal` uses `MealCategory`. Some subscription filters use category keys after loading `MenuCategory`.
- Can product belong to multiple categories? No, one `categoryId`.
- How subscription planner filters by category? Sandwiches are loaded from active/published `MenuCategory` key `cold_sandwiches`, with `MenuProduct.itemType: "cold_sandwich"` and allowed keys from `SUBSCRIPTION_COLD_SANDWICH_KEYS`.

### CatalogItem Relations

- `MenuProduct.catalogItemId` and `MenuOption.catalogItemId` link to `CatalogItem`.
- `catalogAvailabilityService` treats unlinked docs as usable, but linked docs require `CatalogItem.isActive !== false` and `CatalogItem.isAvailable !== false`.
- Planner/catalog output filters linked docs whose `CatalogItem` is inactive/unavailable.
- Save/validate emits stale unavailable errors when a selected product/option's linked `CatalogItem` is no longer usable.

### Identity Mapping

- `SharedMenuIdentity` defines stable cross-channel identities.
- `MenuIdentityLink` maps one identity to a source model/id/key in channel `one_time` or `subscription`.
- Dashboard identity endpoints expose identities, links, and suggestions.
- Identity mapping is audit/migration support. It is not used as the primary runtime relation system for planner selection validation.

Relation sketch:

```txt
MenuCategory
  -> MenuProduct.categoryId
       -> ProductOptionGroup(productId, groupId)
            -> MenuOptionGroup
            -> ProductGroupOption(productId, groupId, optionId)
                 -> MenuOption.groupId

CatalogItem
  <- MenuProduct.catalogItemId
  <- MenuOption.catalogItemId

SharedMenuIdentity
  -> MenuIdentityLink(channel, sourceModel, sourceId)
```

## 4. Existing Dashboard APIs

Public prefix comes from `src/routes/index.js`: `router.use("/dashboard/menu", dashboardMenuRoutes)`, `router.use("/dashboard/meal-planner", adminMealPlannerMenuRoutes)`, `router.use("/admin/meal-planner-menu", adminMealPlannerMenuRoutes)`, `router.use("/dashboard/catalog-items", dashboardCatalogItemRoutes)`, and `router.use("/dashboard", dashboardMenuIdentityRoutes/adminRoutes)`.

| Method | Endpoint | Consumer | Purpose | Uses Models | Supports Relations? | Supports Ordering? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/dashboard/menu/preview` | Dashboard | Preview product-centered menu | Menu catalog models | Yes | Yes | Canonical dashboard menu route. |
| GET/POST/PATCH/DELETE | `/api/dashboard/menu/categories*` | Dashboard | Category CRUD, visibility, availability, bulk product assignment | `MenuCategory`, `MenuProduct` | Product assignment only | Yes | Canonical for new global category work. |
| PATCH | `/api/dashboard/menu/categories/reorder` | Dashboard | Reorder categories | `MenuCategory` | No | Yes | Canonical. |
| GET/POST/PATCH/DELETE | `/api/dashboard/menu/products*` | Dashboard | Product CRUD, bulk updates, category update, visibility, availability, duplicate | `MenuProduct` | Indirect | Yes | Canonical global product route. |
| PATCH | `/api/dashboard/menu/products/reorder` | Dashboard | Reorder products | `MenuProduct` | No | Yes | Canonical. |
| GET | `/api/dashboard/menu/products/:productId/composer` | Dashboard | Product-centered customization composer | `MenuProduct`, relations, groups/options | Yes | Yes | Should be reused for product composer, not as builder layout API. |
| PATCH | `/api/dashboard/menu/products/:productId/customization` | Dashboard | Enable/disable customization, optionally clear relations | `MenuProduct`, relation collections | Yes | No | Canonical product customization route. |
| GET/POST/PATCH/DELETE | `/api/dashboard/menu/products/:productId/option-groups*` | Dashboard | Attach/detach/update product group relation | `ProductOptionGroup` | Yes | Yes | Canonical relation route. |
| PATCH | `/api/dashboard/menu/products/:productId/option-groups/:groupId/selection-rules` | Dashboard | Update min/max/required | `ProductOptionGroup` | Yes | No | Canonical relation rules route. |
| PATCH | `/api/dashboard/menu/products/:productId/option-groups/:groupId/visibility` | Dashboard | Relation visibility | `ProductOptionGroup` | Yes | No | Canonical. |
| PATCH | `/api/dashboard/menu/products/:productId/option-groups/:groupId/availability` | Dashboard | Relation availability | `ProductOptionGroup` | Yes | No | Canonical. |
| GET | `/api/dashboard/menu/products/:productId/option-groups/:groupId/option-pool` | Dashboard | Available option pool for a relation | `MenuOption`, `ProductGroupOption` | Yes | Yes | Canonical composer helper. |
| GET/POST/PUT/PATCH/DELETE | `/api/dashboard/menu/products/:productId/option-groups/:groupId/options*` | Dashboard | List/attach/replace/update/detach product-group options | `ProductGroupOption` | Yes | Yes | Canonical product-option relation APIs. |
| GET/POST/PATCH/DELETE | `/api/dashboard/menu/option-groups*` | Dashboard | Global option group CRUD, visibility, availability | `MenuOptionGroup` | Children through separate route | Yes | Canonical global group route. |
| PATCH | `/api/dashboard/menu/option-groups/reorder` | Dashboard | Reorder global groups | `MenuOptionGroup` | No | Yes | Canonical. |
| GET/POST | `/api/dashboard/menu/option-groups/:groupId/options` | Dashboard | List/create options under one group | `MenuOption` | Suggested group only | Yes | Canonical convenience route. |
| GET/POST/PATCH/DELETE | `/api/dashboard/menu/options*` | Dashboard | Global option CRUD, visibility, availability, toggle | `MenuOption` | No | Yes | Canonical global option route. |
| PATCH | `/api/dashboard/menu/options/reorder` | Dashboard | Reorder options | `MenuOption` | No | Yes | Canonical. |
| GET | `/api/dashboard/menu/customization-library` | Dashboard | Library of groups/options | `MenuOptionGroup`, `MenuOption` | No | Yes | Good reusable source picker. |
| POST | `/api/dashboard/menu/publish` | Dashboard | Publish catalog models | Menu catalog models | Relations snapshotted | N/A | Catalog publish, not builder publish. |
| GET/POST | `/api/dashboard/menu/versions`, `/api/dashboard/menu/rollback/:versionId` | Dashboard | Version history/rollback | `MenuVersion` plus catalog snapshot | Yes | Yes | Catalog versioning only. |
| GET/POST | `/api/dashboard/menu/diff`, `/api/dashboard/menu/validate` | Dashboard | Diff and validate catalog integrity | Menu catalog models/relations | Yes | Yes | Validation is catalog-level. |
| GET | `/api/dashboard/menu/audit-logs` | Dashboard | Menu audit logs | `MenuAuditLog` | No | No | Audit route. |
| GET/POST/PATCH/PUT/DELETE | `/api/admin/meal-planner-menu/*` | Admin Dashboard | Legacy meal planner CRUD for categories/proteins/premium-proteins/sandwiches/carbs/addons/salad-ingredients | Legacy builder/meal/addon models | No canonical product relations | Yes | Legacy route; should not be expanded for new builder work. |
| GET/POST/PATCH/PUT/DELETE | `/api/dashboard/meal-planner/*` | Dashboard | Alias to same legacy meal planner router | Same as above | Same as above | Yes | Alias route; avoid for new builder work. |
| GET | `/api/dashboard/menu-identities*` | Dashboard | Identity audit reads | identity models | Links only | No | Canonical identity audit route. |
| GET | `/api/dashboard/menu-identity-links` | Dashboard | List identity links | `MenuIdentityLink` | Identity links | No | Canonical identity audit route. |
| GET/POST | `/api/dashboard/menu-identity-suggestions*` | Dashboard | Suggestion approval/rejection | identity suggestion/link models | Identity links | No | Canonical identity workflow. |
| GET/POST/PATCH | `/api/dashboard/catalog-items*` | Dashboard | Catalog item CRUD/read | `CatalogItem` | Linked by products/options | No | Reusable global availability layer. |
| GET | `/api/dashboard/health/meal-planner` | Dashboard | Subscription planner readiness | Catalog models, relations, `CatalogItem` | Yes | Yes | Canonical readiness route. Extend or add builder readiness later. |

## 5. Existing Flutter / Mobile APIs

| Method | Endpoint | Purpose | Response Includes | Current Limitations |
| --- | --- | --- | --- | --- |
| GET | `/api/subscriptions/meal-planner-menu` | Public canonical planner catalog | `builderCatalog`, `builderCatalogV2`, `plannerCatalog` by default, `addonCatalog`; legacy fields only with `includeLegacy=true` | Section layout is code-defined, not Dashboard-authored builder config. |
| GET | `/api/subscriptions/addon-choices` | Daily one-time add-on choices | Categories `juice`, `snack`, `small_salad` with `MenuProduct` choices | Backed by mapped product categories, not `Addon` rows. |
| GET | `/api/subscriptions/:id/days` | Read subscription days | Day list with planner/read fields | Auth required; not builder layout. |
| GET | `/api/subscriptions/:id/days/:date` | Read one day | `mealSlots`, `plannerMeta`, payment and fulfillment fields | Current saved selections reflect v3/legacy slot shape. |
| POST | `/api/subscriptions/:id/days/:date/selection/validate` | Validate without saving | Validation-shaped day/planner fields or planner error matrix | Validates against catalog relations, not future builder config. |
| PUT | `/api/subscriptions/:id/days/:date/selection` | Save day selection | Updated day planner view | Mixed legacy/canonical slots rejected in v3 path. |
| POST | `/api/subscriptions/:id/days/:date/confirm` | Confirm day plan | Confirmed day/planner state or payment/planning errors | Requires exact complete plan and payment readiness. |
| POST | `/api/subscriptions/:id/days/:date/payments` | Create unified day payment | Payment ids, amounts, revision hash, payment URL/status | Covers premium/add-on day payments, not builder layout. |
| POST | `/api/subscriptions/:id/days/:date/payments/:paymentId/verify` | Verify unified day payment | Payment status and synchronized day state | Provider verification still environment-dependent. |

Other real related routes include legacy premium-extra and one-time-add-on payment aliases, pickup/fulfillment routes, bulk day selections, and legacy custom meal/salad day routes. They are not builder configuration APIs.

## 6. Current Subscription Meal Planner Build Flow

- Public controller: `src/controllers/menuController.js#getSubscriptionMealPlannerMenu`.
- Main catalog service: `src/services/subscription/mealPlannerCatalogService.js`, which delegates to `src/services/catalog/CatalogService.js#getSubscriptionBuilderCatalogWithV2`.
- Data sources:
  - Product-centered catalog: `MenuCategory`, `MenuProduct`, `MenuOptionGroup`, `MenuOption`, `ProductOptionGroup`, `ProductGroupOption`.
  - Global availability: `CatalogItem` via `catalogAvailabilityService`.
  - Legacy compatibility: `Meal`, `MealCategory`, `Addon`, `BuilderProtein`, `BuilderCarb`, `SaladIngredient`, and `Sandwich`.
  - Constants/rules: `src/config/mealPlannerContract.js`.
- Standard meals:
  - Built from `basic_meal` `MenuProduct`.
  - Uses active/published subscription-enabled `proteins` and `carbs` groups/options.
  - Filters premium proteins out for standard section.
  - Produces a configurable product with protein and carb option groups.
- Premium meals:
  - Also built from `basic_meal`.
  - Uses premium protein options from the same `proteins` group.
  - Adds premium fee metadata and premium balance/payment behavior at validation/save time.
- Sandwiches:
  - Built from active/published `MenuProduct` rows under `MenuCategory.key = "cold_sandwiches"`, `itemType = "cold_sandwich"`, and allowlisted keys in `SUBSCRIPTION_COLD_SANDWICH_KEYS`.
  - Serialized as a direct `product_list` section.
- Premium large salad:
  - Uses `premium_large_salad` product pricing where available, with fallback behavior in premium salad pricing service.
  - Reads product group and option relations.
  - Aliases salad group keys to canonical salad groups.
  - Excludes `extra_protein_50g`.
  - Enforces `SUBSCRIPTION_PREMIUM_LARGE_SALAD_PROTEIN_KEYS`.
- Selected options:
  - Persisted in `SubscriptionDay.mealSlots[].selectedOptions[]` with `groupId`, `groupKey`, `canonicalGroupKey`, `optionId`, `optionKey`, `quantity`, grams, and pricing snapshots.
- Products:
  - Persisted in slots as `productId` and `productKey`.
- Groups:
  - Exposed in catalog under `optionGroups` with min/max/required and options.
- Add-on choices:
  - `GET /api/subscriptions/addon-choices` maps daily add-on categories to active/published one-time `MenuProduct` rows in configured source categories.
- Fallback/legacy config:
  - `includeLegacy=true` adds legacy `regularMeals`, `premiumMeals`, and `addons`.
  - Legacy `mealSlotPlannerService` still supports old field shapes, while canonical v3 uses product/selectedOptions.
- `contractVersion` and revision/hash:
  - `plannerCatalog.contractVersion` is `meal_planner_menu.v3`.
  - `plannerCatalog.catalogHash` is `sha256:` of stable v3 payload.
  - Saved canonical slots use `contractVersion: meal_planner_menu.v3`.
  - Day payment revision hashes are generated for meal slot payment consistency in `mealSlotPlannerService` and payment services.

## 7. Current Ordering and Sorting Behavior

| Entity | Sort Field | Where Used | Dashboard Editable? | Flutter Visible? | Limitation |
| --- | --- | --- | --- | --- | --- |
| MenuProduct | `sortOrder` | Dashboard lists, menu publish snapshots, planner sandwich/product sections | Yes | Yes | No builder-section-specific order. |
| MenuOption | `sortOrder` | Dashboard lists, option pools, default relation order, planner options | Yes | Yes | Relation order may override. |
| MenuOptionGroup | `sortOrder` | Dashboard lists, library, fallback group order | Yes | Yes | Product relation order is usually effective for product builders. |
| ProductOptionGroup | `sortOrder` | Product composer and planner product option groups | Yes through relation update | Yes | Product-scoped only. |
| ProductGroupOption | `sortOrder` | Product composer and planner options | Yes through relation update | Yes | Product/group-scoped only. |
| Categories | `MenuCategory.sortOrder`, `MealCategory.sortOrder` | Dashboard lists, menu sections, legacy meal sections | Yes | Yes | Two category systems exist. |
| Planner sections | Hard-coded array order | `CatalogService.buildCanonicalPlannerCatalogV3` and V2 builder | No | Yes | New builder needs persisted section order. |
| Meal slots | `slotIndex`, `slotKey` | `SubscriptionDay.mealSlots` | User selection order only | Yes | Not a catalog/card order. |
| Addon choices | Product `sortOrder`, category `sortOrder` | `subscriptionAddonChoicesService` | Product/category routes | Yes | Category mapping order is code-defined. |
| Premium salad groups | Rule `sortOrder` and relation `sortOrder` | `CatalogService` salad group build | Partially through relations | Yes | Some group ordering is code/rule-driven. |

When ordering is inconsistent, it is usually because global entity order, product relation order, and hard-coded planner section order are separate layers.

## 8. Current Availability and Publishing Rules

Current visibility rules combine these fields:

- `isActive`: primary active/inactive flag.
- `isVisible`: hidden/visible flag for catalog UI.
- `isAvailable`: availability flag for menu/planner display and validation.
- `publishedAt`: catalog publish marker; planner reads require published products/groups/options.
- `availableFor`: channel array on `MenuProduct`/`MenuOption`, usually `one_time`, `subscription`, or both.
- `availableForSubscription`: extra subscription flag on `MenuOption` and legacy builder models.
- `CatalogItem.isActive` and `CatalogItem.isAvailable`: global linked-item availability.
- Relation fields: `ProductOptionGroup.isActive/isVisible/isAvailable` and `ProductGroupOption.isActive/isVisible/isAvailable`.
- Category availability: `MenuCategory.isActive/isVisible/isAvailable/publishedAt`.

If an option such as Steak becomes globally inactive:

1. Dashboard composer: existing composer may still show linked status context when reading relations, but option lists and pools exclude inactive by default unless disabled/inactive query modes are used. Updating linked option selection may reject inactive options.
2. Flutter planner menu: inactive/unpublished/unavailable options are filtered out of generated catalog.
3. Backend save/validate selection: canonical validation returns a stale planner error such as `PLANNER_OPTION_INACTIVE`, `PLANNER_OPTION_UNPUBLISHED`, or `PLANNER_OPTION_UNAVAILABLE`.
4. One-time menu: published public menu filters inactive/hidden/unavailable catalog docs.
5. Subscription planner: current catalog read omits it; submitted stale selections are rejected with refresh hints.

Dashboard readiness behavior:

- `GET /api/dashboard/health/meal-planner` validates required planner products/keys/groups/relations, active/visible/available/published states, linked `CatalogItem` availability, premium large salad allowlist safety, `extra_protein_50g` exclusion, and daily add-on mapped products.
- It returns `ready`, `status`, `errors`, `warnings`, `checks`, and `summary`.

## 9. Current Validation Rules

Key validation files:

- `src/services/subscription/canonicalMealSlotPlannerService.js`
- `src/services/subscription/mealSlotPlannerService.js`
- `src/services/subscription/subscriptionPlanningClientService.js`
- `src/services/subscription/subscriptionSelectionService.js`
- `src/services/subscription/subscriptionAddonChoicesService.js`
- `src/services/orders/menuCatalogService.js`
- `src/services/dashboardHealthService.js`

Rules covered today:

- Standard meal validation:
  - Requires canonical `productId`, subscription-enabled published active product, selected option groups, valid product/group relations, valid product/group/option relation rows, min/max group selection rules, and carb split limits.
- Sandwich validation:
  - Current v3 sandwich section is direct product list; legacy path validates sandwich id against active sandwich/meal sources.
- Premium large salad validation:
  - Requires allowed salad groups/options, rejects `extra_protein_50g`, rejects proteins not in subscription salad allowlist, derives premium fee/payment state.
- `selectedOptions` validation:
  - Each selected option needs valid `groupId`, `optionId`, quantity, active group, active option, matching `MenuOption.groupId`, active product-group relation, active product-group-option relation, channel availability, and global catalog availability.
- Product-option relation validation:
  - Dashboard create/replace/update validates ids, group relation existence, active option existence, catalog availability for replacement, and pricing field types.
  - Planner save rejects stale missing/unavailable relations.
- Stale product/option/group errors:
  - Covered by `tests/subscriptionPlannerStaleCatalog.test.js`.
  - Stable examples include `PLANNER_PRODUCT_NOT_FOUND`, `PLANNER_PRODUCT_INACTIVE`, `PLANNER_PRODUCT_UNPUBLISHED`, `PLANNER_PRODUCT_UNAVAILABLE`, `PLANNER_OPTION_GROUP_RELATION_NOT_FOUND`, `PLANNER_PRODUCT_OPTION_RELATION_UNAVAILABLE`.
- Mixed v3/legacy slot rejection:
  - Canonical requests reject legacy fields with `PLANNER_MIXED_LEGACY_CANONICAL_SLOT`.
- Daily add-on validation:
  - `subscriptionAddonChoicesService` resolves only mapped active/published one-time `MenuProduct` choices; save/payment paths validate selected add-on products.
- Payment-required validation:
  - Day confirmation blocks incomplete plans, pending premium overage, premium payment, and daily add-on payment states with stable error codes such as `ADDON_PAYMENT_REQUIRED`.
- Readiness validation:
  - `dashboardHealthService` and `tests/dashboardSubscriptionMenuReadiness.test.js` validate catalog and relation readiness.

Evidence test files include:

- `tests/dashboardMenuProductCenteredContract.test.js`
- `tests/mealPlannerCanonicalContract.test.js`
- `tests/mealPlannerCanonicalV3Write.test.js`
- `tests/premiumLargeSaladV3Allowlist.test.js`
- `tests/subscriptionPlannerStaleCatalog.test.js`
- `tests/dashboardSubscriptionMenuReadiness.test.js`
- `tests/subscriptionPlannerDashboardToFlutter.e2e.test.js`
- `tests/subscription_addon_choices.test.js`
- `tests/mealPlannerPaymentContract.test.js`

## 10. What Already Matches The New Meal Builder Idea

- Existing `MenuOptionGroup`
  - What exists: global option group cards with names, descriptions, display style, sort, publish, and availability.
  - How to reuse it: builder sections can reference group ids as source cards.
  - What is missing: builder-specific card title, card order, included option subset, draft/publish state.
- Existing `MenuOption`
  - What exists: global selectable children with pricing/nutrition/channel flags.
  - How to reuse it: builder cards can reference allowed option ids.
  - What is missing: builder-specific allowlist separate from product relations, unless a product context is used.
- Existing `MenuProduct`
  - What exists: product category cards, sandwich products, basic meal and premium salad products.
  - How to reuse it: product category/list cards can reference products or categories.
  - What is missing: builder layout sections that point to categories or selected product subsets.
- Existing dashboard product composer
  - What exists: robust product-option linking and relation overrides.
  - How to reuse it: keep using it for configuring a product's selectable groups/options.
  - What is missing: a separate builder composer that arranges those configured entities for subscription users.
- Existing v3 planner validation
  - What exists: validates selected product/options against catalog and relations.
  - How to reuse it: extend or wrap validation to first resolve published builder config.
  - What is missing: validation against builder card membership and published section rules.
- Existing readiness endpoint
  - What exists: planner readiness checks for current fixed required catalog.
  - How to reuse it: add builder config checks or create `/meal-builder/readiness`.
  - What is missing: draft/published builder config readiness.
- Existing stale catalog error matrix
  - What exists: clear stale errors with refresh hints.
  - How to reuse it: add stale builder section/card errors using same response pattern.
  - What is missing: error codes for builder section missing, card unpublished, referenced child unavailable.

## 11. Gap Analysis: Current System vs Proposed Meal Builder

| Requirement | Current Backend Support | Gap | Backend Work Needed |
| --- | --- | --- | --- |
| Dashboard can add OptionGroup as a builder card. | Partial | Groups exist, but no builder card model. | Add builder config/section references. |
| Dashboard can select multiple OptionGroups and create multiple cards. | Partial | Multiple product groups exist only per product. | Add layout-level sections/cards. |
| Dashboard can select allowed options inside each card. | Partial | Product relation options exist. | Add builder-card child allowlist or define product context. |
| Dashboard can use Product Category as a card, for example Sandwiches. | Partial | Categories/products exist. | Add section type `product_category`. |
| Dashboard can choose all products in a category or selected subset. | Partial | Product listing filters exist. | Add `includeMode: all | selected` and selected ids. |
| Dashboard can reorder cards. | No | Planner section order is code-defined. | Add persisted `sortOrder` on builder sections. |
| Dashboard can override card title. | No | Entity names exist only globally. | Add section/card title override fields. |
| Dashboard can configure min/max/required. | Partial | Product group relations have rules. | Add builder section rules or reuse relation rules by reference. |
| Dashboard can publish draft builder config. | No | Catalog publish exists only. | Add builder draft/publish lifecycle. |
| Flutter receives only published config. | No | Planner receives published catalog, not builder config. | Add published builder read contract. |
| Flutter receives ordered sections. | Partial | Receives hard-coded ordered sections. | Use persisted builder order. |
| Flutter receives only globally available children. | Yes | Current filters work for catalog entities. | Apply same filtering to builder config. |
| Backend validates submitted selections against published builder config. | No | Validates against catalog relations only. | Add builder config validation layer. |
| Backend reports stale builder selections. | Partial | Stale catalog errors exist. | Add builder-specific stale errors. |
| Readiness check validates builder config. | No | Current readiness validates fixed planner. | Add builder readiness checks. |

## 12. Proposed New Meal Builder Concept

The new Meal Builder should not duplicate global options/products. It should reference existing global catalog entities and define how they are arranged for subscription users.

Conceptual model:

```txt
MealBuilderConfig
  status: draft | published | archived
  revisionHash
  publishedAt
  sections: MealBuilderSection[]

MealBuilderSection
  sectionType: option_group | product_category | product_list
  sourceGroupId?
  sourceCategoryId?
  productIds?
  optionIds?
  titleOverride?
  minSelections?
  maxSelections?
  isRequired?
  sortOrder
```

How it differs:

- Global `MenuOptionGroup`: reusable global source; not a subscription layout card by itself.
- Global `MenuProduct`: reusable product source; not a section/card arrangement by itself.
- Current dashboard product composer: configures a product's internal customization relations.
- Current subscription planner v3 menu: fixed service-generated contract, not admin-authored layout.
- Legacy meal planner admin: edits old builder/meal models and should not become the new extensible builder.

## 13. Recommended Backend Design Options

### Option A: New MealBuilderConfig Model

Required models:

- `MealBuilderConfig` with draft/published status, revision, sections, references, title overrides, section rules, and audit metadata.

Required services:

- Builder config read/write service.
- Published Flutter contract builder.
- Builder validation/readiness service.
- Migration/backfill from current hard-coded v3 layout.

Endpoints:

- New `/api/dashboard/meal-builder*` draft/validate/publish/readiness APIs.
- Flutter read via `/api/subscriptions/meal-builder` or an extension to `/api/subscriptions/meal-planner-menu`.

Validation changes:

- Validate referenced ids exist, are active/published/channel-eligible, and globally available.
- Validate section child allowlists against source group/category.
- Validate submitted selections against published config plus existing catalog rules.

Tests:

- Config CRUD/draft/publish tests.
- Flutter contract tests.
- Stale builder selection tests.
- Readiness tests.
- Dashboard-to-Flutter E2E.

Risks:

- More new code, migration work, and contract review.

Pros:

- Clear ownership.
- Draft/publish support.
- Easy Flutter contract.
- Clean future evolution.

Cons:

- New model/endpoints/tests needed.

Recommendation: preferred option.

### Option B: Extend Existing Dashboard Menu Composer

Required models:

- Possibly add builder fields to existing catalog/relation models or `MenuVersion`.

Required services:

- Extend `menuCatalogService` and `CatalogService` to serialize builder views from existing product composer state.

Endpoints:

- Reuse `/api/dashboard/menu/*` plus maybe added composer fields.

Validation changes:

- Add builder-layout validation into existing catalog validation.

Tests:

- Extend product-centered dashboard tests and planner contract tests.

Risks:

- Product editing and subscription layout concerns become mixed.
- Harder to reason about draft/publish differences.

Pros:

- Reuses existing product-centered catalog.
- Less duplication.

Cons:

- May mix product editing with builder layout.
- Could be harder for Flutter-specific contract.

### Option C: Config-only / Seed-driven Builder

Required models:

- None, or a `Setting`/JSON config.

Required services:

- Read JSON config and map references to catalog rows.

Endpoints:

- Minimal read/validate endpoints; limited or no Dashboard composer.

Validation changes:

- Validate static config references during readiness.

Tests:

- Contract/readiness tests.

Risks:

- Low admin usability.
- Harder to change safely without deploy/seed operations.

Pros:

- Fastest.
- Low dashboard work.

Cons:

- Not admin-friendly.
- Not dynamic enough.

Recommended option: Option A, a new `MealBuilderConfig` model and service layer that references the existing global catalog.

## 14. Recommended API Design For Future Implementation

Dashboard draft/publish APIs:

| Endpoint | Purpose | Request Shape | Response Shape | Exists Today? | Canonical? |
| --- | --- | --- | --- | --- | --- |
| GET `/api/dashboard/meal-builder` | Read current draft and published builder config | Query optional `status` | Config, sections, validation summary | No | Proposed canonical dashboard read |
| POST `/api/dashboard/meal-builder/draft` | Create draft from published/current defaults | Optional seed/source | Draft config | No | Proposed |
| PUT `/api/dashboard/meal-builder/draft` | Replace/update draft sections | `{ sections: [...] }` | Draft config plus validation | No | Proposed |
| POST `/api/dashboard/meal-builder/validate` | Validate draft without publishing | Draft payload or current draft id | Errors/warnings/summary | No | Proposed |
| POST `/api/dashboard/meal-builder/publish` | Publish validated draft | `{ notes }` | Published config, revision hash | No | Proposed |
| GET `/api/dashboard/meal-builder/readiness` | Builder-specific readiness | None | ready/status/errors/warnings | No | Proposed |

Flutter contract:

| Endpoint | Purpose | Request Shape | Response Shape | Exists Today? | Canonical? |
| --- | --- | --- | --- | --- | --- |
| GET `/api/subscriptions/meal-builder` | Read published builder config only | `lang`, optional revision | `{ contractVersion, revisionHash, sections }` | No | Clean proposed API |
| GET `/api/subscriptions/meal-planner-menu` | Existing planner catalog | `lang`, `contractVersion`, `includeLegacy` | Current `builderCatalog`, `builderCatalogV2`, `plannerCatalog` | Yes | Existing canonical planner API |

Recommendation: keep `/api/subscriptions/meal-planner-menu` stable and either add `mealBuilder` under it behind a new contract version, or introduce `/api/subscriptions/meal-builder` for cleaner separation. If Flutter needs one fetch for all planner data, extend the existing endpoint carefully; if Dashboard Meal Builder is conceptually independent, add the new endpoint.

## 15. Migration Plan From Current System To New Meal Builder

### Phase 1: Audit and Docs

- Goal: document current behavior and decisions.
- Backend files likely involved: docs only.
- Tests to add: none.
- Exit criteria: this file exists and runtime code is unchanged.

### Phase 2: Backend model/service design

- Goal: define config schema, section references, validation rules, and contract versioning.
- Backend files likely involved: `src/models`, `src/services/catalog`, `src/services/subscription`, `src/services/dashboardHealthService.js`.
- Tests to add: model/service validation tests.
- Exit criteria: design approved before implementation.

### Phase 3: Dashboard draft composer

- Goal: admins can build and validate cards.
- Backend files likely involved: new dashboard routes/controllers/services.
- Tests to add: auth, draft CRUD, reference validation, readiness.
- Exit criteria: draft builder can represent the current hard-coded planner.

### Phase 4: Flutter published contract

- Goal: mobile consumes only published builder config.
- Backend files likely involved: subscription routes/controllers/catalog services.
- Tests to add: mobile contract tests and backward compatibility tests.
- Exit criteria: stable response examples and revision hash.

### Phase 5: Validation and readiness hardening

- Goal: save/validate rejects stale/ineligible builder selections.
- Backend files likely involved: canonical planner validation and dashboard readiness services.
- Tests to add: stale builder config matrix, inactive option/product/category cases.
- Exit criteria: all stale paths return refreshable error details.

### Phase 6: E2E testing

- Goal: Dashboard-to-Flutter full cycle.
- Backend files likely involved: tests and fixture/bootstrap scripts.
- Tests to add: dashboard draft/publish -> Flutter read -> day validate/save/confirm.
- Exit criteria: E2E proves published builder governs Flutter and backend validation.

## 16. Risks and Open Questions

- Relation duplication: should builder sections have their own option allowlists or reference existing product relations?
- Legacy vs v3 confusion: old `/api/dashboard/meal-planner/*` aliases should not become the new builder.
- Category as card vs option group as card: product categories and option groups have different child/rule semantics.
- Option global inactive behavior: current stale handling is good, but builder-specific errors need names.
- Product inactive behavior: category/list cards must decide whether to hide or error when all children disappear.
- Pricing source: relation override, product price, option default price, premium balance, and daily add-on pricing need clear precedence.
- Premium large salad special rules: current allowlist and `extra_protein_50g` exclusion must remain explicit.
- Daily add-ons not `Addon` model: docs and APIs should avoid naming confusion.
- Sorting conflicts: global sort, relation sort, and builder sort must be layered predictably.
- Draft vs published consistency: Dashboard must show draft problems without affecting Flutter.
- Cache invalidation/revision hash: published builder config needs a stable hash and invalidation rules.
- Dashboard role permissions: likely admin/superadmin only, but exact permissions should be decided.
- Backward compatibility: existing `/api/subscriptions/meal-planner-menu` and day write APIs should remain stable during migration.

## 17. Backend Implementation Checklist For Later

- [x] Models: add `MealBuilderConfig` or approved alternative.
- [x] Services: draft read/write, published contract builder, config validator.
- [x] Routes: dashboard builder endpoints and Flutter builder endpoint.
- [x] Controllers: dashboard and subscription handlers.
- [x] Validation: references, availability, channel, publish, min/max/required, stale builder selection errors.
- [x] Readiness: builder-specific readiness checks.
- [x] Tests: unit/contract/stale membership coverage.
- [x] Docs: update planner/backend contract docs.
- [x] Migration/backfill: seed current fixed planner as initial builder config.
- [x] Bootstrap/seed updates: include builder config fixtures if Option A is chosen.

## 18. Dashboard Meal Builder With Premium Upgrade Support

Implemented backend support:

- New model: `src/models/MealBuilderConfig.js`.
- New services: `src/services/subscription/mealBuilderConfigService.js`.
- Dashboard APIs under `/api/dashboard/meal-builder`.
- Flutter read API: `GET /api/subscriptions/meal-builder`.
- Published builder membership validation in `src/services/subscription/canonicalMealSlotPlannerService.js`.

The Flutter endpoint returns the current published `subscription_meal_builder.v1` contract with `revisionHash`, `publishedAt`, ordered sections, and option/product items. It returns `MEAL_BUILDER_NOT_PUBLISHED` when no config is published. Existing `/api/subscriptions/meal-planner-menu` is unchanged.

Supported section types:

- `option_group`: references a `MenuProduct` context, `MenuOptionGroup`, and optional selected `MenuOption` ids.
- `product_category`: references a `MenuCategory` and includes all or selected `MenuProduct` rows.
- `product_list`: references selected `MenuProduct` rows.

Premium behavior:

- Premium proteins remain premium upgrades when used with `selectionType: "premium_meal"`.
- Premium large salad remains `selectionType: "premium_large_salad"`.
- Premium metadata in the builder response is display-only.
- Canonical v3 validation still owns `premiumBalance`, `premiumSource`, `premiumExtraFeeHalala`, `paymentRequirement`, `plannerRevisionHash`, and unified day payment behavior.
- Premium large salad still enforces `SUBSCRIPTION_PREMIUM_LARGE_SALAD_PROTEIN_KEYS` and rejects `extra_protein_50g`.

New stale builder membership errors:

- `PLANNER_BUILDER_PRODUCT_NOT_INCLUDED`
- `PLANNER_BUILDER_GROUP_NOT_INCLUDED`
- `PLANNER_BUILDER_OPTION_NOT_INCLUDED`

Focused verification:

```bash
NODE_ENV=test node tests/dashboardMealBuilderComposer.test.js
NODE_ENV=test node tests/subscriptionMealBuilderContract.test.js
NODE_ENV=test node tests/subscriptionMealBuilderValidation.test.js
```

## 19. Meal Builder Seed / Bootstrap

Implemented opt-in bootstrap support:

- New seed script: `scripts/bootstrap/seed-meal-builder.js`.
- Bootstrap integration: `scripts/bootstrap/index.js` runs the seed after catalog and subscription plans when `MEAL_BUILDER_BOOTSTRAP=true`.
- Ownership metadata: `MealBuilderConfig.source`, `createdBySystem`, and `bootstrapKey`.
- Bootstrap key: `initial_subscription_meal_builder`.

Default seeded sections:

- Standard meal proteins from `basic_meal` and `proteins`, excluding premium proteins.
- Standard meal carbs from `basic_meal` and `carbs`.
- Premium proteins from existing premium protein keys with positive premium pricing.
- Cold sandwiches from subscription-visible `cold_sandwiches` products.
- Premium large salad from `premium_large_salad` when product, pricing, and relations are valid.

Safety behavior:

- Default mode creates missing current draft/published configs only.
- Existing admin-created current configs are skipped.
- Sync requires `MEAL_BUILDER_BOOTSTRAP_SYNC=true` plus `--sync` and updates only bootstrap-owned configs.
- Dry-run reports bootstrap intent without writes.
- Missing optional premium large salad data logs a warning.
- Disallowed salad proteins and `extra_protein_50g` block seed publishing.

Commands:

```bash
MEAL_BUILDER_BOOTSTRAP=true npm run bootstrap:data -- --dry-run
NODE_ENV=test MEAL_BUILDER_BOOTSTRAP=true MEAL_BUILDER_BOOTSTRAP_SYNC=true BOOTSTRAP_SYNC=true npm run bootstrap:data -- --sync
NODE_ENV=test node tests/seedMealBuilderConfig.test.js
NODE_ENV=test node tests/bootstrapOrchestrator.test.js
```
