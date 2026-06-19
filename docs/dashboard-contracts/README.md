# Dashboard Backend Contract Pack

Welcome to the Dashboard Backend Contract Pack for the BasicDiet145 admin/operator dashboard. This directory contains API specifications, data expectations, and lifecycle constraints for all dashboard screens.

---

## 1. What This Folder Is
This directory is a **live, tested contract pack** between the BasicDiet145 backend services and the react‑based admin dashboard. It details the exact endpoints, request payloads, response bodies, validation constraints, and operational invariants enforced by the server.

## 2. How the Dashboard Team Should Use It
The dashboard development team can reference each `.md` file in this folder to understand:
* What endpoints to call for lists, detail views, mutations, and status transitions.
* The expected structure of JSON request payloads and server responses.
* The required permissions/roles and validation rules for each input field.
* Critical business logic rules (e.g. VAT computation, daily cutoff times, and branch pickup limits).

## 3. Route Map vs. Ground Truth
* **`DASAHBOARD_SCREEN_AND_ROUTES_MAP.md`**: A frontend-only guide summarizing the React routing structure, TanStack Query hooks, and API routes currently fetched/referenced in the UI code. **It is not the source of truth.**
* **Backend Source of Truth**: The Express routers, Mongoose models, controllers, services, and associated integration tests in this repository represent the **final source of truth** for API signatures and data payloads.
* Mismatches between the UI route map and actual backend endpoints are documented in the overview contract as either `NEEDS_BACKEND_FIX` or `LEGACY_OR_UNCLEAR`.

## 4. Screen Status Classification
Every contract file in this pack is classified using one of the following status tags:
1. **`READY`**: Fully implemented, verified, and backed by comprehensive tests.
2. **`READY_WITH_LIMITATIONS`**: Implemented and functional, but has limited test coverage or specific business assumptions.
3. **`PASS`**: Verified backend implementation matching documented shapes.
4. **`PASS_WITH_NOTES`**: Verified backend implementation matching documented shapes with extra notes/warnings.
5. **`NEEDS_TEST`**: Implemented but requires further verification/testing.
6. **`NOT_REVIEWED_YET / NEEDS_TEST`**: Not yet reviewed or verified.
7. **`NEEDS_BACKEND_FIX`**: Endpoint exists but has bugs or misses key capabilities required by the dashboard.
8. **`LEGACY_OR_UNCLEAR`**: Deprecated or legacy behavior.
9. **`OUT_OF_SCOPE`**: Intentionally excluded from the contract pack.

---

## 5. Critical Backend Rules
All dashboard consumers must adhere to the following core system design invariants enforced by the backend:

### A. VAT and Currency
* All monetary values are handled in **Halalas** (1/100 of Currency, e.g. 1 SAR = 100 Halalas).
* Pricing and VAT behavior must follow backend settings/accounting contracts only.

### B. Unified Branch Pickup & Partial Fulfillment
* **Unified Selection**: The single source of truth for items requested for pickup is the `selectedPickupItemIds` array (containing slots like `"slot_1"` or addons like `"addon_<addonId>_<unit>"`).
* **Fulfillment**: Fulfilling a pickup request consumes **only** the items specified in `selectedPickupItemIds`.
* **No Wallet Refund**: Unselected planned add-ons are **not** refunded to `addonBalance.remainingQty` upon fulfillment. They remain planned on the day and available for future pickup requests.
* **Premium Upgrades**: Premium upgrades are applied to existing meal slots and **never** create extra meal slots or increment the `totalMeals` count.

---

## 6. Menu Catalog System Contracts

### A. Hierarchy Structure
The menu catalog follows a strict hierarchical relationship model:
```
Category ──> Product ──> Product Customization ──> Option Groups ──> Options
```

### B. Node Definitions & Boundaries
1. **Category**:
   * **Role**: Display containers / structural navigation nodes.
   * **Rule**: Categories are purely for grouping/visual display and are **not** sellable items.
2. **Product**:
   * **Role**: The core sellable/menu items.
   * **Rule**: Products are sellable items. They must belong to a single Category.
   * **Direct / Simple Product**:
     * Defined by: `isCustomizable = false` and `linkedGroupCount = 0` (e.g. `small_salad`, `orange_juice`, `water`).
   * **Customizable Product**:
     * Defined by: `isCustomizable = true` (e.g. `basic_meal`, `basic_salad`, `premium_large_salad`). Option groups and options are linked to these products via the composer and group‑linking endpoints.
3. **Option Group**:
   * **Role**: Selection sections or buckets (e.g., "Protein Choices", "Preferences").
   * **Rule**: Option groups are **not** sellable items; they are configuration containers for selectable choices.
4. **Option**:
   * **Role**: Selectable customization choices (e.g. "Extra Chicken", "No Onions").
   * **Rule**: Options are selectable choices, **not** standalone products.

