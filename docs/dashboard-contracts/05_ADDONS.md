# Dashboard Add-on Subscription Plans CRUD, Linking & Pricing Contract

The Add-ons page manages dashboard-visible add-on subscription plans. Existing seeded plans include Juice, Snack, and Small Salad, and new plans may be created through `POST /api/dashboard/addons`.

The page links existing Menu/Catalog products; it never creates, edits, or deletes menu products. A product must be created in Menu/Catalog first, and the frontend submits only its ID in `menuProductIds`. Subscription pricing is stored in `planPrices` as `priceHalala` per base plan. No separate `/api/dashboard/addon-prices` screen or endpoint is needed for this workflow.

## Endpoint list

1. `GET /api/dashboard/addons`
2. `POST /api/dashboard/addons`
3. `PUT /api/dashboard/addons/:id`
4. `DELETE /api/dashboard/addons/:id`
5. `PATCH /api/dashboard/addons/:id/toggle`
6. `GET /api/dashboard/menu/products`
7. `GET /api/dashboard/plans`

The existing picker forms remain supported where available:

- `GET /api/dashboard/menu/products?view=picker`
- `GET /api/dashboard/plans?view=picker`

## GET /api/dashboard/addons

Returns every active, dashboard-visible subscription add-on plan with a real plan discriminator and pricing matrix. Menu products, one-time items, inactive/archived plans, and item-shaped decoys are excluded. The selection is not based on display names and is not limited to three seeded plans.

```json
{
  "status": true,
  "data": {
    "plans": [
      {
        "id": "addon_plan_id",
        "name": { "ar": "اشتراك الزبادي", "en": "Yogurt Subscription" },
        "category": "snack",
        "maxPerDay": 1,
        "isActive": true,
        "menuProductIds": ["menu_product_id_1"],
        "menuProducts": [
          {
            "id": "menu_product_id_1",
            "key": "yogurt_cup",
            "name": { "ar": "كوب زبادي", "en": "Yogurt Cup" },
            "category": "snacks",
            "image": "",
            "isActive": true
          }
        ],
        "planPrices": [
          {
            "basePlanId": "base_plan_id_1",
            "basePlanName": { "ar": "خطة 7 أيام", "en": "7 Day Plan" },
            "daysCount": 7,
            "mealsCount": 14,
            "priceHalala": 7000,
            "priceSar": 70,
            "priceLabel": "70 SAR",
            "isActive": true
          }
        ]
      }
    ],
    "meta": {
      "addonPlanCategories": [
        { "key": "juice", "label": { "ar": "اشتراك العصير", "en": "Juice Subscription" } },
        { "key": "small_salad", "label": { "ar": "اشتراك السلطة الصغيرة", "en": "Small Salad Subscription" } },
        { "key": "snack", "label": { "ar": "اشتراك السناك", "en": "Snack Subscription" } }
      ]
    },
    "summary": { "plansCount": 1, "matrixRowsCount": 1, "currency": "SAR" }
  }
}
```

There is no `data.items`. Plan, product, and price objects use only the fields shown above; internal discriminators, timestamps, `_id`, `__v`, compatibility data, and price-row `addonPlanId` are not returned.

## POST /api/dashboard/addons

Creates one subscription add-on plan and links existing menu products. It does not create menu products.

```json
{
  "name": { "ar": "اشتراك الزبادي", "en": "Yogurt Subscription" },
  "category": "snack",
  "maxPerDay": 1,
  "isActive": true,
  "menuProductIds": ["menu_product_id_1", "menu_product_id_2"],
  "planPrices": [
    { "basePlanId": "base_plan_id_1", "priceHalala": 7000, "isActive": true },
    { "basePlanId": "base_plan_id_2", "priceHalala": 14000, "isActive": true }
  ]
}
```

Validation:

- `name.ar` and `name.en` are required non-empty strings.
- `category` is required and must be `juice`, `snack`, or `small_salad`.
- `maxPerDay`, when supplied, must be a number greater than or equal to zero.
- `isActive`, when supplied, must be boolean.
- `menuProductIds` is required, must contain at least one existing menu product ID, and contains links only.
- `planPrices` is required and must contain at least one row.
- Every row requires an existing `basePlanId` and numeric `priceHalala >= 0`; optional `isActive` must be boolean.
- Duplicate product IDs and duplicate base-plan rows are rejected.

Success is `201` and returns the same lean populated plan DTO used inside GET.

## PUT /api/dashboard/addons/:id

Updates plan metadata, linked `menuProductIds`, and the `planPrices` matrix. `kind` is not required. Sending `planPrices` replaces/upserts the plan's matrix by `basePlanId`. The response is the same lean populated plan DTO.

## DELETE /api/dashboard/addons/:id

Safely archives the subscription plan by setting `isActive=false`. The plan and its matrix remain stored for historical subscriptions, orders, payments, invoices, and audit records. Default GET no longer returns it.

```json
{
  "status": true,
  "data": { "id": "addon_plan_id", "archived": true, "isActive": false }
}
```

## PATCH /api/dashboard/addons/:id/toggle

Toggles the plan's active state. Inactive plans are omitted from default GET.

## Picker ownership

Use `GET /api/dashboard/menu/products` to select existing products and submit their IDs in `menuProductIds`. Use `GET /api/dashboard/plans` to select base plans and submit each ID with its `priceHalala` in `planPrices`. The Add-ons page does not manage customer daily selection or calculate customer quote totals.
