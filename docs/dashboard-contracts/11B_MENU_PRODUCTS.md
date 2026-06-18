# Screen Contract: 11B_MENU_PRODUCTS

## 1. Screen Purpose
Provides CRUD operations, duplication, bulk updates, reordering, and visibility/availability controls for products inside the menu catalog.

## 2. Dashboard Route
`/menu` (Products tab)

## 3. Visible UI Requirements
* List of products (filterable by Category).
* Create/Edit Product dialogs.
* Duplicate Product button.
* Reorder handler.
* Bulk update actions.

## 4. Backend Endpoints
* `GET /api/dashboard/menu/products` (lists products)
* `GET /api/dashboard/menu/products?categoryId=:categoryId` (lists products filtered by category ID)
* `GET /api/dashboard/menu/products/:id` (gets product details, including category and group summary)
* `PATCH /api/dashboard/menu/products/:id` (updates product fields)
* `PATCH /api/dashboard/menu/products/bulk` (bulk updates products)
* `PATCH /api/dashboard/menu/products/reorder` (reorders products sortOrder)
* `POST /api/dashboard/menu/products/:id/duplicate` (duplicates product and option group mappings in disabled draft state)
* `PATCH /api/dashboard/menu/products/:id/visibility` (toggles `isVisible` state)
* `PATCH /api/dashboard/menu/products/:productId/availability` (toggles `isAvailable` state or patches branch availability array)
* `DELETE /api/dashboard/menu/products/:id` (soft-deletes product by setting `isActive` to `false`)

## 5. Request Parameters

* **Create Product (`POST /api/dashboard/menu/products`):**
  * `categoryId` (required, string, ObjectId)
  * `catalogItemId` (optional, string, ObjectId)
  * `name` (required, object): `{ ar: string, en: string }`
  * `description` (optional, object): `{ ar: string, en: string }`
  * `key` (optional, string): If empty, auto-generated.
  * `priceHalala` (required, integer)
  * `pricingModel` (required, string, values: `fixed`, `per_100g`)
  * `baseUnitGrams` (optional, integer, default 100)
  * `defaultWeightGrams` (optional, integer)
  * `minWeightGrams` (optional, integer)
  * `maxWeightGrams` (optional, integer)
  * `weightStepGrams` (optional, integer, default 50)
  * `availableFor` (optional, array of strings): `["one_time", "subscription"]`
  * `imageUrl` (optional, string)
  * `isVisible` (optional, boolean)
  * `isAvailable` (optional, boolean)
  * `isCustomizable` (optional, boolean)
  * `ui` (optional, object): `{ cardVariant, cardSize, badge, ctaLabel, imageRatio }`
  * `branchAvailability` / `branchIds` (optional, array of strings)
* **Update Product (`PATCH /api/dashboard/menu/products/:id`):** Same parameters as create.
* **Duplicate Product (`POST /api/dashboard/menu/products/:id/duplicate`):** No body required.
* **Reorder Products (`PATCH /api/dashboard/menu/products/reorder`):**
  * `items` (required, array of objects): `[{ id: string, sortOrder: number }]`

## 6. Response Fields Required

### Product Model Shape (returned in list and writes)
```json
{
  "id": "65b21a1fca7cd69ffb19b8f5",
  "_id": "65b21a1fca7cd69ffb19b8f5",
  "categoryId": "65b219e9ca7cd69ffb19b8ea",
  "catalogItemId": "65b21a02ca7cd69ffb19b8f1",
  "key": "basic_meal",
  "name": {
    "ar": "وجبة أساسية",
    "en": "Basic Meal"
  },
  "description": {
    "ar": "وصف الوجبة",
    "en": "Meal description"
  },
  "imageUrl": "https://example.com/meal.jpg",
  "itemType": "product",
  "pricingModel": "fixed",
  "priceHalala": 4500,
  "baseUnitGrams": 100,
  "defaultWeightGrams": 200,
  "minWeightGrams": 100,
  "maxWeightGrams": 500,
  "weightStepGrams": 50,
  "currency": "SAR",
  "availableFor": ["one_time", "subscription"],
  "isCustomizable": true,
  "isActive": true,
  "isVisible": true,
  "isAvailable": true,
  "sortOrder": 0,
  "ui": {
    "cardVariant": "standard",
    "cardSize": "medium",
    "badge": "Popular",
    "ctaLabel": "Select",
    "imageRatio": "square"
  },
  "branchAvailability": ["branch_1"],
  "versionId": null,
  "publishedAt": null,
  "createdAt": "2026-06-18T12:00:00.000Z",
  "updatedAt": "2026-06-18T12:00:00.000Z"
}
```

