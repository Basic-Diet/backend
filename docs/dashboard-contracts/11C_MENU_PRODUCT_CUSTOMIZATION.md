# Screen Contract: 11C_MENU_PRODUCT_CUSTOMIZATION

## 1. Screen Purpose
Provides options and option group mapping controls at the specific product level. Admins can attach option groups to a product, define selection rules (minimum/maximum selections), replace group option lists, and override option prices for that specific product.

## 2. Dashboard Route
`/menu/products/:productId/customization`

## 3. Visible UI Requirements
* Product Customization Composer (collapsible option groups with options list).
* Add Option Group selector (drawn from the Customization Library).
* Group rules editor (min/max selection, required status).
* Option list replacement panel.
* Product-level price override modal.

## 4. Backend Endpoints

### Verified Read Endpoints
* `GET /api/dashboard/menu/products/:productId/composer?contractVersion=v4` (fetches hydrated composer data)
* `GET /api/dashboard/menu/products/:productId/option-groups` (lists product option group links)
* `GET /api/dashboard/menu/customization-library` (lists all global option groups and options templates)

### Write Endpoints (NOT_TESTED)
* `PATCH /api/dashboard/menu/products/:productId/customization` (enables/disables customization on the product)
* `POST /api/dashboard/menu/products/:productId/option-groups` (associates an option group to a product)
* `PATCH /api/dashboard/menu/products/:productId/option-groups/:groupId` (updates group rules)
* `PATCH /api/dashboard/menu/products/:productId/option-groups/:groupId/selection-rules` (updates group min/max rules)
* `PATCH /api/dashboard/menu/products/:productId/option-groups/:groupId/visibility` (toggles group visibility on the product)
* `PATCH /api/dashboard/menu/products/:productId/option-groups/:groupId/availability` (toggles group availability on the product)
* `DELETE /api/dashboard/menu/products/:productId/option-groups/:groupId` (detaches group from the product)
* `GET /api/dashboard/menu/products/:productId/option-groups/:groupId/option-pool` (returns list of options available to link)
* `GET /api/dashboard/menu/products/:productId/option-groups/:groupId/options` (lists assigned group options)
* `POST /api/dashboard/menu/products/:productId/option-groups/:groupId/options` (assigns single option to group)
* `PUT /api/dashboard/menu/products/:productId/option-groups/:groupId/options` (replaces group options list in bulk)
* `PATCH /api/dashboard/menu/products/:productId/option-groups/:groupId/options/:optionId` (updates option overrides like price)
* `PATCH /api/dashboard/menu/products/:productId/option-groups/:groupId/options/:optionId/visibility` (toggles option visibility on this product)
* `PATCH /api/dashboard/menu/products/:productId/option-groups/:groupId/options/:optionId/availability` (toggles option availability on this product)
* `DELETE /api/dashboard/menu/products/:productId/option-groups/:groupId/options/:optionId` (detaches option from group on this product)

---

## 5. Product Flow Rules
* `isCustomizable = false` (Direct/Simple Product): The product does not require customization. No options/groups apply.
* `isCustomizable = true` (Customizable Product): Customization is enabled. The UI must call the composer and product option group endpoints to manage options.

---

## 6. Response Fields Required

