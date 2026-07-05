# Canonical Meal Catalog Contract Cleanup Report

## Executive Summary
This document summarizes the engineering review and hardening performed on the BasicDiet catalog contract. The primary objective was to enforce the modern V3 contract as the singular source of truth, deprecate legacy endpoints, and remove hardcoded logic to ensure a robust, dynamic, and future-proof meal publishing flow.

## 1. Deprecation of Legacy Endpoints
The legacy `/api/categories-with-meals` endpoint has been fully deprecated.
- **Change:** The endpoint now returns an explicit HTTP `410 Gone` status with an `ENDPOINT_DEPRECATED` error code.
- **Impact:** This fail-fast approach prevents older clients or new integrations from silently falling back to deprecated schemas. Consumers must migrate to the modern `/api/subscriptions/meal-planner-menu` endpoint.

## 2. Enforcing V3 as the Canonical Contract
The system was refactored to disable the V2 builder catalog payload by default.
- **Change:** The `includeV2` flag now defaults to `false` in `mealPlannerCatalogService.js` and `CatalogService.js`.
- **Impact:** The backend only returns the V3 payload by default. The V2 payload is exclusively generated when consumers explicitly provide the `includeLegacy=true` or `version=v2` query parameter, drastically reducing the payload size and isolating legacy code paths.

## 3. Removal of Hardcoded Category Dependencies
Legacy catalog generation relied on hardcoded `cold_sandwiches` category keys and magic strings to build the "standalone meals" array.
- **Change:** The generation logic in `CatalogService.js` and `mealBuilderConfigService.js` was rewritten to dynamically query `MenuProduct` using `itemType: { $in: ["cold_sandwich", "full_meal_product"] }`. The `MealBuilder` configuration service now handles these explicitly as `product_list` sections rather than requiring a dedicated `cold_sandwiches` database category.
- **Impact:** Administrators can now safely create full-meal standalone products from the dashboard (classifying them via item type) without worrying about hidden system failures or zero-option-group errors.

## 4. Test Verification
All contract validation suites have passed successfully.
- `tests/mealPlannerFullMealProductContract.test.js` confirms that dashboard-created items with explicit classification pass without errors.
- `tests/dashboardMealBuilderDefaultTemplate.test.js` confirms that the default `mealBuilder` configurations execute perfectly against dynamic classifications without legacy category lookups.

## Action Items & Mobile Team Advisory
- **Mobile Migration:** The Flutter mobile team must ensure any remaining dependencies on `/api/categories-with-meals` are migrated immediately to avoid production breakages from the `410 Gone` responses.
- **V2 Gating:** Legacy mobile versions (if any remain) should continue to append `includeLegacy=true` to the planner menu requests until those client builds are fully retired.
