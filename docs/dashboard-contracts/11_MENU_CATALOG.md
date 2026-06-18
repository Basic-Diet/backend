# Screen Contract: 11_MENU_CATALOG

## 1. Catalog Purpose
Provides an entry point and overview for the restaurant's menu catalog management. It is designed to manage the categories, products, option groups, and options, draft draft previews, and execute published catalog releases.

## 2. Dashboard Route
`/menu?tab=catalog`

## 3. Sub-Contracts & Component Indexes
The menu catalog system is divided into modular sub-contracts. The frontend should refer to these files for detailed endpoints, request payloads, and response structures:

* **[11A_MENU_CATEGORIES.md](file:///home/hema/Projects/basicdiet145/docs/dashboard-contracts/11A_MENU_CATEGORIES.md)**: Categories CRUD, visibility and availability toggling, product assignment.
* **[11B_MENU_PRODUCTS.md](file:///home/hema/Projects/basicdiet145/docs/dashboard-contracts/11B_MENU_PRODUCTS.md)**: Products CRUD, visibility and availability toggling, duplication, product lists, and detail serialization.
* **[11C_MENU_PRODUCT_CUSTOMIZATION.md](file:///home/hema/Projects/basicdiet145/docs/dashboard-contracts/11C_MENU_PRODUCT_CUSTOMIZATION.md)**: Product customization rules, selection ranges, linking option groups to products, and product composer configurations.
* **[11D_MENU_OPTION_GROUPS.md](file:///home/hema/Projects/basicdiet145/docs/dashboard-contracts/11D_MENU_OPTION_GROUPS.md)**: Reusable global option groups, styling configurations (`ui.displayStyle`), lists, and details.
* **[11E_MENU_OPTIONS.md](file:///home/hema/Projects/basicdiet145/docs/dashboard-contracts/11E_MENU_OPTIONS.md)**: Individual customizable items, prices/fees (inclusive of VAT), nutritional details, and rule tags.
* **[11F_MENU_PREVIEW_RELEASE.md](file:///home/hema/Projects/basicdiet145/docs/dashboard-contracts/11F_MENU_PREVIEW_RELEASE.md)**: Catalog publishing, diffing changes between draft and live, menu version lists, and rollbacks.

## 4. Current Status
`NEEDS_TEST`

> [!NOTE]
> Catalog-level preview, publish, diff, and rollback flows are implemented in the backend but require separate automated test verification and validation under full End-to-End simulation.
