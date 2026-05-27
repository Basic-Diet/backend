# Dashboard Catalog Changes

This document explains the final dashboard catalog contracts for the admin UI team.

## 1. Generated Keys

Admin should not manually type technical keys anymore.
- Backend generates keys on create.
- Key can be shown read-only.
- Key must not be editable after create.

## 2. Editable Fields

**For Categories:**
- `name`
- `description`
- `imageUrl`
- `sortOrder`
- active/visible/available flags if present
- `ui.cardVariant`

**For Products:**
- `name`
- `description`
- `imageUrl`
- `priceHalala`
- `pricingModel`
- `itemType`
- `availableFor`
- `ui.cardVariant`
- `ui.badge`
- `ui.ctaLabel`
- `ui.imageRatio`

**For Option Groups:**
- `name`
- `description`
- `sortOrder`
- `ui.displayStyle`

**For Options:**
- `name`
- `description`
- `imageUrl`
- `sortOrder`
- `extraPriceHalala` / `extraFeeHalala` where applicable
- `displayCategoryKey` / `proteinFamilyKey` / `premiumKey` only if still exposed for advanced admin use

## 3. Dashboard Dropdown Values

**Category `cardVariant`:**
- `meal_builder`
- `light_collection`
- `sandwich_collection`
- `addon_collection`

**Product `cardVariant`:**
- `standard`
- `premium`
- `large_salad`
- `addon`

**`displayStyle`:**
- `chips`
- `radio_cards`
- `checkbox_grid`
- `dropdown`
- `stepper`

## 4. Product-Option Group Rules

Selection rules belong on `ProductOptionGroup` (the product-group relation), not on the global `MenuOptionGroup`.

**Examples:**
- `basic_meal` protein: min 1 / max 1
- `basic_meal` carb: max 2
- `premium_large_salad` protein: min 1 / max 1
- `premium_large_salad` sauce: min 1 / max 1

## 5. Dashboard Warnings

- Do not use `ui` fields for business logic.
- Do not change generated keys.
- Do not create duplicate option groups when an existing reusable group exists.
- Do not put premium proteins into basic one-time products unless intended and priced.
- Keep `premium_large_salad` linked to all required groups.
