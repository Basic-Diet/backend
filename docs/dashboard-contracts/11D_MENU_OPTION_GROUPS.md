# Screen Contract: 11D_MENU_OPTION_GROUPS

## 1. Screen Purpose
Provides CRUD operations, reordering, and visibility/availability controls for global option groups (the reusable library items).

## 2. Dashboard Route
`/menu/option-groups`

## 3. Visible UI Requirements
* List of option groups displaying names, keys, visibility, and availability status.
* Create/Edit Option Group forms.
* Option assignment panel (links global options to this group).
* Reorder handler.

## 4. Backend Endpoints
* `GET /api/dashboard/menu/option-groups` (lists option groups)
* `POST /api/dashboard/menu/option-groups` (creates a global option group)
* `PATCH /api/dashboard/menu/option-groups/reorder` (reorders option groups sortOrder)
* `GET /api/dashboard/menu/option-groups/:groupId/options` (lists all options belonging to the group)
* `POST /api/dashboard/menu/option-groups/:groupId/options` (creates/assigns option for group)
* `GET /api/dashboard/menu/option-groups/:id` (gets option group detail)
* `PATCH /api/dashboard/menu/option-groups/:id` (updates option group fields)
* `PATCH /api/dashboard/menu/option-groups/:id/visibility` (toggles isVisible)
* `PATCH /api/dashboard/menu/option-groups/:id/availability` (toggles isAvailable)
* `DELETE /api/dashboard/menu/option-groups/:id` (soft-deletes option group)

## 5. Request Parameters
* **Create Option Group (`POST /api/dashboard/menu/option-groups`):**
  * `name` (required, object): `{ ar: string, en: string }`
  * `key` (optional, string): If empty, auto-generated.
  * `description` (optional, object): `{ ar: string, en: string }`
  * `isVisible` (optional, boolean)
  * `isAvailable` (optional, boolean)
  * `ui` (optional, object): `{ displayStyle }` where `displayStyle` is one of `chips`, `radio_cards`, `checkbox_grid`, `dropdown`, `stepper`.
* **Update Option Group (`PATCH /api/dashboard/menu/option-groups/:id`):** Same parameters as create.
* **Reorder Option Groups (`PATCH /api/dashboard/menu/option-groups/reorder`):**
  * `items` (required, array of objects): `[{ id: string, sortOrder: number }]`

## 6. Response Fields Required
Every returned option group in lists or detail views includes:
```json
{
  "id": "65b21a8dca7cd69ffb19b90a",
  "_id": "65b21a8dca7cd69ffb19b90a",
  "key": "protein_options",
  "name": {
    "ar": "خيارات البروتين",
    "en": "Protein Options"
  },
  "description": {
    "ar": "اختر البروتين المفضل لديك",
    "en": "Select your preferred protein"
  },
  "isVisible": true,
  "isAvailable": true,
  "isActive": true,
  "sortOrder": 0,
  "ui": {
    "displayStyle": "chips"
  },
  "publishedAt": null,
  "createdAt": "2026-06-18T12:00:00.000Z",
  "updatedAt": "2026-06-18T12:00:00.000Z"
}
```

---

## 7. Status
`PASS_WITH_NOTES`

> [!NOTE]
> **Notes & Verification Flags:**
> * `ui.displayStyle` is fully supported by the backend model and must be consumed by the UI/Dashboard where needed to control the selector component rendering style (e.g. chips, radio cards, or grids).
