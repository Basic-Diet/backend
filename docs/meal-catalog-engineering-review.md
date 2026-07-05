# Meal / Catalog Engineering Review

## A. Verdict
**PASS WITH RISKS**

The core domain architecture in the backend is structurally sound. Add-ons, premium upgrades, and meals are correctly isolated. The recent contract hardening successfully removed unsafe implicit inferences (such as the zero-option-group bug) and established a strict, explicit publication gate (`publishedAt`).

The remaining risk is legacy hardcoding of `sandwich` and `cold_sandwiches` keys in `CatalogService.js` to build legacy visual payloads (`builderCatalogV2`). While the canonical v3 planner handles dynamic `full_meal_product` cleanly, the v2 payload generation remains coupled to specific category keys.

## B. Scope
**Paths / Files Reviewed**:
- `src/models/`: `MenuProduct`, `MenuCategory`, `MenuOption`, `Addon`, `SubscriptionDay`, `MealBuilderConfig`, `PremiumUpgradeConfig`
- `src/services/subscription/`: `canonicalMealSlotPlannerService.js`, `mealSlotPlannerService.js`, `mealBuilderConfigService.js`
- `src/services/catalog/`: `CatalogService.js`
- `src/routes/`: `subscriptions.js`
- `src/config/`: `mealPlannerContract.js`

**Areas Audited**:
- Meal Builder v3 and v2 contract generation
- SubscriptionDay canonical meal slots architecture
- Add-on and Premium Upgrade state isolation
- Dashboard category/product publication logic

## C. Domain Model Summary
The intended domain split is correctly modeled and enforced in the database schema:

- **Standard Meals**: Fulfillable items requiring a base meal (protein + carbs). Represented by `selectionType: "standard_meal"` and `requiresBuilder: true`.
- **Full-Meal Products / Standalone**: Single items that consume exactly one meal slot entirely. Represented by `selectionType: "full_meal_product"` or `"sandwich"`, with `requiresBuilder: false` and `treatAsFullMeal: true`.
- **Premium Meals**: Slot-level upgrades. Modeled strictly inside the meal slot via `isPremium: true`, `premiumSource`, and `premiumExtraFeeHalala`. They do not leak into general add-on carts.
- **Add-ons**: Completely independent of the meal planner. Modeled via a separate `addonSelections` array on the `SubscriptionDay`. Controlled by `billingMode` (`flat_once`, `per_day`, `per_meal`). Add-ons **never** consume meal slots.
- **One-time vs Subscription**: Controlled explicitly via the `availableFor` array field (`["one_time", "subscription"]`) at the product/option level.
- **Builder-Required vs Standalone**: Governed strictly by `selectionType` and explicit `action.requiresBuilder` flags, rather than visual inference.

## D. Findings Table

| ID | Area | Severity | File | Finding | Why it matters | Required action |
|---|---|---|---|---|---|---|
| 1 | Publication State | P0_BLOCKER | `menuCatalogAdminService.js` | Dashboard created active products with `publishedAt: null`, causing them to fail builder checks. | Active products were mysteriously invisible to customers. | **FIXED** (Auto-set `publishedAt` on `isActive=true` creation). |
| 2 | Builder Contract | P0_BLOCKER | `mealBuilderConfigService.js` | Zero-option-group products were implicitly marked as standalone full meals. | Masked configuration errors and bypassed builder rules for standard meals. | **FIXED** (Removed zero-option inference; strictly rely on `selectionType`). |
| 3 | Legacy Catalog | P2_RECOMMENDED | `CatalogService.js` | Hardcodes `cold_sandwiches` and `sandwich` keys to construct the legacy `sandwiches` array in `builderCatalogV2`. | Prevents clean injection of new full-meal categories (e.g., Pasta, Wraps) into the V2 payload without modifying backend code. | Refactor V2 payload generation to map any category containing `full_meal_product` items instead of exact key matching. |
| 4 | Option Groups | P1_REQUIRED | `mealBuilderConfigService.js` | Option-less groups were invisible to the builder validation resolver. | Caused false validation errors for valid, newly linked groups. | **FIXED** (Merged group relation IDs during doc resolution). |

