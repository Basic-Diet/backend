# 11G — Subscription Planner Upgrades Dashboard README

## Status

`BACKEND_FOUNDATION_READY_FOR_DASHBOARD_UI`

This document explains the new Dashboard screen required for managing subscription meal planner upgrade sections:

* `premium_meal`
* `premium_large_salad`

The backend foundation is ready and verified. The Dashboard team can now build a UI screen on top of the existing Meal Builder draft/config flow.

---

## 1. Purpose

The Dashboard needs a new admin screen that allows admins to control subscription planner upgrades without changing backend code or Flutter code.

Suggested screen name:

```txt
Subscription Planner Upgrades
```

Alternative name:

```txt
Meal Planner Upgrades
```

This screen controls two business-critical planner upgrade areas:

1. **Premium Meal**
   A meal upgrade where the customer selects a premium protein and pays an extra fee, while still consuming one normal meal slot.

2. **Premium Large Salad**
   A configurable planner product representing a large salad + protein, with selectable option groups such as leafy greens, vegetables, proteins, fruits, cheese/nuts, and sauces.

These are **not subscription add-ons**.

---

## 2. Important Business Rule

Premium Meal and Premium Large Salad must not be treated like add-ons.

### Add-ons

Examples:

```txt
Juice Subscription
Snack Subscription
Small Salad Subscription
```

Add-ons have separate entitlement/balance logic.

### Planner Upgrades

Examples:

```txt
premium_meal
premium_large_salad
```

Planner upgrades belong inside the meal planner flow.

They consume meal planner capacity and must remain compatible with:

```http
GET /api/subscriptions/meal-planner-menu
```

---

## 3. Flutter Compatibility Requirements

The Dashboard must not change or break the Flutter-facing contract.

These section keys must remain stable:

```txt
standard_meal
premium_meal
sandwich
premium_large_salad
```

This exact product key must remain stable:

```txt
premium_large_salad
```

Flutter must not be required to fuzzy-match salad products.

Flutter should continue reading the existing meal planner response shape from:

```http
GET /api/subscriptions/meal-planner-menu
```

The Dashboard screen should only update backend config. The backend will continue serializing the existing Flutter contract.

---

## 4. Backend Implementation Status

Backend dynamic planner upgrade rules are implemented through `MealBuilderConfig`.

The new dynamic rules live inside the existing visual `premium` section rules object.

Backend file currently owning this behavior:

```txt
src/services/subscription/mealBuilderConfigService.js
```

Test coverage file:

```txt
tests/dashboardSubscriptionPlannerConfig.test.js
```

Verified behavior:

```txt
Premium Meal:
- extraFeeHalala can be overridden from config
- disabled premium protein is removed from output
- config-only premium list is respected
- missing rules fallback to legacy constants

Premium Large Salad:
- exact product key premium_large_salad is preserved
- extraFeeHalala can be overridden from config
- blocked groups are removed from output
- allowedOptionKeys restrict output options
- minSelections/maxSelections overrides work
- invalid group/option validation errors are returned
```

Related tests:

```bash
NODE_ENV=test node tests/dashboardSubscriptionPlannerConfig.test.js
NODE_ENV=test node tests/subscriptionPlannerDashboardToFlutter.e2e.test.js
NODE_ENV=test node tests/dashboardMealBuilderRegression.test.js
NODE_ENV=test node tests/dashboardSubscriptionMenuReadiness.test.js
```

---

## 5. Current Dashboard Integration Approach

For now, the Dashboard screen should use the existing Meal Builder draft/config flow.

Do not invent a separate frontend-only config.

The Dashboard should load, edit, validate, save, and publish the existing backend config.

Expected existing flow:

```http
POST /api/dashboard/meal-builder/draft
GET  /api/dashboard/meal-builder/draft/hydrated
POST /api/dashboard/meal-builder/validate
PUT  /api/dashboard/meal-builder/draft
POST /api/dashboard/meal-builder/publish
```

After publish, verify Flutter-facing output through:

```http
GET /api/subscriptions/meal-planner-menu
```

---

## 6. Data Location

The Dashboard screen should find the visual section with:

```txt
section.key = premium
```

Inside that section, planner upgrade rules live under:

```js
section.rules.premium_meal
section.rules.premium_large_salad
```

Do not rename the visual `premium` section unless the backend contract changes.

---

## 7. Premium Meal Config Shape

The `premium_meal` config controls which proteins appear as premium meal upgrades.

Expected shape:

