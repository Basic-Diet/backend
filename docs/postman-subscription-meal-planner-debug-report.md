# Postman Subscription Meal Planner Debug Report

## A. Verdict

**FLUTTER_ISSUE_REPORT_ONLY**

The backend is returning the newly dashboard-created items correctly under the exact expected V3 canonical contract format (`selectionType: full_meal_product`, `requiresBuilder: false`, `treatAsFullMeal: true`). 
However, the Flutter client is still attempting to map V2 legacy fields (such as `sandwiches`, `proteins`, `carbs` lists at the root of the builder catalog) instead of parsing the dynamic `sections` array introduced in V3. 

Since the rule is "Do not modify Flutter," no Flutter code has been altered.

## B. Generated Artifacts

- **Postman Collection**: `postman/BasicDiet_Subscription_MealPlanner_Debug.postman_collection.json`
- **Postman Environment**: `postman/BasicDiet_Railway_Environment.postman_environment.json`
- **curl Debug Script**: `scripts/audits/debugMealPlannerRuntime.sh`
- **Raw JSON Responses**: `/home/hema/Projects/basicdiet145/tmp/meal-planner-debug/` (Contains: `health.json`, `meal-planner-menu.json`, `subscriptions-menu.json`, `orders-menu.json`, `categories-with-meals.txt`)
- **Extraction Tool**: `/home/hema/Projects/basicdiet145/tmp/meal-planner-debug/extract-keys.js` (Used to search the payload for product targets dynamically)

## C. Runtime Endpoint Results

| Request | Status | Result | Notes |
|---|---|---|---|
| `/health` | 200 OK | Success | Database is `up`. |
| `/api/subscriptions/meal-planner-menu` | 200 OK | Success | Returns the canonical `meal_planner_menu.v3` contract. Contains the `sections` array with dynamic item categories like `full_meal_product`, `sandwich`, `chicken`, etc. |
| `/api/subscriptions/menu` | 200 OK | Success | Contains the same catalog structure, nested under `plannerCatalog.sections`. |
| `/api/orders/menu` | 200 OK | Success | Separate structure for standard orders. |
| `/api/categories-with-meals` | 200 OK | Legacy Mode | Endpoint is still active but is deprecated. The collection uses it only for legacy audit. |

## D. Target Product/Category Search

- **Found in meal-planner-menu**: **Yes**
- **Found in subscriptions-menu**: **Yes**
- **Matching Object Summary**:
  The new dashboard items are correctly listed inside the `sections` array (specifically under the `full_meal_product` and `sandwich` sections).
  For example, `moussaka_with_minced_meat` and `lasagna_with_minced_meat` appear in the `full_meal_product` section.
  
  Their canonical representation correctly flags them for direct selection:
  ```json
  "selectionType": "full_meal_product",
  "action": {
    "type": "direct_add",
    "requiresBuilder": false,
    "treatAsFullMeal": true
  }
  ```

## E. Backend Diagnosis

- **Item missing from backend payload**: **No.**
- **Diagnosis**: The backend successfully injects dashboard-created products with `selectionType: "full_meal_product"` and proper action parameters (`treatAsFullMeal: true`, `requiresBuilder: false`) directly into the dynamic `sections` list.
- **Backend Fix Required**: None. The backend serves the canonical `meal_planner_menu.v3` format accurately.

## F. Flutter Diagnosis

- **Endpoint used by Flutter**: `/api/subscriptions/meal-planner-menu` (mapped to `getMealPlannerMenu()` inside `app_api.dart`).
- **Mapper/Model Issues**: 
  - Flutter's `BuilderCatalogResponse` model hardcodes legacy mapping properties: `@JsonKey(name: 'sandwiches') final List<BuilderSandwichResponse>? sandwiches;`
  - Flutter iterates over `state.menu.builderCatalog.sandwiches` (e.g., in `protein_picker_sheet.dart` and `meal_planner_bloc.dart`).
- **Why Items Don't Appear**: The V3 canonical response groups items into a root `sections` list (e.g., `section:full_meal_product`, `section:sandwich`, `section:chicken`). Because Flutter still looks for a standalone `"sandwiches"` or `"proteins"` array at the root of `builderCatalog`, those properties come back `null` or empty, resulting in missing dashboard products in the mobile planner.
- **Required Flutter Change**: 
  - Update `BuilderCatalogResponse` and `BuilderCatalogModel` to expect the V3 `sections` list.
  - Refactor `meal_planner_bloc.dart` and the UI (like `protein_picker_sheet.dart`) to dynamically loop over the `sections` array and map items based on `item.selectionType` and `item.action`, instead of conditionally handling hardcoded arrays like `menu.builderCatalog.sandwiches`.
- **No Flutter code was modified.**

## G. Tests / Validation

- **Postman collection generated/import-ready**: **Yes** (Contains all the necessary search scripts and assertions).
- **curl debug script run**: **Yes**
- **Backend tests if code changed**: Not applicable (No backend change needed).
- **Flutter read-only audit run**: **Yes** (Identified `BuilderCatalogResponse` schema mismatch).

## H. Final Recommendation

- **Can I test this in Postman now?**: **Yes**. Import the Environment and Collection in the `/postman` folder.
- **Backend responsible?**: **No**.
- **Flutter responsible?**: **Yes**.
- **Dashboard config responsible?**: **No**.
- **Exact next action**: Assign the Flutter developer to update the `MealPlannerMenuResponse` parser and `meal_planner_bloc.dart` to support the V3 `sections` list contract, removing hardcoded logic for `.sandwiches` or `.proteins` arrays.
