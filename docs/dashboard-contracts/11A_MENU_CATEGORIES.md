# Screen Contract: 11A_MENU_CATEGORIES

## 1. Screen Purpose
Allows administrators to view, create, edit, reorder, and soft-delete categories in the menu catalog. Allows bulk assigning products to a category, and managing category visibility and availability.

## 2. Dashboard Route
`/menu` (Categories tab)

## 3. Visible UI Requirements
* Paginated or full list of categories displaying names, keys, visibility, and availability status.
* Create and Edit Category forms/dialogs.
* Reorder handler (drag-and-drop).
* Visibility & Availability toggles.
* Product assignment grid.

## 4. Backend Endpoints
* `GET /api/dashboard/menu/categories` (lists categories, optional pagination query)
* `POST /api/dashboard/menu/categories` (creates a category)
* `GET /api/dashboard/menu/categories/:id` (gets category details with assignment context)
* `PATCH /api/dashboard/menu/categories/:id` (updates category fields)
* `PATCH /api/dashboard/menu/categories/reorder` (reorders category sortOrder)
* `PATCH /api/dashboard/menu/categories/:id/visibility` (toggles `isVisible` state)
* `PATCH /api/dashboard/menu/categories/:id/availability` (toggles `isAvailable` state)
* `POST /api/dashboard/menu/categories/:id/products` (bulk assigns products to a category)
* `DELETE /api/dashboard/menu/categories/:id` (soft-deletes category)

## 5. Request Parameters

* **Create Category (`POST /api/dashboard/menu/categories`):**
  * `name` (required, object): `{ ar: string, en: string }`
  * `description` (optional, object): `{ ar: string, en: string }`
  * `key` (optional, string): Unique identifier. If empty, automatically generated.
  * `imageUrl` (optional, string)
  * `isVisible` (optional, boolean)
  * `isAvailable` (optional, boolean)
  * `sortOrder` (optional, number)
  * `ui` (optional, object): `{ cardVariant, layout, behaviorHint, priceLabelMode }`
  * `branchIds` (optional, array of strings): Assigned branches for availability.
* **Update Category (`PATCH /api/dashboard/menu/categories/:id`):** Same parameters as create.
* **Reorder Categories (`PATCH /api/dashboard/menu/categories/reorder`):**
  * `items` (required, array of objects): `[{ id: string, sortOrder: number }]`
* **Bulk Assign Products (`POST /api/dashboard/menu/categories/:id/products`):**
  * `productIds` (required, array of strings/ObjectIds)
* **Update Visibility (`PATCH /api/dashboard/menu/categories/:id/visibility`):**
  * `isVisible` (required, boolean)
* **Update Availability (`PATCH /api/dashboard/menu/categories/:id/availability`):**
  * `isAvailable` (required, boolean)

## 6. Response Fields Required

### Category Model Shape (returned in list and writes)
```json
{
  "id": "65b219e9ca7cd69ffb19b8ea",
  "_id": "65b219e9ca7cd69ffb19b8ea",
  "key": "main_meals",
  "name": {
    "ar": "وجبات رئيسية",
    "en": "Main Meals"
  },
  "description": {
    "ar": "وصف الوجبات الرئيسية",
    "en": "Main meals description"
  },
  "imageUrl": "https://example.com/image.jpg",
  "isActive": true,
  "isVisible": true,
  "isAvailable": true,
  "sortOrder": 0,
  "ui": {
    "cardVariant": "addon_collection",
    "layout": "grid"
  },
  "availability": {
    "branchIds": ["branch_1"]
  },
  "publishedAt": null,
  "createdAt": "2026-06-18T12:00:00.000Z",
  "updatedAt": "2026-06-18T12:00:00.000Z"
}
```

### Detail Category Response (`GET /api/dashboard/menu/categories/:id`)
```json
{
  "status": true,
  "data": {
    "contractVersion": "dashboard_category_detail.v3",
    "category": {
      "id": "65b219e9ca7cd69ffb19b8ea",
      "_id": "65b219e9ca7cd69ffb19b8ea",
      "key": "main_meals",
      "name": { "ar": "وجبات رئيسية", "en": "Main Meals" },
      "description": { "ar": "", "en": "" },
      "imageUrl": "",
      "isActive": true,
      "isVisible": true,
      "isAvailable": true,
      "sortOrder": 0,
      "ui": {
        "cardVariant": "addon_collection"
      },
      "availability": {
        "branchIds": []
      },
      "publishedAt": null,
      "createdAt": "2026-06-18T12:00:00.000Z",
      "updatedAt": "2026-06-18T12:00:00.000Z"
    },
    "products": [
      {
        "id": "65b21a1fca7cd69ffb19b8f5",
        "_id": "65b21a1fca7cd69ffb19b8f5",
        "categoryId": "65b219e9ca7cd69ffb19b8ea",
        "key": "basic_meal",
        "name": { "ar": "وجبة دجاج أساسية", "en": "Basic Chicken Meal" },
        "isCustomizable": true,
        "pricingModel": "fixed",
        "priceHalala": 4500
      }
    ],
    "assignment": {
      "relationOwner": "product.categoryId",
      "bulkAssignmentEndpoint": "/api/dashboard/menu/categories/65b219e9ca7cd69ffb19b8ea/products"
    },
    "actions": {
      "canBulkAssignProducts": true,
      "canReorderProducts": true
    }
  }
}
```

---

## 7. Status
`PASS_WITH_NOTES`

> [!NOTE]
> **Notes & Verification Flags:**
> * The extra fields (`ui`, `availability`, `products`, `assignment`, and `actions`) are fully supported by the current backend read model and must be consumed by the UI team.
> * **Validation Note:** The category availability toggle endpoint (`PATCH /api/dashboard/menu/categories/:id/availability`) currently returns `200 OK` even if the request payload body does not specify `isAvailable` (which soft-defaults to the existing setting or defaults to true). Ideally, a missing or invalid boolean payload should be rejected with a `400 Bad Request`. Do not change this behavior; it is documented as a known notes limitation.