```js
{
  "upgradeType": "premium_protein",
  "linkedProductKey": "basic_meal",
  "premiumProteinOptions": [
    {
      "optionKey": "beef_steak",
      "extraFeeHalala": 2000,
      "enabled": true,
      "sortOrder": 10
    },
    {
      "optionKey": "shrimp",
      "extraFeeHalala": 2000,
      "enabled": true,
      "sortOrder": 20
    },
    {
      "optionKey": "salmon",
      "extraFeeHalala": 2000,
      "enabled": true,
      "sortOrder": 30
    }
  ]
}
```

### Dashboard fields

The Premium Meal UI should allow the admin to control:

```txt
enabled/disabled per premium protein
extraFeeHalala per premium protein
sortOrder per premium protein
```

The following should be locked/read-only unless backend explicitly allows changes later:

```txt
upgradeType = premium_protein
linkedProductKey = basic_meal
```

### Business meaning

Premium Meal is a meal upgrade.

Example:

If a customer has 14 meals and chooses 4 premium meals:

```txt
10 standard meals
4 premium meals
total remains 14 meals
```

Premium Meal must not create extra meals.

---

## 8. Premium Large Salad Config Shape

The `premium_large_salad` config controls the configurable large salad planner product.

Expected shape:

```js
{
  "upgradeType": "premium_large_salad",
  "linkedProductKey": "premium_large_salad",
  "extraFeeHalala": 2900,
  "blockedGroupKeys": ["extra_protein_50g"],
  "groups": [
    {
      "groupKey": "leafy_greens",
      "enabled": true,
      "minSelections": 0,
      "maxSelections": 2,
      "allowedOptionKeys": ["lettuce", "arugula", "cabbage"]
    },
    {
      "groupKey": "vegetables_legumes",
      "enabled": true,
      "minSelections": 0,
      "maxSelections": 19,
      "allowedOptionKeys": []
    },
    {
      "groupKey": "proteins",
      "enabled": true,
      "minSelections": 1,
      "maxSelections": 1,
      "allowedOptionKeys": [
        "boiled_eggs",
        "tuna",
        "chicken_fajita",
        "spicy_chicken",
        "italian_spiced_chicken",
        "chicken_tikka",
        "asian_chicken",
        "chicken_strips",
        "grilled_chicken",
        "mexican_chicken",
        "fish_fillet"
      ]
    }
  ]
}
```

### Dashboard fields

The Premium Large Salad UI should allow the admin to control:

```txt
extraFeeHalala
blockedGroupKeys
enabled/disabled per group
minSelections per group
maxSelections per group
allowedOptionKeys per group
```

The following should be locked/read-only unless backend explicitly allows changes later:

```txt
upgradeType = premium_large_salad
linkedProductKey = premium_large_salad
```

### allowedOptionKeys behavior

If `allowedOptionKeys` is an empty array:

```txt
allow all currently linked options in that group
```

If `allowedOptionKeys` contains keys:

```txt
only these options should appear in the final planner output
```

---

## 9. Suggested Dashboard UI Layout

### Page title

```txt
Subscription Planner Upgrades
```

### Main sections

```txt
1. Premium Meal
2. Premium Large Salad
```

---

### Premium Meal section UI

Recommended table:

| Protein    | Enabled | Extra Fee SAR | Sort Order |
| ---------- | ------: | ------------: | ---------: |
| Beef Steak |  yes/no |         20.00 |         10 |
| Shrimp     |  yes/no |         20.00 |         20 |
| Salmon     |  yes/no |         20.00 |         30 |

Notes:

* Display fee in SAR.
* Save as halala.
* Disabled proteins must disappear from Flutter planner output.
* At least one enabled premium protein is recommended.

---

### Premium Large Salad section UI

Recommended layout:

```txt
Extra Fee SAR
Blocked Groups
Groups Table
```

Groups table:

| Group        | Enabled | Min | Max | Allowed Options            |
| ------------ | ------: | --: | --: | -------------------------- |
| Leafy Greens |  yes/no |   0 |   2 | lettuce, arugula, cabbage  |
| Vegetables   |  yes/no |   0 |  19 | all / selected             |
| Proteins     |  yes/no |   1 |   1 | tuna, chicken, boiled eggs |
| Sauces       |  yes/no |   1 |   1 | selected sauces            |

Notes:

* Admin should pick allowed options from existing backend option groups.
* Do not allow free-text option keys unless this is an internal/debug tool.
* Use backend hydrated data/pickers if available.
* If a group is blocked, it must not appear in final planner output.

---

## 10. Validation Rules

Dashboard should call backend validation before saving/publishing.

