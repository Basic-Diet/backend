# Dashboard Added Products Meal Builder Publish Fix

## Root Cause Analysis
The `MEAL_BUILDER_PRODUCT_UNPUBLISHED` error was triggered because new categories and products added via the dashboard were saved with `publishedAt: null`. Since the dashboard UI lacked an automatic "Publish" step upon creation, the core `MealBuilderConfig` validation correctly rejected these products as "not ready".

Furthermore, the backend heavily relied on the section `selectionType` (`sandwich` or `full_meal_product`) to identify full standalone meals. When the admin created a new section in the Meal Builder draft, it defaulted to `standard_meal`, signaling the backend to expect option groups (builder flow). Because the new meals (e.g., pasta, breakfast) had no option groups, the backend marked them as `requiresBuilder: true` which broke the meal selection UI.

**Identified Root Cause Code**: `DASHBOARD_PRODUCT_CREATED_BUT_NOT_PUBLISHED` & `MISSING_FULL_MEAL_FLAGS`

## Backend Contract Fixes
1. **Dynamic Full Meal Inference**:
   In `src/services/subscription/mealBuilderConfigService.js`, the `buildProductItem` logic was updated:
   ```javascript
   const effectivelyStandalone = isStandaloneMeal || (optionGroups.length === 0 && !isPremiumSalad);
   ```
   This ensures that any product lacking option groups is treated dynamically as `treatAsFullMeal: true` and `requiresBuilder: false`, regardless of its containing section's `selectionType` or hardcoded sandwich references.
2. **Dashboard Auto-Publishing**:
   In `src/services/orders/menuCatalogAdminService.js`, the entity creation methods (`createProduct`, `createCategory`, etc.) were updated to automatically assign `publishedAt: new Date()` if `isActive` is set to true.

## Recovery Script
A recovery script `scripts/repairMealBuilderProducts.js` was introduced to fix existing runtime configurations. It:
1. Iterates over active, unpublished products and categories, backfilling `publishedAt` to the current timestamp.
2. Scans active `MealBuilderConfig` drafts and published configurations. Any `standard_meal` section whose products contain zero option groups is automatically migrated to the `full_meal_product` selection type.
