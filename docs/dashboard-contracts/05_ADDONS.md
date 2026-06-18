# Screen Contract: 05_ADDONS

## 1. Screen Purpose
Provides CRUD operations for Add-on items, Add-on subscription plans, and the Plan Add-on pricing matrix. Operators can configure available add-ons, associate them with menu products for entitlement selections, set unique prices per base subscription plan in the pricing matrix, and toggle active/disabled states.

## 2. Dashboard Route
`/addons`

## 3. Visible UI Requirements
* List of Add-on items showing: Thumbnail, Arabic & English Name, Price, Category, and Status.
* List of Add-on subscription plans showing: Billing type, maximum allocation per day, and associated items.
* Pricing Matrix configuration dashboard linking Add-on plans to Base subscription plans with custom prices.
* Modals to Create/Edit Add-on items, plans, and pricing matrix rows.

## 4. Backend Endpoints
* `GET /api/dashboard/addons` (lists all addons)
* `POST /api/dashboard/addons` (creates an addon item or plan)
* `GET /api/dashboard/addons/:id` (fetches a single addon)
* `PUT /api/dashboard/addons/:id` (updates addon)
* `PATCH /api/dashboard/addons/:id/toggle` (toggles isActive)
* `DELETE /api/dashboard/addons/:id` (deletes an addon)
* `GET /api/dashboard/addon-plans` (lists addon plans)
* `GET /api/dashboard/addon-items` (lists addon items)

### Pricing Matrix Endpoints
* `GET /api/dashboard/addon-prices` (lists pricing matrix rows with populated addon and plan names)
* `POST /api/dashboard/addon-prices` (creates a pricing matrix row)
* `PUT /api/dashboard/addon-prices/:id` (updates a pricing matrix row)
* `DELETE /api/dashboard/addon-prices/:id` (deletes a pricing matrix row)
* `PATCH /api/dashboard/addon-prices/:id/toggle` (toggles pricing matrix row active status)

## 5. Request Parameters
* Body (Create/Update Addon):
  * `kind` (required, string, values: `item`, `plan`)
  * `name` (required, object): `{ ar: string, en: string }`
  * `category` (required, string, values: `salads`, `proteins`, `sandwiches`, `addons`, etc.)
  * `price` (required, number, in major units)
  * `billingMode` (optional, string, values: `per_day`, `per_meal`)
  * `maxPerDay` (optional, number, default 1)
  * `menuProductIds` (optional, array of ObjectIds): links the addon plan to allowed selection menu products.

* Body (Create/Update Pricing Matrix Row):
  * `addonPlanId` (required, string/ObjectId)
  * `basePlanId` (required, string/ObjectId)
  * `priceHalala` (required, integer)
  * `isActive` (optional, boolean, default true)

## 6. Response Fields Required
* `status` (boolean): `true` if request succeeded.
* `data` (addon object or array of addon objects / pricing matrix objects):
  * Addon (List & Detail):
    * `id` (string)
    * `_id` (string)
    * `kind` (string, e.g. "plan" or "item")
    * `type` (string, e.g. "subscription" or "one_time")
    * `name` (object): `{ ar, en }`
    * `category` (string)
    * `maxPerDay` (number)
    * `menuProductIds` (array of strings)
    * `menuProductsCount` (number)
    * `planPricesCount` (number)
    * `pricingMode` (string, e.g. "base_plan_matrix")
    * `isActive` (boolean)
    * `legacyCompatibility` (object, optional): Contains backward-compatible fields like `priceHalala`, `billingMode`, `billingUnit`. Do not use as the dashboard source of truth.
    * *(Note: For `kind: "item"`, direct pricing fields may still appear at the top level.)*
    * For Detail:
      * `menuProducts` (array of objects): lists allowed selections with `id`, `_id`, `name`, `image` (imageUrl), `category` (category key), and `isActive`.
      * `planPrices` (array of objects): lists associated prices with `id`, `_id`, `addonPlanId`, `basePlanId`, `basePlanName`, `daysCount`, `mealsCount`, `basePlanPriceHalala`, `priceHalala`, `priceSar`, `priceLabel`, `currency`, and `isActive`.
  * Pricing Matrix Row:
    * `id` (string)
    * `_id` (string)
    * `addonPlanId` (string)
    * `addonPlanName` (object): `{ ar, en }`
    * `category` (string)
    * `basePlanId` (string)
    * `basePlanName` (object): `{ ar, en }`
    * `daysCount` (number)
    * `mealsCount` (number)
    * `priceHalala` (number)
    * `priceSar` (number)
    * `priceLabel` (string)
    * `currency` (string)
    * `isActive` (boolean)