## E. Backend Fixes Applied
The critical backend issues were resolved during the hardening pass:
1. **`menuCatalogAdminService.js`**: Modified `createProduct` and `createCategory` to automatically populate `publishedAt` if `isActive` is true, reflecting the true domain rule that `publishedAt` is the customer-visibility gate.
2. **`mealBuilderConfigService.js`**:
   - Refactored `buildProductItem()` to derive `effectivelyStandalone` exclusively from `isStandaloneMeal` (`selectionType === "sandwich" || "full_meal_product"`).
   - Fixed `resolveDocsForSections()` to load option-less groups via `ProductOptionGroup` linkages, preventing validation failures.
3. **`scripts/repairMealBuilderProducts.js`**: Rewritten with strict safety gates (`--apply`, dry-run by default) to fix historical `publishedAt` null states without risking destructive data mutation.

*(No further backend logic changes were required in this specific audit step, as the core domain invariants are successfully maintained by the recent hardening).*

## F. Contract Verification
- **Menu/Catalog Publication**: Verified. `isActive=true` + `publishedAt=<Date>` is the definitive visibility contract.
- **Subscription Menu Contract**: Verified. `canonicalMealSlotPlannerService.js` explicitly defines `SELECTION_TYPE_PRODUCT_RULES` ensuring only valid products populate valid slot types.
- **Add-on Separation**: Verified. `addonSelections` and `mealSlots` are distinct arrays on `SubscriptionDay`. Add-ons do not decrement `mealsPerDayLimit`.
- **Premium Separation**: Verified. Premium costs are tracked via `premiumExtraFeeHalala` within the specific `mealSlot`. Upgrades consume from `premiumBalance` safely.
- **Full-Meal Product Behavior**: Verified. `FULL_MEAL_PRODUCT` correctly counts as exactly 1 slot towards `completeSlotCount`.
- **Dashboard-Created Products**: Verified. Products created via dashboard with `selectionType: full_meal_product` will automatically act as standalone meals in the V3 planner without hardcoding.
- **Category/Section Dynamic Support**: The V3 canonical contract (`meal_planner_menu.v3`) supports dynamic categories. However, the legacy V2 payload (`builderCatalogV2`) still relies on hardcoded string keys (see Finding 3).

## G. Tests / Verification
All targeted regression and contract tests pass:
```bash
node tests/mealPlannerFullMealProductContract.test.js
node tests/dashboardMealBuilderDefaultTemplate.test.js
npm test
```
**Results**: 64/64 tests passed. Anti-regression test confirms `standard_meal` products with zero options correctly trigger `requiresBuilder: true`.

## H. Runtime / Seed / Data Notes
- **Data Issue**: Many legacy products may still have `publishedAt: null`.
- **Action Required**: The repair script must be executed on the Railway production environment to synchronize the legacy data with the hardened contract.
  1. `node scripts/repairMealBuilderProducts.js` (Verify dry-run)
  2. `node scripts/repairMealBuilderProducts.js --apply` (Commit fixes)

## I. Frontend / Dashboard / Mobile Follow-up
- **App/Repo**: Mobile Flutter Application
- **Issue**: The frontend should ensure it relies on the `action.requiresBuilder` (boolean) and `action.type` (`"direct_add"` vs `"open_builder"`) flags provided in the V3 catalog response to determine navigation behavior.
- **Action**: Do NOT rely on string-matching category keys (like `"sandwich"`) to determine if a product skips the meal builder. Rely strictly on the explicit contract flags.

## J. Final Recommendation
- **Is backend ready?** Yes, the core logic is structurally sound and hardened.
- **Is the catalog/meal cycle architecturally correct?** Yes, the shift from implicit structure (zero-options) to explicit state (`selectionType`) solidifies the architecture.
- **Are add-ons and premium meals isolated correctly?** Yes, there is no leakage between `mealSlots`, `premiumUpgradeSelections`, and `addonSelections`.
- **Can new full-meal categories work dynamically?** Yes, under the V3 canonical planner contract. (V2 payload relies on legacy keys, but V3 is fully dynamic).
- **Next Exact Step**: Execute the `repairMealBuilderProducts.js` script on the production database, and notify the Flutter team to verify their navigation logic utilizes the `action` flags.