### A. Product Composer Response Shape (`GET /api/dashboard/menu/products/:productId/composer?contractVersion=v4`)
```json
{
  "status": true,
  "data": {
    "contractVersion": "dashboard_product_composer.v4",
    "product": {
      "id": "6a33b0fef7ece2b8078e13f2",
      "key": "basic_meal",
      "name": { "ar": "وجبة أساسية", "en": "Basic Meal" },
      "categoryId": "65b219e9ca7cd69ffb19b8ea",
      "isCustomizable": true,
      "isActive": true,
      "isVisible": true,
      "isAvailable": true
    },
    "category": {
      "id": "65b219e9ca7cd69ffb19b8ea",
      "key": "main_meals",
      "name": { "ar": "وجبات رئيسية", "en": "Main Meals" }
    },
    "customization": {
      "enabled": true,
      "summary": {
        "linkedGroupCount": 2,
        "linkedOptionCount": 14,
        "requiredGroupCount": 2
      },
      "groups": [
        {
          "productGroupId": "6a33b0fef7ece2b8078e13f5",
          "groupId": "6a33b09ff7ece2b8078e10f2",
          "key": "proteins",
          "name": { "ar": "خيارات البروتين", "en": "Proteins" },
          "displayStyle": "radio_cards",
          "rules": {
            "minSelections": 1,
            "maxSelections": 1,
            "isRequired": true
          },
          "status": {
            "global": { "isActive": true, "isVisible": true, "isAvailable": true },
            "product": { "isActive": true, "isVisible": true, "isAvailable": true },
            "effective": { "isActive": true, "isVisible": true, "isAvailable": true }
          },
          "sortOrder": 1,
          "options": [
            {
              "productOptionId": "6a33b0fef7ece2b8078e13ff",
              "optionId": "6a33b0fef7ece2b8078e13fa",
              "key": "grilled_chicken",
              "name": { "ar": "دجاج مشوي", "en": "Grilled Chicken" },
              "description": { "ar": "", "en": "" },
              "imageUrl": "",
              "defaultPricing": {
                "extraPriceHalala": 0,
                "extraWeightUnitGrams": 0,
                "extraWeightPriceHalala": 0,
                "currency": "SAR"
              },
              "overridePricing": {
                "extraPriceHalala": null,
                "extraWeightUnitGrams": null,
                "extraWeightPriceHalala": null,
                "currency": "SAR"
              },
              "effectivePricing": {
                "extraPriceHalala": 0,
                "extraWeightUnitGrams": 0,
                "extraWeightPriceHalala": 0,
                "currency": "SAR"
              },
              "nutrition": {
                "calories": 165,
                "proteinGrams": 31,
                "carbGrams": 0,
                "fatGrams": 3.6
              },
              "status": {
                "global": { "isActive": true, "isVisible": true, "isAvailable": true },
                "product": { "isActive": true, "isVisible": true, "isAvailable": true },
                "effective": { "isActive": true, "isVisible": true, "isAvailable": true }
              },
              "sortOrder": 0
            }
          ],
          "optionPool": {
            "linkedCount": 1,
            "availableCount": 42,
            "endpoint": "/api/dashboard/menu/products/6a33b0fef7ece2b8078e13f2/option-groups/6a33b09ff7ece2b8078e10f2/option-pool"
          }
        }
      ]
    },
    "availableActions": {
      "canEnableCustomization": true,
      "canDisableCustomization": true,
      "canAttachGroup": true,
      "canDetachGroup": true,
      "canReplaceGroupOptions": true,
      "canPatchOptionOverride": true
    },
    "validation": {
      "ok": true,
      "errors": [],
      "warnings": []
    }
  }
}
```

#### Hydrated Composer Specification:

* **Group Status Model (`status`):**
  * `global`: State of the option group inside the global customization library templates.
  * `product`: State of the option group link attached to this specific product.
  * `effective`: Resolved logical state the UI must use for display/selection.
  * **Rule**: Customer-facing rendering, Flutter, and final admin previews must read `status.effective`. Global/Product states should only be displayed for editing/debugging.

* **Option Status Model (`options[].status`):**
  * `global`: State of the option inside the global options catalog.
  * `product`: State of the option inside this product group option relation mapping.
  * `effective`: Resolved final state (combines global and product relation properties).
  * **Rule**: Use `status.effective` for availability and visibility of options inside the product customization flow.

* **Option Pricing Model (`options[].*Pricing`):**
  * `defaultPricing`: Global option prices configured in the options library.
  * `overridePricing`: Specific product-level override prices (null/default if none applied).
  * `effectivePricing`: Final computed and resolved prices that must be displayed to customers.
  * **Rule**: Dashboard and Flutter client apps must display final option customization prices strictly from `effectivePricing`. They **must not** calculate or resolve overrides locally.

* **`availableActions`:**
  * Represents backend-provided hints for user capabilities. The frontend should check these flags to enable or disable related UI buttons instead of hardcoding permissions rules locally.

* **`validation`:**
  * `validation.ok = true` means the current customization is valid and eligible for release. Errors contain blocking issues; warnings describe non-blocking layout recommendations.

---

### B. Product Option Groups Endpoint (`GET /api/dashboard/menu/products/:productId/option-groups`)
Returns a flat array of relations linking the product to global option groups.
> [!NOTE]
> This endpoint returns a lightweight link model, whereas the composer endpoint returns the fully hydrated read model.

