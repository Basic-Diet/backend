# Backend Full E2E QA Report

## 1. Environment
- Base URL: https://basicdiet145.onrender.com
- Date/time: 2026-05-31T04:20:02.654Z
- Tokens provided: client=yes, dashboard=yes
- Write mode enabled: yes
- Order create enabled: yes
- Dashboard write enabled: yes

## 2. Executive Summary
- Decision: **Conditionally Ready**
- PASS / FAIL / WARN / SKIP: 52 / 0 / 1 / 2
- Critical blockers: 0
- High-risk issues: 0
- Non-blocking warnings: 23

## 3. PASS / FAIL / WARN / SKIP Matrix
| Area | Endpoint | Scenario | Result | Status Code | Error Code | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Public availability | /health | GET /health exists | PASS | 200 |  |  |
| Public availability | /api/orders/menu?lang=ar | One-time menu responds in ar | PASS | 200 |  |  |
| Public availability | /api/orders/menu?lang=en | One-time menu responds in en | PASS | 200 |  |  |
| One-time menu contract | /api/orders/menu?lang=ar | Published categories array exists | PASS | 200 |  |  |
| One-time menu contract | /api/orders/menu?lang=ar | Menu metadata and selection rules inspected | PASS | 200 |  | 5 categories, 13 products. |
| One-time quote cycle | /api/orders/quote | branchId main | PASS | 200 |  |  |
| One-time quote cycle | /api/orders/quote | missing branch defaults to main | PASS | 200 |  |  |
| One-time quote cycle | /api/orders/quote | missing pickupWindow uses ASAP | PASS | 200 |  |  |
| One-time quote cycle | /api/orders/quote | simple fixed product | PASS | 200 |  |  |
| One-time quote cycle | /api/orders/quote | configurable product | PASS | 200 |  |  |
| One-time quote cycle | /api/orders/quote | per_100g product with weight | PASS | 200 |  |  |
| One-time quote cycle | /api/orders/quote | invalid branchId | PASS | 400 | INVALID_BRANCH | Expected INVALID_BRANCH; Invalid branch ID |
| One-time quote cycle | /api/orders/quote | invalid pickupWindow | PASS | 400 | INVALID_DELIVERY_WINDOW | Expected INVALID_DELIVERY_WINDOW; Invalid pickup window |
| One-time quote cycle | /api/orders/quote | empty items | PASS | 400 | EMPTY_ORDER | Expected EMPTY_ORDER; Order must include at least one item |
| One-time quote cycle | /api/orders/quote | invalid productId | PASS | 404 | ITEM_NOT_FOUND | Expected ITEM_NOT_FOUND/PRODUCT_NOT_AVAILABLE; Product was not found |
| One-time quote cycle | /api/orders/quote | qty zero | PASS | 400 | INVALID_SELECTION | Expected INVALID_SELECTION/VALIDATION_ERROR; Item quantity must be an integer >= 1 |
| One-time quote cycle | /api/orders/quote | missing required option | PASS | 400 | MIN_SELECTIONS_NOT_MET | Expected MIN_SELECTIONS_NOT_MET/VALIDATION_ERROR/INVALID_SELECTION/REQUIRED_OPTIONS_MISSING; Required option group selections are missing |
| One-time quote cycle | /api/orders/quote | too many options for maxSelections | PASS | 400 | MAX_SELECTIONS_EXCEEDED | Expected VALIDATION_ERROR/INVALID_SELECTION/MAX_SELECTIONS_EXCEEDED; Option group selections exceed maxSelections |
| One-time quote cycle | /api/orders/quote | per_100g missing weightGrams | PASS | 400 | INVALID_WEIGHT_GRAMS | Expected INVALID_WEIGHT_GRAMS/WEIGHT_REQUIRED/INVALID_WEIGHT; weightGrams is required for per_100g products |
| One-time quote cycle | /api/orders/quote | per_100g null weightGrams | PASS | 400 | INVALID_WEIGHT_GRAMS | Expected INVALID_WEIGHT_GRAMS/WEIGHT_REQUIRED/INVALID_WEIGHT; weightGrams is required for per_100g products |
| One-time quote cycle | /api/orders/quote | per_100g empty weightGrams | PASS | 400 | INVALID_WEIGHT_GRAMS | Expected INVALID_WEIGHT_GRAMS/WEIGHT_REQUIRED/INVALID_WEIGHT; weightGrams is required for per_100g products |
| One-time quote cycle | /api/orders/quote | per_100g zero weightGrams | PASS | 400 | INVALID_WEIGHT_GRAMS | Expected INVALID_WEIGHT_GRAMS/WEIGHT_REQUIRED/INVALID_WEIGHT; weightGrams must be a positive integer for per_100g products |
| One-time quote cycle | /api/orders/quote | per_100g negative weightGrams | PASS | 400 | INVALID_WEIGHT_GRAMS | Expected INVALID_WEIGHT_GRAMS/WEIGHT_REQUIRED/INVALID_WEIGHT; weightGrams must be a positive integer for per_100g products |
| One-time quote cycle | /api/orders/quote | per_100g decimal weightGrams | PASS | 400 | INVALID_WEIGHT_GRAMS | Expected INVALID_WEIGHT_GRAMS/WEIGHT_REQUIRED/INVALID_WEIGHT; weightGrams must be a positive integer for per_100g products |
| One-time quote cycle | /api/orders/quote | per_100g invalid weightGrams | PASS | 400 | INVALID_WEIGHT_GRAMS | Expected INVALID_WEIGHT_GRAMS/WEIGHT_REQUIRED/INVALID_WEIGHT; weightGrams must be a positive integer for per_100g products |
| One-time order creation | /api/orders | Create order and initialize payment | PASS | 200 |  |  |
| One-time order creation | /api/orders/6a1bb0997a57baa18366ab4f | Read created order detail | PASS | 200 |  |  |
| Subscription plans contract | /api/plans?lang=en | Client plan list responds | PASS | 200 |  |  |
| Subscription plans contract | /api/plans?lang=en | client plans inspected | PASS | 200 |  | 3 active plans. |
| Subscription plans contract | /api/dashboard/plans | Dashboard plan list responds | PASS | 200 |  |  |
| Subscription plans contract | /api/dashboard/plans | dashboard plans inspected | PASS | 200 |  | 3 active plans. |
| Meal planner catalog | /api/subscriptions/meal-planner-menu?includeLegacy=true&lang=ar | Canonical planner menu responds | PASS | 200 |  |  |
| Meal planner catalog | /api/subscriptions/meal-planner-menu?includeLegacy=true&lang=ar | V1/V2 contract inspected | PASS | 200 |  |  |
| Subscription meal validation | /api/subscriptions | Discover authenticated client subscription day | SKIP | 200 |  | DATA_SETUP_REQUIRED: QA client has no owned subscription with an existing day. |
| Settings / pickup | /api/settings | Public settings respond | PASS | 200 |  |  |
| Settings / pickup | /api/dashboard/settings | Dashboard settings route | WARN |  |  | Static inspection found public /api/settings and /api/app/config, but no dedicated /api/dashboard/settings route. |
| Auth / authorization | /api/orders/quote | Client endpoint without token | PASS | 401 | AUTH_REQUIRED | Authentication required |
| Auth / authorization | /api/orders/quote | Client endpoint with invalid token | PASS | 401 | TOKEN_INVALID | Invalid access token |
| Auth / authorization | /api/dashboard/plans | Dashboard endpoint without token | PASS | 401 | UNAUTHORIZED | Missing dashboard token |
| Auth / authorization | /api/dashboard/plans | Client token rejected by dashboard route | PASS | 401 | UNAUTHORIZED | Invalid dashboard token |
| Dashboard catalog writes | /api/dashboard/menu/categories | Create active hidden QA category without key | PASS | 201 |  | Generated key: qa_e2e_20260531041932_category |
| Dashboard catalog writes | /api/dashboard/menu/categories/6a1bb6ea50b9e7750579f1db | Update QA category name/UI without changing key | PASS | 200 |  |  |
| Dashboard catalog writes | /api/dashboard/menu/categories/6a1bb6ea50b9e7750579f1db | Reject category key mutation | PASS | 400 | IMMUTABLE_KEY | key is immutable |
| Dashboard catalog writes | /api/dashboard/menu/products | Create inactive QA product without key | PASS | 201 |  | Generated key: qa_e2e_20260531041932_product |
| Dashboard catalog writes | /api/dashboard/menu/products/6a1bb6ec50b9e7750579f1ea | Update QA product name/UI without changing key | PASS | 200 |  |  |
| Dashboard catalog writes | /api/dashboard/menu/products/6a1bb6ec50b9e7750579f1ea | Reject product key mutation | PASS | 400 | IMMUTABLE_KEY | key is immutable |
| Dashboard catalog writes | /api/dashboard/menu/option-groups | Create inactive QA option group without key | PASS | 201 |  | Generated key: qa_e2e_20260531041932_group |
| Dashboard catalog writes | /api/dashboard/menu/option-groups/6a1bb6ee50b9e7750579f1f9 | Update QA option group name/UI without changing key | PASS | 200 |  |  |
| Dashboard catalog writes | /api/dashboard/menu/option-groups/6a1bb6ee50b9e7750579f1f9 | Reject option group key mutation | PASS | 400 | IMMUTABLE_KEY | key is immutable |
| Dashboard catalog writes | /api/dashboard/menu/options | Create inactive QA option without key | PASS | 201 |  | Generated key: qa_e2e_20260531041932_option |
| Dashboard catalog writes | /api/dashboard/menu/options/6a1bb6ef50b9e7750579f207 | Update QA option name/UI without changing key | PASS | 200 |  |  |
| Dashboard catalog writes | /api/dashboard/menu/options/6a1bb6ef50b9e7750579f207 | Reject option key mutation | PASS | 400 | IMMUTABLE_KEY | key is immutable |
| Dashboard catalog writes | /api/dashboard/menu/products/6a1bb6ec50b9e7750579f1ea/option-groups | Link inactive QA option group to QA product | PASS | 201 |  |  |
| Dashboard catalog writes | /api/dashboard/menu/products/6a1bb6ec50b9e7750579f1ea/option-groups/6a1bb6ee50b9e7750579f1f9/options | Link inactive QA option to QA product group | PASS | 201 |  |  |
| Dashboard catalog writes | /api/orders/menu | Published menu visibility for QA records | SKIP |  |  | QA records intentionally remain inactive and unpublished; no publish operation is performed by unattended QA. |

