# Menu Meal Planner Backend Verification Gate

Date: 2026-06-06
Scope: backend contract audit against `docs/MENU_MEAL_PLANNER_BACKEND_REFACTOR_BRIEF.md`.

## Executive Status

The backend now supports canonical planner read and canonical v3 write paths while keeping legacy planner compatibility.

Implemented:

- `GET /api/subscriptions/meal-planner-menu` returns canonical `plannerCatalog` by default.
- `GET /api/subscriptions/meal-planner-menu?contractVersion=v3` continues to return canonical v3 data.
- Legacy-compatible fields remain: `builderCatalog`, `addonCatalog`, `builderCatalogV2`, and `includeLegacy=true` fields.
- v3 save/validate accepts `productId + selectedOptions`.
- v3 validation uses canonical product/group/option relations as the authority.
- v3 draft persistence stores canonical `productId`, `productKey`, `selectedOptions`, pricing/display/fulfillment snapshots, and compatibility projections.
- v3 confirm revalidates canonical slots and writes `confirmationSnapshot`.
- Legacy save/validate/confirm still works.

Remaining caution:

- `src/services/admin/mealPlannerMenu.service.js` still owns legacy `Builder*`/planner mirror flows. Canonical dashboard/menu admin flows must be routed through canonical menu relation APIs or a tested sync layer before retiring legacy admin ownership.

## Verification Evidence

Commands run:

```sh
npm run test:builder-catalog-v2-contract
NODE_ENV=test node tests/mealPlannerCanonicalV3Write.test.js
NODE_ENV=test node tests/mealPlannerCanonicalContract.test.js
npm test
```

Result:

- `test:builder-catalog-v2-contract`: passed.
- `mealPlannerCanonicalV3Write.test.js`: passed.
- `mealPlannerCanonicalContract.test.js`: passed.
- `npm test`: passed.

## 1. Backend Contract Audit

Status: **Pass**

### Default Endpoint

Endpoint:

```txt
GET /api/subscriptions/meal-planner-menu
```

Current behavior:

- Returns `plannerCatalog.contractVersion = "meal_planner_menu.v3"`.
- Returns `plannerCatalog.sections`.
- Keeps compatibility fields: `builderCatalog`, `addonCatalog`, and `builderCatalogV2`.

### v3 Endpoint

Endpoint:

```txt
GET /api/subscriptions/meal-planner-menu?contractVersion=v3
```

Current behavior:

- Returns the same canonical planner catalog.
- Uses `section -> product -> optionGroups -> options`.
- Includes relation-level selection limits and option prices.
- Filters on active/visible/available/published/subscription-enabled rows.

### includeLegacy

Endpoint:

```txt
GET /api/subscriptions/meal-planner-menu?includeLegacy=true
```

Current behavior:

- Keeps legacy fields: `currency`, `regularMeals`, `premiumMeals`, `addons`.
- Keeps `builderCatalog`, `addonCatalog`, `builderCatalogV2`, and `plannerCatalog`.

Status: **Pass**

## 2. Selection Cycle Verification

Status: **Pass for v3 canonical path and legacy path**

Canonical accepted write shape:

```json
{
  "contractVersion": "meal_planner_menu.v3",
  "mealSlots": [
    {
      "slotIndex": 1,
      "selectionType": "standard_meal",
      "productId": "MenuProduct id",
      "selectedOptions": [
        {
          "groupId": "MenuOptionGroup id",
          "groupKey": "proteins",
          "optionId": "MenuOption id",
          "optionKey": "grilled_chicken",
          "quantity": 1
        },
        {
          "groupId": "MenuOptionGroup id",
          "groupKey": "carbs",
          "optionId": "MenuOption id",
          "optionKey": "white_rice",
          "quantity": 1,
          "grams": 150
        }
      ]
    }
  ]
}
```

Current persistence:

- v3 slots store `contractVersion`, `productId`, `productKey`, and `selectedOptions`.
- v3 slots store `pricingSnapshot`, `displaySnapshot`, and `fulfillmentSnapshot`.
- v3 confirmed slots store `confirmationSnapshot`.
- Legacy compatibility projections remain on v3 slots where needed by existing downstream services: `proteinId`, `carbs`, `sandwichId`, `salad`, premium fields, `materializedMeals`, `selections`, `premiumUpgradeSelections`, and `baseMealSlots`.

Legacy accepted write shape still works:

```json
{
  "mealSlots": [
    {
      "slotIndex": 1,
      "selectionType": "standard_meal",
      "proteinId": "BuilderProtein or MenuOption id",
      "carbs": [
        { "carbId": "BuilderCarb or MenuOption id", "grams": 150 }
      ]
    }
  ]
}
```

## 3. Canonical Validation

Status: **Pass for v3 path**

v3 validation uses:

- `MenuProduct`
- `ProductOptionGroup`
- `MenuOptionGroup`
- `ProductGroupOption`
- `MenuOption`

The validator rejects stale selections when:

- product is missing, inactive, unavailable, unpublished, or not subscription-enabled;
- group is missing or not attached to the product;
- product-group relation is inactive/unavailable;
- option is missing, inactive, unavailable, unpublished, or not subscription-enabled;
- option belongs to the wrong group;
- option is not attached through the selected product/group relation;
- option relation is inactive/unavailable;
- min/max group selections are violated;
- quantity is invalid;
- v3 request mixes canonical and legacy fields in the same incoming slot.

Premium large salad still rejects `extra_protein_50g`.

## 4. Confirm Snapshot

Status: **Pass for v3 path**

On confirm, v3 slots are revalidated through the canonical validator and persisted with `confirmationSnapshot`, including:

- product id/key/name/price/currency;
- selected option ids/keys/names;
- group ids/keys/names;
- quantities and grams;
- option unit/total prices;
- final pricing snapshot.

This keeps confirmed day data understandable after later catalog renames, disables, or repricing.

## 5. Dashboard/Admin Readiness

Status: **Partial**

Canonical menu relation changes affect:

- v3 read projection;
- v3 validation;
- v3 save draft;
- v3 confirm revalidation.

Remaining ownership issue:

- `src/services/admin/mealPlannerMenu.service.js` still manages legacy planner mirrors.
- The production dashboard should prefer canonical menu/product/group/option relation management for planner-facing catalog edits.
- If legacy admin endpoints remain in use, a tested legacy-to-canonical sync layer is still needed.

## Backend Gate Checklist

| Gate | Current Status | Release Decision |
| --- | --- | --- |
| Default endpoint returns canonical `plannerCatalog.sections` | Pass | Ready |
| `contractVersion=v3` returns canonical planner catalog | Pass | Ready |
| `includeLegacy=true` remains compatible | Pass | Ready |
| v3 follows section/product/group/option relation shape | Pass | Ready |
| Standard meal reads relation rules/prices | Pass | Ready |
| Premium meal relation source | Pass for seed relation update | Ready, monitor seeded data |
| Premium large salad excludes/rejects `extra_protein_50g` | Pass | Ready |
| Validation uses product relations as authority | Pass for v3 | Ready |
| Save stores `productId + selectedOptions` | Pass for v3 | Ready |
| Confirm snapshots canonical selections | Pass for v3 | Ready |
| Legacy save/confirm still works | Pass | Ready |
| Dashboard canonical relation changes affect validation | Pass for relation disable test | Ready for canonical admin flow |
| Legacy admin ownership resolved | Partial | Needs dashboard ownership decision |

## Recommended Next Backend Phase

Before frontend build-out, decide dashboard ownership:

1. Prefer canonical menu relation admin APIs for planner management.
2. Keep legacy admin planner endpoints only as compatibility tools.
3. Add or keep tests proving relation disable/reprice/availability changes affect v3 read, validation, save, and confirm.

After that, create the final mobile/dashboard integration guide from this implemented v3 behavior.