Backend validation should reject:

```txt
premium_meal linkedProductKey not equal to basic_meal
premium_meal optionKey not found in protein options
premium_meal extraFeeHalala < 0
premium_large_salad linkedProductKey not equal to premium_large_salad
premium_large_salad groupKey not found
premium_large_salad optionKey not found under selected group
invalid min/max selection values
blocked groups appearing in output
renamed planner section keys
```

Known validation error codes include:

```txt
MEAL_BUILDER_PREMIUM_MEAL_INVALID_FEE
MEAL_BUILDER_PREMIUM_MEAL_INVALID_OPTION
MEAL_BUILDER_PREMIUM_LARGE_SALAD_INVALID_GROUP
MEAL_BUILDER_PREMIUM_LARGE_SALAD_INVALID_OPTION
```

Dashboard should display these errors clearly to the admin.

---

## 11. Save/Publish Flow

Recommended UI flow:

```txt
1. Load current hydrated draft.
2. Locate section.key = premium.
3. Render rules.premium_meal.
4. Render rules.premium_large_salad.
5. Admin edits values.
6. Call validate.
7. If validation passes, save draft.
8. Admin publishes.
9. After publish, optionally verify /api/subscriptions/meal-planner-menu.
```

Do not publish automatically after every edit unless this is explicitly approved.

---

## 12. Safety Rules For Dashboard Team

Do not do these:

```txt
Do not rename premium_meal.
Do not rename premium_large_salad.
Do not rename premium_large_salad product key.
Do not move Premium Meal into add-ons.
Do not move Premium Large Salad into add-ons.
Do not calculate prices in frontend.
Do not calculate meal balance in frontend.
Do not hardcode premium proteins in Flutter.
Do not rely on fuzzy salad matching.
```

Dashboard can display and edit config, but backend remains the source of truth.

---

## 13. Acceptance Criteria

The Dashboard screen is considered ready when:

```txt
1. Admin can view current Premium Meal config.
2. Admin can enable/disable premium proteins.
3. Admin can edit premium protein extra fees.
4. Admin can view current Premium Large Salad config.
5. Admin can edit large salad extra fee.
6. Admin can block/unblock option groups.
7. Admin can restrict allowed options per group.
8. Admin can edit min/max group limits.
9. Validation errors are displayed clearly.
10. Saving does not break /api/subscriptions/meal-planner-menu.
11. Published output still contains:
   - standard_meal
   - premium_meal
   - sandwich
   - premium_large_salad
12. Published output still uses exact product key:
   - premium_large_salad
```

---

## 14. QA Checklist

After Dashboard implementation, QA should verify:

```txt
Premium Meal:
- Beef Steak appears when enabled.
- Shrimp disappears when disabled.
- Custom extra fee appears in planner output.
- Config with one premium protein only outputs that one protein.
- Missing config still falls back safely.

Premium Large Salad:
- Product key remains premium_large_salad.
- Extra fee changes after publish.
- Blocked group does not appear.
- allowedOptionKeys restricts options.
- min/max overrides appear.
- invalid group/option shows validation error.

Flutter compatibility:
- Existing meal planner screen still opens.
- No section is missing.
- Premium Large Salad selection still works.
- Add-ons remain separate from meals.
```

---

## 15. Current Backend Test Commands

Use these to verify backend compatibility after dashboard-facing changes:

```bash
NODE_ENV=test node tests/dashboardSubscriptionPlannerConfig.test.js
NODE_ENV=test node tests/subscriptionPlannerDashboardToFlutter.e2e.test.js
NODE_ENV=test node tests/dashboardMealBuilderRegression.test.js
NODE_ENV=test node tests/dashboardSubscriptionMenuReadiness.test.js
```

---

## 16. Current Known Limitation

A dedicated simplified endpoint such as:

```http
GET /api/dashboard/subscription-planner/config
PUT /api/dashboard/subscription-planner/config
```

may be added later for a cleaner Dashboard UI.

For now, the backend foundation works through the existing Meal Builder config flow.

Dashboard should avoid depending on private frontend-only state.

---

## 17. Final Summary

This screen exists to make subscription planner upgrades admin-configurable.

It controls:

```txt
premium_meal
premium_large_salad
```

It must preserve Flutter compatibility and keep backend as the source of truth.

Premium Meal and Premium Large Salad are planner upgrade sections, not add-ons.

The correct architecture is:

```txt
Dashboard UI
→ MealBuilderConfig rules
→ backend validation
→ publish
→ /api/subscriptions/meal-planner-menu
→ Flutter
```