## 4. Business Logic Findings
- None recorded.

## 5. UX/API Contract Findings
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_BRANCH has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_DELIVERY_WINDOW has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error EMPTY_ORDER has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error ITEM_NOT_FOUND has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_SELECTION has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error MIN_SELECTIONS_NOT_MET has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error MAX_SELECTIONS_EXCEEDED has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_WEIGHT_GRAMS has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_WEIGHT_GRAMS has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_WEIGHT_GRAMS has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_WEIGHT_GRAMS has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_WEIGHT_GRAMS has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_WEIGHT_GRAMS has no Arabic message field.
- **WARNING** One-time quote cycle: /api/orders/quote error INVALID_WEIGHT_GRAMS has no Arabic message field.
- **WARNING** Meal planner catalog: Premium large salad V1 groups expose rules while selectable rows live in premiumLargeSalad.ingredients. V2 optionGroups are populated; legacy clients must use the documented split shape.
- **WARNING** Auth / authorization: /api/orders/quote error AUTH_REQUIRED has no Arabic message field.
- **WARNING** Auth / authorization: /api/orders/quote error TOKEN_INVALID has no Arabic message field.
- **WARNING** Auth / authorization: /api/dashboard/plans error UNAUTHORIZED has no Arabic message field.
- **WARNING** Auth / authorization: /api/dashboard/plans error UNAUTHORIZED has no Arabic message field.
- **WARNING** Dashboard catalog writes: /api/dashboard/menu/categories/6a1bb6ea50b9e7750579f1db error IMMUTABLE_KEY has no Arabic message field.
- **WARNING** Dashboard catalog writes: /api/dashboard/menu/products/6a1bb6ec50b9e7750579f1ea error IMMUTABLE_KEY has no Arabic message field.
- **WARNING** Dashboard catalog writes: /api/dashboard/menu/option-groups/6a1bb6ee50b9e7750579f1f9 error IMMUTABLE_KEY has no Arabic message field.
- **WARNING** Dashboard catalog writes: /api/dashboard/menu/options/6a1bb6ef50b9e7750579f207 error IMMUTABLE_KEY has no Arabic message field.