```json
[
  {
    "id": "6a33b0fef7ece2b8078e13f5",
    "_id": "6a33b0fef7ece2b8078e13f5",
    "productId": "6a33b0fef7ece2b8078e13f2",
    "groupId": "6a33b09ff7ece2b8078e10f2",
    "minSelections": 1,
    "maxSelections": 1,
    "isRequired": true,
    "isActive": true,
    "isVisible": true,
    "isAvailable": true,
    "sortOrder": 1,
    "createdAt": "2026-06-18T12:00:00.000Z",
    "updatedAt": "2026-06-18T12:00:00.000Z"
  }
]
```

---

### C. Customization Library Endpoint (`GET /api/dashboard/menu/customization-library`)
Returns the master catalogs of global option groups and option templates.
> [!NOTE]
> This catalog acts as a global picker source for admin setup screens. It does not represent specific product customizations.

```json
{
  "status": true,
  "data": {
    "contractVersion": "dashboard_customization_library.v1",
    "groups": [
      {
        "id": "6a33b09ff7ece2b8078e10f2",
        "key": "proteins",
        "name": { "ar": "خيارات البروتين", "en": "Proteins" },
        "description": { "ar": "", "en": "" },
        "displayStyle": "radio_cards",
        "enabled": true,
        "sortOrder": 1
      }
    ],
    "options": [
      {
        "id": "6a33b0fef7ece2b8078e13fa",
        "key": "grilled_chicken",
        "name": { "ar": "دجاج مشوي", "en": "Grilled Chicken" },
        "description": { "ar": "", "en": "" },
        "imageUrl": "",
        "suggestedGroupId": "6a33b09ff7ece2b8078e10f2",
        "suggestedGroupKey": "proteins",
        "defaultPricing": {
          "extraPriceHalala": 0,
          "extraWeightUnitGrams": 0,
          "extraWeightPriceHalala": 0,
          "currency": "SAR"
        },
        "nutrition": {
          "calories": 165,
          "proteinGrams": 31,
          "carbGrams": 0,
          "fatGrams": 3.6
        },
        "enabled": true,
        "sortOrder": 0
      }
    ]
  }
}
```

---

## 7. Verified Configuration Examples

### A. Customizable Product (`basic_meal`)
* **Product ID:** `6a33b0fef7ece2b8078e13f2`
* **Customization Status:** `isCustomizable = true`
* **Composer Summary:**
  * `contractVersion = dashboard_product_composer.v4`
  * `customization.enabled = true`
  * `customization.summary.linkedGroupCount = 2`
  * `customization.summary.linkedOptionCount = 14`
  * `customization.summary.requiredGroupCount = 2`
  * `validation.ok = true`
* **Linked Groups:**
  * **carbs**:
    * `groupId = 6a33b0a9f7ece2b8078e1131`
    * `displayStyle = chips`
    * `minSelections = 1`
    * `maxSelections = 2`
    * `isRequired = true`
    * `options count = 7`
  * **proteins**:
    * `groupId = 6a33b09ff7ece2b8078e10f2`
    * `displayStyle = radio_cards`
    * `minSelections = 1`
    * `maxSelections = 1`
    * `isRequired = true`
    * `options count = 7`

### B. Direct/Simple Product (`small_salad`)
* **Product ID:** `6a33b11df7ece2b8078e14eb`
* **Customization Status:** `isCustomizable = false`
* **Composer Summary:**
  * `contractVersion = dashboard_product_composer.v4`
  * `customization.enabled = false`
  * `customization.summary.linkedGroupCount = 0`
  * `customization.summary.linkedOptionCount = 0`
  * `customization.summary.requiredGroupCount = 0`
  * `customization.groups = []`
  * `validation.ok = true`

---

## 8. Dashboard Meal Builder / plannerCatalog Compatibility

To support legacy Dashboard clients while offering a canonical modern structure to mobile/app clients, the backend maintains two distinct catalog representations for meal plans.

### A. Core Differences

* **Dashboard Editorial Visual Model (Legacy Compatibility):**
  * Displays option categories directly.
  * Sections:
    * `premium`
    * `sandwich`
    * `chicken`
    * `beef`
    * `fish`
    * `eggs`
    * `carbs`
  * Represents an editorial view mapping for dashboard layout styling.

