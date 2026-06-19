# Dashboard Add-on Plans Linking & Pricing Contract

This document is a Dashboard Frontend handoff describing the Add-ons Dashboard screen.
The Add-ons dashboard is only responsible for:
1. Viewing add-on subscription plans.
2. Linking existing menu products to an add-on subscription plan.
3. Updating the add-on plan prices by base subscription plan.
4. Toggling the add-on subscription plan active/inactive.
5. Editing basic add-on plan metadata such as name, category, and maxPerDay.

> **Note:** The Dashboard Add-ons page must NOT create menu products. Menu products are managed only from the Menu/Catalog dashboard. The dashboard simply links existing products. Do not document or expose "Create Add-on Item" as part of this dashboard screen.

## Dashboard Scope

The screen manages only these add-on subscription plans:
* Juice Subscription
* Snack Subscription
* Small Salad Subscription

> **Note:** "Healthy Dessert", "Snack Box", "Protein Snack", or any other menu product / one-time item must NEVER appear as a subscription plan. The backend filters out these decoy records automatically.

The screen does not create these plan categories dynamically.
The dashboard edits existing add-on subscription plans.

The dashboard can:
* edit name
* edit category from fixed select
* edit maxPerDay
* link/unlink existing menu products
* edit matrix prices
* toggle active/inactive

The dashboard cannot:
* create menu products
* edit menu product details
* delete menu products
* create one-time add-on items
* manage mobile/customer daily selection
* calculate customer quote totals
* call `/api/dashboard/addon-prices` to render the main screen

## Recommended Endpoint Scope

Required endpoints for this screen:

1. **GET** `/api/dashboard/addons`
   Main screen read model.

2. **PUT** `/api/dashboard/addons/:id`
   Save one add-on subscription plan, including linked menu products and plan prices.

3. **PATCH** `/api/dashboard/addons/:id/toggle`
   Toggle active/inactive.

4. **GET menu products picker endpoint**
   `GET /api/dashboard/menu/products`

5. **GET base plans picker endpoint**
   `GET /api/dashboard/plans`

## GET /api/dashboard/addons

This is the main read endpoint.
The dashboard uses it to load:
* existing add-on subscription plans
* currently linked menu products for each plan
* pricing matrix for each plan
* category select options
* summary counts

> **Note:** `data.items` is NOT returned in the default Dashboard response. The dashboard only receives and renders the configured add-on subscription plans.

### Response Shape

```json
{
  "status": true,
  "data": {
    "plans": [
      {
        "id": "addon_plan_id",
        "name": {
          "ar": "اشتراك العصير",
          "en": "Juice Subscription"
        },
        "category": "juice",
        "maxPerDay": 1,
        "isActive": true,
        "menuProductIds": [
          "menu_product_id_1",
          "menu_product_id_2"
        ],
        "menuProducts": [
          {
            "id": "menu_product_id_1",
            "key": "orange_juice",
            "name": {
              "ar": "عصير برتقال",
              "en": "Orange Juice"
            },
            "category": "drinks",
            "image": "",
            "isActive": true
          }
        ],
        "planPrices": [
          {
            "basePlanId": "base_plan_id_1",
            "basePlanName": {
              "ar": "اشتراك 7 أيام",
              "en": "7-Day Meal Subscription"
            },
            "daysCount": 7,
            "mealsCount": 14,
            "priceHalala": 10000,
            "priceSar": 100,
            "priceLabel": "100 SAR",
            "isActive": true
          }
        ]
      }
    ],
    "meta": {
      "addonPlanCategories": [
        {
          "key": "juice",
          "label": {
            "ar": "اشتراك العصير",
            "en": "Juice Subscription"
          }
        },
        {
          "key": "small_salad",
          "label": {
            "ar": "اشتراك السلطة الصغيرة",
            "en": "Small Salad Subscription"
          }
        },
        {
          "key": "snack",
          "label": {
            "ar": "اشتراك السناك",
            "en": "Snack Subscription"
          }
        }
      ]
    },
    "summary": {
      "plansCount": 3,
      "matrixRowsCount": 9,
      "currency": "SAR"
    }
  }
}
```

## Editable Fields

The frontend can edit only these fields:

For add-on plan:
* `name.ar`
* `name.en`
* `category`
* `maxPerDay`
* `isActive`
* `menuProductIds`
* `planPrices[].basePlanId`
* `planPrices[].priceHalala`
* `planPrices[].isActive`

Read-only fields:
* `id`
* `_id`
* `kind`
* `type`
* `pricingMode`
* `menuProducts`
* `menuProductsCount`
* `planPricesCount`
* `basePlanName`
* `daysCount`
* `mealsCount`
* `priceSar`
* `priceLabel`
* `currency`