## 6. Data Written During QA
- orders: 6a1bb0997a57baa18366ab4f
- categories: 6a1bb6ea50b9e7750579f1db
- products: 6a1bb6ec50b9e7750579f1ea
- optionGroups: 6a1bb6ee50b9e7750579f1f9
- options: 6a1bb6ef50b9e7750579f207
- relations: 6a1bb6f150b9e7750579f216, 6a1bb6f250b9e7750579f21e
- settingsTouched: none

## 7. Payment Verification Status
- Quote behavior is tested when QA_CLIENT_TOKEN is available.
- Order initialization is tested only when QA_ALLOW_WRITE=true and QA_ALLOW_ORDER_CREATE=true.
- External Moyasar payment completion is not automated. It remains manual unless an already-documented test provider is configured.
- **MANUAL** One-time order creation: QA order created: 6a1bb0997a57baa18366ab4f. Payment initialization was exercised; external Moyasar completion remains manual.

## 8. Manual Verification Still Required
- **MANUAL** Dashboard catalog writes: Inactive QA-tagged catalog records remain for dashboard inspection. Publish/visibility verification requires an explicit operator decision.
- Complete one Moyasar test-mode payment externally and verify webhook-driven order state transition.
- Run dashboard QA-tagged catalog writes manually if production mutation is intentionally approved.

## 9. Final Handoff Decision
**Conditionally Ready**

Payment completion being manual does not block handoff by itself. Any HTTP 500 in a critical flow does block handoff.