### Detail Product Response (`GET /api/dashboard/menu/products/:id`)
```json
{
  "status": true,
  "data": {
    "contractVersion": "dashboard_product_detail.v3",
    "product": {
      "id": "65b21a1fca7cd69ffb19b8f5",
      "_id": "65b21a1fca7cd69ffb19b8f5",
      "categoryId": "65b219e9ca7cd69ffb19b8ea",
      "catalogItemId": "65b21a02ca7cd69ffb19b8f1",
      "key": "basic_meal",
      "name": { "ar": "وجبة أساسية", "en": "Basic Meal" },
      "description": { "ar": "", "en": "" },
      "imageUrl": "",
      "itemType": "product",
      "pricingModel": "fixed",
      "priceHalala": 4500,
      "baseUnitGrams": 100,
      "defaultWeightGrams": 200,
      "minWeightGrams": 100,
      "maxWeightGrams": 500,
      "weightStepGrams": 50,
      "currency": "SAR",
      "availableFor": ["one_time", "subscription"],
      "isCustomizable": true,
      "isActive": true,
      "isVisible": true,
      "isAvailable": true,
      "sortOrder": 0,
      "ui": {
        "cardVariant": "standard",
        "cardSize": "medium",
        "badge": "Popular",
        "ctaLabel": "Select",
        "imageRatio": "square"
      },
      "branchAvailability": [],
      "versionId": null,
      "publishedAt": null,
      "createdAt": "2026-06-18T12:00:00.000Z",
      "updatedAt": "2026-06-18T12:00:00.000Z"
    },
    "category": {
      "id": "65b219e9ca7cd69ffb19b8ea",
      "_id": "65b219e9ca7cd69ffb19b8ea",
      "key": "main_meals",
      "name": { "ar": "وجبات رئيسية", "en": "Main Meals" },
      "isActive": true
    },
    "groupSummary": {
      "linkedGroupCount": 2,
      "composerEndpoint": "/api/dashboard/menu/products/65b21a1fca7cd69ffb19b8f5/composer",
      "linkEndpoint": "/api/dashboard/menu/products/65b21a1fca7cd69ffb19b8f5/option-groups"
    }
  }
}
```

---

## 7. Product Configurations & Behavior Examples

### A. Customizable Product Example: `basic_meal`
* **Customization Status**: `isCustomizable = true`
* **Linked Groups**: `linkedGroupCount = 2` (e.g. Protein Choices, Carbohydrate Choices)
* **Pricing**: `pricingModel = per_100g` (Calculated based on actual grams submitted)
* **Eligibility**: `availableFor = ["one_time", "subscription"]` (Visible and orderable on both store and subscription planners)

### B. Direct / Simple Product Example: `small_salad`
* **Customization Status**: `isCustomizable = false`
* **Linked Groups**: `linkedGroupCount = 0` (No customization option groups linked)
* **Pricing**: `pricingModel = fixed` (Fixed price, e.g. 1500 Halalas)
* **Eligibility**: `availableFor = ["subscription"]` (Exclusively selectable on subscription planners, hidden from one-time storefront)

### C. Specific Key Matching Example: `premium_large_salad`
* **Key**: `premium_large_salad`
* **Customization Status**: `isCustomizable = true`
* **Pricing**: `pricingModel = fixed`
* **Eligibility**: `availableFor = ["subscription"]`

---

## 8. Explicit Frontend / Dashboard Rules

> [!IMPORTANT]
> **Dashboard Implementation Guidelines:**
> 1. **No Customization Guesswork**: Do not infer whether a product is customizable using its name or key. Always read and rely on `isCustomizable`.
> 2. **No Subscription Guesswork**: Do not check category names or keys to decide if a product can be ordered on subscriptions. Always use `availableFor` (e.g. must contain `"subscription"`).
> 3. **No Substring Matching**: Never match `premium_large_salad` or other premium products by partial matches (like `"salad"` or `"premium"`). Always use the exact key equality match against `"premium_large_salad"`.
> 4. **Display Flags Isolation**: Treat `isVisible` and `isAvailable` as completely independent controls in the admin toggles. Modifying one must never auto-toggle or imply a change to the other.

---

## 9. Status
`PASS_WITH_NOTES`
