# Screen Contract: 11E_MENU_OPTIONS

## 1. Screen Purpose
Provides CRUD operations, toggling, reordering, and visibility/availability controls for global options (e.g. specific ingredients/sides).

## 2. Dashboard Route
`/menu/options`

## 3. Visible UI Requirements
* List of options with filter by group, displaying name, key, extra price, visibility, availability, and active status.
* Create/Edit Option forms.
* Active status toggle button.

## 4. Backend Endpoints
* `GET /api/dashboard/menu/options` (lists options, optional query filters like `groupId` or `search`/`q`)
* `POST /api/dashboard/menu/options` (creates a global option)
* `PATCH /api/dashboard/menu/options/reorder` (reorders options sortOrder)
* `GET /api/dashboard/menu/options/:id` (gets option detail)
* `PATCH /api/dashboard/menu/options/:id` (updates option fields)
* `PATCH /api/dashboard/menu/options/:id/visibility` (toggles `isVisible` state)
* `PATCH /api/dashboard/menu/options/:id/availability` (toggles `isAvailable` state)
* `DELETE /api/dashboard/menu/options/:id` (soft-deletes option by setting `isActive` to `false`)
* `PATCH /api/dashboard/menu/options/:id/toggle` (toggles option `isActive` state)

## 5. Request Parameters
* **Create Option (`POST /api/dashboard/menu/options`):**
  * `groupId` (required, string, ObjectId): Parent group ID.
  * `catalogItemId` (optional, string, ObjectId)
  * `name` (required, object): `{ ar: string, en: string }`
  * `description` (optional, object): `{ ar: string, en: string }`
  * `key` (optional, string): If empty, auto-generated.
  * `extraPriceHalala` (optional, integer, default 0)
  * `extraWeightUnitGrams` (optional, integer, default 0)
  * `extraWeightPriceHalala` (optional, integer, default 0)
  * `imageUrl` (optional, string)
  * `availableFor` (optional, array of strings): `["one_time", "subscription"]`
  * `availableForSubscription` (optional, boolean, default true)
  * `nutrition` (optional, object): `{ calories, proteinGrams, carbGrams, fatGrams }`
  * `proteinFamilyKey` (optional, string)
  * `displayCategoryKey` (optional, string)
  * `premiumKey` (optional, string)
  * `ruleTags` (optional, array of strings)
  * `selectionType` (optional, string)
  * `extraFeeHalala` (optional, integer)
  * `isVisible` (optional, boolean)
  * `isAvailable` (optional, boolean)
  * `sortOrder` (optional, number)
* **Update Option (`PATCH /api/dashboard/menu/options/:id`):** Same parameters as create.
* **Reorder Options (`PATCH /api/dashboard/menu/options/reorder`):**
  * `items` (required, array of objects): `[{ id: string, sortOrder: number }]`

## 6. Response Fields Required
Option response objects must match the following serialized schema:
```json
{
  "id": "65b21ad9ca7cd69ffb19b91c",
  "_id": "65b21ad9ca7cd69ffb19b91c",
  "groupId": "65b21a8dca7cd69ffb19b90a",
  "catalogItemId": null,
  "key": "extra_chicken",
  "name": {
    "ar": "دجاج إضافي",
    "en": "Extra Chicken"
  },
  "description": {
    "ar": "إضافة ٥٠ جرام بروتين دجاج",
    "en": "Add 50g chicken protein"
  },
  "imageUrl": "https://example.com/extra-chicken.jpg",
  "extraPriceHalala": 1000,
  "extraWeightUnitGrams": 50,
  "extraWeightPriceHalala": 1000,
  "currency": "SAR",
  "availableFor": ["one_time", "subscription"],
  "availableForSubscription": true,
  "nutrition": {
    "calories": 110,
    "proteinGrams": 15,
    "carbGrams": 0,
    "fatGrams": 3
  },
  "proteinFamilyKey": "chicken",
  "displayCategoryKey": "proteins",
  "premiumKey": "chicken_extra",
  "ruleTags": ["extra_protein"],
  "selectionType": "protein",
  "extraFeeHalala": 1000,
  "isVisible": true,
  "isAvailable": true,
  "isActive": true,
  "sortOrder": 0,
  "publishedAt": null,
  "createdAt": "2026-06-18T12:00:00.000Z",
  "updatedAt": "2026-06-18T12:00:00.000Z"
}
```

---

## 7. Explicit Business Rules

> [!IMPORTANT]
> **Key Option Properties & Rules:**
> 1. **`extraFeeHalala` Invariant**: `extraFeeHalala` must mirror the effective extra fee used by dashboard read models. If not explicitly specified on write, the backend defaults/mirrors it to `extraPriceHalala`.
> 2. **Flag Independence**: `isVisible` (visibility on public apps), `isAvailable` (orderability), and `isActive` (soft-deletion) are completely independent flags. Updating one must not change or affect the others.