Do not ask the dashboard frontend to send read-only fields.

## PUT /api/dashboard/addons/:id

This is the main save endpoint for the add-on subscription plan.

### Payload

```json
{
  "name": {
    "ar": "اشتراك العصير",
    "en": "Juice Subscription"
  },
  "category": "juice",
  "maxPerDay": 1,
  "isActive": true,
  "menuProductIds": [
    "menu_product_id_1",
    "menu_product_id_2",
    "menu_product_id_3"
  ],
  "planPrices": [
    {
      "basePlanId": "base_plan_id_1",
      "priceHalala": 10000,
      "isActive": true
    },
    {
      "basePlanId": "base_plan_id_2",
      "priceHalala": 18000,
      "isActive": true
    },
    {
      "basePlanId": "base_plan_id_3",
      "priceHalala": 30000,
      "isActive": true
    }
  ]
}
```

> **Note:** The backend implicitly infers `kind: "plan"`. Do not send `kind` in the payload.

Save behavior:
* Replaces/updates plan metadata.
* Replaces/updates linked menu products.
* Upserts pricing matrix rows by `basePlanId`.
* Returns the updated full plan with nested `menuProducts` and `planPrices`.

## Menu Product Linking

Rules:
* Add-ons dashboard does not create products.
* Products must exist in Menu/Catalog first.
* The dashboard fetches existing products from the menu products picker endpoint.
* The dashboard submits selected product IDs as `menuProductIds`.
* `menuProducts[]` in the read response is display-only.
* To add a new product to Juice Subscription, create the product in Menu first, then link it here.

### Menu Products Picker Endpoint

`GET /api/dashboard/menu/products`

Minimal response:
```json
{
  "status": true,
  "data": [
    {
      "id": "menu_product_id",
      "key": "watermelon_juice",
      "name": {
        "ar": "عصير بطيخ",
        "en": "Watermelon Juice"
      },
      "category": "drinks",
      "image": "",
      "isActive": true
    }
  ]
}
```

Frontend:
* show searchable multi-select
* select by `id`
* submit selected IDs as `menuProductIds`

## Base Plan Pricing Matrix

Rules:
* Add-on plan price is a flat package price for each base subscription plan.
* Frontend must not multiply by days.
* Frontend must not multiply by meals.
* Frontend edits only `priceHalala` and `isActive` per base plan.
* Display `priceLabel` from backend after saving/loading.

### Base Plans Picker Endpoint

`GET /api/dashboard/plans`

Minimal response:
```json
{
  "status": true,
  "data": [
    {
      "id": "base_plan_id",
      "name": {
        "ar": "اشتراك 7 أيام",
        "en": "7-Day Meal Subscription"
      },
      "daysCount": 7,
      "mealsCount": 14,
      "isActive": true
    }
  ]
}
```

Frontend:
* render one matrix row per sellable base plan
* submit each row as:
  ```json
  {
    "basePlanId": "...",
    "priceHalala": 10000,
    "isActive": true
  }
  ```

## Category Select

Allowed values:
* `juice`
* `small_salad`
* `snack`

Source: `data.meta.addonPlanCategories`

Frontend:
* render select options from `label.ar` / `label.en`
* submit only `key`

Do not hardcode labels if meta is available.

## Toggle

`PATCH /api/dashboard/addons/:id/toggle`

No payload is required.

## Validation

The frontend must block submit if:
* name.ar is empty
* name.en is empty
* category is not selected
* category is not one of `juice`, `small_salad`, `snack`
* menuProductIds is empty
* planPrices is empty
* any planPrices[].basePlanId is missing
* any planPrices[].priceHalala is missing, not a number, or negative

Backend errors are generic:
```json
{
  "ok": false,
  "error": {
    "code": "INVALID",
    "message": "..."
  }
}
```

## Frontend Do / Don't

**Do:**
* Use `GET /api/dashboard/addons` to load the screen.
* Edit only `data.plans`.
* Link existing menu products only.
* Use `PUT /api/dashboard/addons/:id` to save a plan.
* Use `menuProductIds` for selected linked products.
* Use `planPrices[].priceHalala` for prices.

**Don't:**
* Do not create products from Add-ons page.
* Do not send `menuProducts`.
* Do not send read-only fields.
* Do not use `/api/dashboard/addon-prices` for the main screen.
* Do not multiply add-on price by days or meals.
* Do not flatten `menuProducts` as top-level add-on plans.
* Do not manage one-time items from this screen.