### C. State Flags & Independence
The frontend/dashboard must use and respect the following independent backend fields:
* `isVisible` (boolean): Controls visibility/display to clients.
* `isAvailable` (boolean): Controls whether an item is selectable/orderable by customers.
* `isActive` (boolean): Soft-delete/active state. If `false`, the item is excluded from read models.
* `sortOrder` (number): Order of display.
* `ui` (object): Metadata controlling presentation variants (e.g. `cardVariant`, `layout`, `displayStyle`).
* `availableFor` (array): Flow availability filter (e.g. `["one_time", "subscription"]`).
* `pricingModel` (string): Determines how price is calculated (e.g. `fixed`, `per_100g`).
* `priceHalala` (number): Price of the product in Halalas.
* `isCustomizable` (boolean): Determines if the product requires customization.

> [!IMPORTANT]
> **Independent Flag Mutation Rule:**
> `isVisible`, `isAvailable`, and `isActive` are completely independent flags. Toggling one does not imply or trigger changes to the others. The frontend must treat them as separate, independent controls.

### D. Product Flow & Validation Rules
1. **Customization Flow**:
   * `isCustomizable = false` (Direct/Simple Product): No customization step is required.
   * `isCustomizable = true` (Customizable Product): Customization groups/options must be managed via the composer/link endpoints.
2. **Pricing Flow**:
   * Supported pricing models: `fixed` and `per_100g`.
   * **Rule**: The frontend/dashboard must display and submit pricing strictly based on backend-provided pricing fields. It **must not** invent, calculate, or recalculate pricing contracts locally.
3. **Availability Flow (`availableFor`)**:
   * Supported channels: `["one_time"]`, `["subscription"]`, or `["one_time", "subscription"]`.
   * **Rule**: The frontend must filter flows using this backend-provided field. Do not infer subscription eligibility from category or product names.
4. **Exact-Key Warnings**:
   * `premium_large_salad` must be matched by its exact key `"premium_large_salad"`.
   * **Rule**: Do not match premium salads or other products by substring matches like `"salad"`. Substring matching is highly error-prone and prohibited.

### E. Menu Catalog Contract Status Table

| Document | Verified Status | Purpose / Scope |
| :--- | :--- | :--- |
| [11_MENU_CATALOG.md](11_MENU_CATALOG.md) | **NEEDS_TEST** | Overview/index pointing to detailed sub-contracts. |
| [11A_MENU_CATEGORIES.md](11A_MENU_CATEGORIES.md) | **PASS_WITH_NOTES** | Categories CRUD, reordering, toggling, assignment. |
| [11B_MENU_PRODUCTS.md](11B_MENU_PRODUCTS.md) | **PASS_WITH_NOTES** | Products CRUD, reordering, duplication, toggling. |
| [11C_MENU_PRODUCT_CUSTOMIZATION.md](11C_MENU_PRODUCT_CUSTOMIZATION.md) | **PASS_WITH_COMPATIBILITY_DOCS** | Linking options, composer rules, selection limits. |
| [11D_MENU_OPTION_GROUPS.md](11D_MENU_OPTION_GROUPS.md) | **PASS_WITH_NOTES** | Option Groups CRUD, reordering, UI styles. |
| [11E_MENU_OPTIONS.md](11E_MENU_OPTIONS.md) | **PASS** | Options CRUD, toggling, pricing, fees, and rules. |
| [11F_MENU_PREVIEW_RELEASE.md](11F_MENU_PREVIEW_RELEASE.md) | **PASS_FULL_WITH_PERFORMANCE_NOTE** | Releases, publishing diffs, version rollbacks. |
| [11G_SUBSCRIPTION_PLANNER_UPGRADES_DASHBOARD_README.md](11G_SUBSCRIPTION_PLANNER_UPGRADES_DASHBOARD_README.md) | **BACKEND_FOUNDATION_READY_FOR_DASHBOARD_UI** | Dashboard handoff for the new Subscription Planner Upgrades screen. Covers premium_meal and premium_large_salad admin configuration, confirms these are planner upgrades, not add-ons, and that Flutter keys must remain stable. |
| [MENU_SYSTEM_DASHBOARD_USER_STORIES.md](MENU_SYSTEM_DASHBOARD_USER_STORIES.md) | **READY_FOR_DASHBOARD_HANDOFF** | Full Menu System user stories and source map for the Dashboard team. |

---

## 7. Running Contract Verification
To prove the correctness of these contracts, run the following automated test suites:
```bash
# Run the contract pack integration tests
NODE_ENV=test node tests/dashboardContracts.test.js

# Run the subscription audit dashboard tests
NODE_ENV=test node tests/subscriptionAuditDashboard.test.js

# Run core subscription rules and policies
npm run test:subscriptions

# Run menu-specific contract verification tests
NODE_ENV=test node tests/dashboardMenuProductCenteredContract.test.js
NODE_ENV=test node tests/verify_menu_fixes.test.js
```