## 7. Field Dictionary
* `kind`: Determines whether the addon is a one-time purchase `item` or a subscription `plan`.
* `billingMode`: Determines billing frequency. `per_day` counts once per selected day, while `per_meal` scales with total meals selected.
* `menuProductIds`: Relates a dashboard addon subscription plan to concrete MenuProduct entitlements.
* `maxPerDay`: Maximum selections allowed per day for a subscription addon plan.
* `planPricesCount`: Counts only default dashboard-visible sellable matrix rows.
* `planPrices`: Detail array rows include the matrix row `id` for CRUD operations.

## 8. Classification
`CRUD`

## 9. Frontend Restrictions
* **No Pricing Calculation**: The frontend must send raw values input by the user. Taxes and vat breakdown are computed by the backend upon checkout.
* **No Category Creation**: Category values are constrained by backend enums.
* **Pricing Matrix Constraint**: The combination of `addonPlanId` + `basePlanId` must be unique for active pricing matrix entries.
* **Matrix Pricing Source of Truth**: The dashboard must exclusively use `planPrices` to display and configure addon subscription plan prices. Legacy price fields are hidden and must not be used.

## 10. Backend Acceptance Criteria
* Validate billing modes for plan addons (only `per_day` and `per_meal` are allowed).
* Enforce unique names if required.
* Validate that active pricing matrix rows do not conflict or create duplicate combinations of same addon and base plan.

## 11. Contract Tests Required
* List endpoint returns valid array.
* Toggle active endpoint changes the flag correctly.
* Pricing matrix CRUD validations reject duplicate active rows.

## 12. Known Risks
* Deleting addons that are currently active in customer subscription entitlements could break balance audits. The backend soft-deletes or warns if the item is in use.

## 13. Customer / Flutter Add-on Options Endpoint

### Endpoint
`GET /api/subscriptions/addons/options?planId=:planId`

**Auth**: Bearer `app_access` token (customer auth, same as subscription quote).

### Purpose
Returns active add-on subscription plans with backend-resolved flat matrix prices for the selected base plan. Flutter calls this **after** the customer selects a base plan and **before** calling quote.

### Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `planId` | ObjectId string | ✅ | The selected base subscription plan ID |

### Response Shape
```json
{
  "status": true,
  "data": {
    "planId": "...",
    "addons": [
      {
        "id": "...",
        "addonPlanId": "...",
        "name": { "ar": "...", "en": "..." },
        "category": "juice",
        "maxPerDay": 1,
        "pricingMode": "base_plan_matrix",
        "priceHalala": 10000,
        "priceSar": 100,
        "priceLabel": "100 SAR",
        "currency": "SAR",
        "isAvailable": true,
        "menuProductIds": ["..."],
        "menuProductsCount": 3,
        "menuProducts": [
          { "id": "...", "_id": "...", "name": { "ar": "...", "en": "..." }, "image": "...", "category": "...", "isActive": true }
        ]
      }
    ]
  }
}
```

### Flutter Integration Flow
1. Customer selects a base subscription plan (e.g. 7-Day Plan).
2. Flutter calls `GET /api/subscriptions/addons/options?planId=<selectedPlanId>`.
3. Flutter displays available add-on subscriptions using `name`, `priceLabel` / `priceSar`, and `menuProducts`.
4. Customer selects add-ons.
5. Flutter sends selected addon IDs to `POST /api/subscriptions/quote` in the `addons` array.
6. Flutter displays the final invoice from the quote response.

### Rules
* Flutter **must not** calculate add-on subscription prices. All prices are backend-resolved.
* Flutter should display `priceLabel` or `priceSar` from this endpoint.
* Only add-on plans with active `AddonPlanPrice` matrix rows for the selected base plan are returned.
* The price is the flat package price for the entire subscription duration. It is **not** multiplied by days or meals.

### Error Responses
| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing or invalid `planId` |
| 404 | `NOT_FOUND` | Base plan not found or inactive |

## 14. Status
`READY`

