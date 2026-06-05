# Meal Planner `builderCatalogV2` Contract

## Ownership

`builderCatalogV2` is the canonical read contract for meal planner rendering from:

```text
GET /api/subscriptions/meal-planner-menu
```

Backend internals may evolve, but the emitted `builderCatalogV2` shape must remain stable unless a new version is introduced. Existing compatibility surfaces remain supported in this phase:

- `data.builderCatalog`
- `includeLegacy=true`
- legacy `data.regularMeals`
- legacy `data.premiumMeals`
- legacy `data.addons`

## Phase Rules

This contract lockdown phase is documentation and tests only.

- No field renames.
- No controller response restructuring.
- No hidden normalization changes.
- No dashboard UI changes.
- No mobile changes.
- No legacy field removal.
- No payment, checkout, planner validation, timeline, premium balance, or persistence refactor.

## Response Shape

Default response:

```json
{
  "status": true,
  "data": {
    "builderCatalog": {},
    "addonCatalog": {
      "items": [],
      "byCategory": {},
      "totalCount": 0
    },
    "builderCatalogV2": {
      "catalogVersion": "meal_planner_menu.v2",
      "currency": "SAR",
      "sections": [],
      "rules": {}
    }
  }
}
```

With `includeLegacy=true`, the endpoint must keep the same default fields and also return the legacy fields:

```json
{
  "status": true,
  "data": {
    "builderCatalog": {},
    "addonCatalog": {},
    "builderCatalogV2": {},
    "currency": "SAR",
    "regularMeals": {},
    "premiumMeals": {},
    "addons": {}
  }
}
```

## `builderCatalogV2`

Top-level fields:

| Field | Contract |
| --- | --- |
| `catalogVersion` | Stable version string. Current value: `meal_planner_menu.v2`. |
| `currency` | System currency. Current value: `SAR`. |
| `sections` | Rendering tree for planner choices. |
| `rules` | Machine-readable planner rules. |

Every section must use this shape:

```json
{
  "id": "section:premium_meal",
  "key": "premium_meal",
  "type": "meal_builder",
  "name": "Premium Meal",
  "ui": {
    "cardVariant": "premium"
  },
  "products": []
}
```

Every configurable product must use this shape where applicable:

```json
{
  "id": "virtual:premium_meal",
  "key": "premium_meal",
  "type": "virtual_builder_product",
  "isVirtual": true,
  "selectionType": "premium_meal",
  "ui": {
    "cardVariant": "premium"
  },
  "optionGroups": []
}
```

Every option group must use this shape:

```json
{
  "id": "group_id",
  "groupId": "group_id",
  "key": "protein",
  "sourceKey": "proteins",
  "name": "Protein",
  "nameI18n": {
    "ar": "بروتين",
    "en": "Protein"
  },
  "minSelections": 1,
  "maxSelections": 1,
  "isRequired": true,
  "sortOrder": 10,
  "ui": {
    "displayStyle": "chips"
  },
  "rules": {},
  "options": []
}
```

`maxSelections` is nullable. `null` means unlimited. Current Basic Diet planner fixtures use finite planner group limits; the contract still reserves nullable semantics and tests must reject accidental coercion if a nullable group is emitted later.

Protein groups may include `optionSections` for tabbed rendering:

```json
{
  "optionSections": [
    {
      "key": "chicken",
      "name": "Chicken",
      "options": []
    }
  ]
}
```

Availability is applied by filtering unpublished, inactive, hidden, unavailable, or globally unavailable catalog rows before the response is emitted. This phase does not introduce disabled rows or new availability field names into `builderCatalogV2`.

## Real Basic Diet Examples

### Standard Protein Meal

The standard meal section is rendered from a virtual product:

```json
{
  "key": "standard_meal",
  "type": "meal_builder",
  "products": [
    {
      "id": "virtual:standard_meal",
      "selectionType": "standard_meal",
      "optionGroups": [
        {
          "key": "protein",
          "sourceKey": "proteins",
          "minSelections": 1,
          "maxSelections": 1,
          "isRequired": true,
          "ui": {
            "displayStyle": "chips"
          },
          "optionSections": []
        },
        {
          "key": "carb",
          "sourceKey": "carbs",
          "rules": {
            "maxTypes": 2,
            "maxTotalGrams": 300,
            "unit": "grams"
          }
        }
      ]
    }
  ]
}
```

### Premium Steak Meal

Premium meals use the `premium_meal` section and premium protein options such as `beef_steak`:

```json
{
  "key": "premium_meal",
  "products": [
    {
      "id": "virtual:premium_meal",
      "selectionType": "premium_meal",
      "optionGroups": [
        {
          "key": "protein",
          "options": [
            {
              "key": "proteins_beef_steak",
              "premiumKey": "beef_steak",
              "selectionType": "premium_meal",
              "isPremium": true,
              "extraFeeHalala": 1600,
              "currency": "SAR"
            }
          ]
        }
      ]
    }
  ]
}
```

### Sandwich

Sandwiches are emitted as real menu products and remain write-compatible through their product `id`:

```json
{
  "key": "sandwich",
  "type": "product_list",
  "products": [
    {
      "key": "grilled_chicken_cold_sandwich",
      "selectionType": "sandwich",
      "pricingModel": "fixed",
      "priceHalala": 1300,
      "currency": "SAR",
      "ui": {
        "cardVariant": "standard"
      }
    }
  ]
}
```

### Premium Large Salad

Premium large salad is a configurable product with canonical salad groups:

```json
{
  "key": "premium_large_salad",
  "type": "configurable_product",
  "products": [
    {
      "key": "premium_large_salad",
      "selectionType": "premium_large_salad",
      "premiumKey": "premium_large_salad",
      "presetKey": "large_salad",
      "priceHalala": 2900,
      "extraFeeHalala": 2900,
      "currency": "SAR",
      "optionGroups": [
        { "key": "leafy_greens" },
        { "key": "vegetables" },
        { "key": "protein" },
        { "key": "cheese_nuts" },
        { "key": "fruits" },
        { "key": "sauce" }
      ]
    }
  ]
}
```

### Unlimited Selection Edge Case

The contract reserves `maxSelections: null` for unlimited groups:

```json
{
  "key": "extras",
  "minSelections": 0,
  "maxSelections": null,
  "isRequired": false
}
```

Clients must enforce an upper bound only when `maxSelections !== null`. Backend validation remains authoritative.

## Contract Tests

The dedicated backend contract test must verify:

- `builderCatalogV2.catalogVersion` is `meal_planner_menu.v2`.
- `sections -> products -> optionGroups -> options` exists for planner rendering.
- Rules and `ui.displayStyle` are machine-readable.
- Protein groups expose `optionSections` where applicable.
- Pricing fields are present for premium meal, sandwich, and premium large salad examples.
- `maxSelections` remains either a number or `null`; it is never coerced into a frontend default.
- Default response keeps `builderCatalog`, `addonCatalog`, and `builderCatalogV2`.
- `includeLegacy=true` keeps legacy fields unchanged.

## Exit Criteria

- This spec is approved.
- Real Basic Diet response examples above are protected by backend contract tests.
- `builderCatalog`, `includeLegacy`, and compatibility fields are verified unchanged.
- No runtime behavior changes are introduced in planner save, validation, payment, checkout, premium balance, timeline, or subscription lifecycle.
- The project is ready for a later dashboard product-composer phase.