* **App-Facing Planner Catalog Model (Canonical V3):**
  * Built around selections/meals.
  * Sections:
    * `standard_meal` (product key = `basic_meal`, action = `open_builder`, requiresBuilder = `true`)
    * `premium_meal` (product key = `basic_meal`, action = `open_builder`, requiresBuilder = `true`, keeps extraFeeHalala = `2000` for premium options)
    * `sandwich` (type = `product_list`, action = `direct_add`, requiresBuilder = `false`)
    * `premium_large_salad` (product key = `premium_large_salad`, selectionType = `premium_large_salad`, action = `open_builder`, requiresBuilder = `true`, extraFeeHalala = `2900`)

These two shapes are **intentionally different**. The backend manages the transformation and aliases dynamically.

### B. Catalog Roles & Ownership

* **`builderCatalog`:**
  * The canonical app-facing meal planner catalog.
  * Used by Flutter/mobile app where supported.
* **`plannerCatalog`:**
  * Legacy/dashboard-compatible alias/projection.
  * **Rule:** Must be returned by `/api/subscriptions/meal-planner-menu` by default, without requiring `includeLegacy=true`.

* **Dashboard Readiness Status:**
  * Must not show `MEAL_BUILDER_NOT_PUBLISHED` when the backend has an app-usable planner catalog or an allowed dashboard fallback.
  * Must not hide real validation errors (all backend validation codes must propagate to the UI).
* **Dashboard-Only Virtual Fallback:**
  * Allowed only for dashboard state/readiness compatibility when no database configuration is published.
  * Must **not** leak into mobile/app validation as a real published user config.

#### Responsibility Matrix

* **Backend Responsibility:**
  * Catalog shape, validation rules, and schema structure.
  * `plannerCatalog` legacy compatibility translation.
  * Readiness checks, status code determinations, and validation messages.
  * Premium price validation and membership criteria.
* **Dashboard Responsibility:**
  * Pure display/visual representation.
  * **No** local premium pricing calculations.
  * **No** suppression of backend validation codes/errors.
* **Flutter (Mobile App) Responsibility:**
  * Rendering the backend-provided catalog.
  * Submitting selected item/option IDs.
  * **No** local premium price calculations.

### C. One-Time Add-on Catalog (`addonCatalog`)

* **Scope:** The `addonCatalog` returned by `/api/subscriptions/meal-planner-menu` is strictly reserved for **canonical one-time add-ons** (e.g., orange juice, protein snack).
* **Subscription Add-ons:** Subscription entitlement add-ons must use `/api/subscriptions/addons/options?planId=<planId>` and must **not** use `addonCatalog`. Flutter must not use `addonCatalog` for entitlement selections.
* **Filtering:** The backend strictly filters `addonCatalog` using a canonical allowlist and drops test/dev/internal artifacts (e.g. `dash-contract-*`). These items will never be exposed in public app endpoints.

---

## 9. Deferred Regression Test Checklist

To verify changes without running heavy test suites during local development, use this test checklist before deployment.

### A. Integration / Unit Tests
Run the following test commands to verify contract compliance and full-cycle planner compatibility:
```bash
NODE_ENV=test node tests/dashboardMealBuilderRegression.test.js
NODE_ENV=test node tests/dashboardMealBuilderFullCycle.test.js
NODE_ENV=test node tests/dashboardMealBuilderDefaultTemplate.test.js
NODE_ENV=test node tests/dashboardMealBuilderComposer.test.js
NODE_ENV=test node tests/dashboardMealBuilderHydratedDraft.test.js
NODE_ENV=test node tests/dashboardMealBuilderPickers.test.js
NODE_ENV=test node tests/subscriptionPlannerDashboardToFlutter.e2e.test.js
NODE_ENV=test node tests/dashboardSubscriptionMenuReadiness.test.js
NODE_ENV=test node tests/dashboardMenuProductCenteredContract.test.js
NODE_ENV=test node tests/verify_menu_fixes.test.js
NODE_ENV=test node tests/dashboardContracts.test.js
```

### B. Manual Verification (Postman / cURL)
Query the subscriptions planner endpoint:
```http
GET /api/subscriptions/meal-planner-menu
GET /api/subscriptions/meal-planner-menu?includeLegacy=true
```

**Expected JSON validation:**
1. Response status is success (`status = true`).
2. Both `builderCatalog` and `plannerCatalog` sections are returned and populated:
   * `data.builderCatalog.sections.length > 0`
   * `data.plannerCatalog.sections.length > 0`

---

## 10. Status
`PASS_WITH_COMPATIBILITY_DOCS`

```txt
Backend read side = PASS
Write endpoints = NOT_TESTED
Overall 11C = PASS_WITH_COMPATIBILITY_DOCS
```
