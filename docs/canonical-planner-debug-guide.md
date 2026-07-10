# Canonical Planner (v3) Integration & Debugging Guide

This guide is designed to help mobile and front-end developers debug issues when integrating with the Canonical Planner (v3) selection validation APIs.

---

## 1. How Validation Works

The backend validation engine enforces strict constraints based on product configuration:
1. **Product State Check**: Ensures the product is active, visible, available, and subscription-enabled.
2. **Selection Type Enforcement**: Checks that the `selectionType` matches the product's classification (e.g. `sandwich`, `standard_meal`, `premium_meal`, `premium_large_salad`).
3. **Product-Group Constraints**: Iterates through each `ProductOptionGroup` associated with the product to verify that:
   - The user selected at least the minimum required selections (`minSelections`).
   - The user did not exceed the maximum allowed selections (`maxSelections`).
4. **Option Validity**: Verifies that every selected option belongs to the specified group and is currently active and available in the catalog.

---

## 2. Normalization Flow

Before validation is run, the incoming request payload is normalized:
1. **Slot Matching**: Each slot's index (`slotIndex`) is converted to a 1-indexed number.
2. **Product Normalization**: The `productId` is cast to a canonical Mongo Object ID string.
3. **Legacy Clean-up**: If a slot contains legacy selection properties (e.g. `carbId`, `salad`, `sandwichId`) instead of `selectedOptions`, it will reject the request with `PLANNER_MIXED_LEGACY_CANONICAL_SLOT`.
4. **Carb Selections**: Standard/Premium meals that request carb portions are normalized from legacy options into the new carbs array structure for execution context, but options must still be passed properly.

---

## 3. How Groups Are Matched

1. The validation engine maps the `groupId` from each item in the `selectedOptions` array.
2. It queries all active `ProductOptionGroup` relationships for the specified product.
3. For each group, it counts the sum of quantities (`quantity` field, defaults to `1` if omitted) of all received selections belonging to that group.
4. It compares that count against the group's `minSelections` and `maxSelections` rules.

---

## 4. Common Flutter Mistakes

### ❌ Sending Protein Only
When building a custom meal, developers often send only the protein option and omit the carb option.
* **Expected Option Groups**:
  - `proteins` (min: 1, max: 1)
  - `carbs` (min: 1, max: 2)
* **Received selectedOptions**:
  - `proteins` selection only
* **Result**: `PLANNER_MIN_SELECTION_NOT_MET` with message `"carbs requires at least 1 selection"`.

### ❌ Wrong `groupId`
Sending option selections with incorrect or mismatched `groupId` values will prevent the option from being counted towards its group.
* **Result**: `PLANNER_GROUP_NOT_FOUND` or `PLANNER_MIN_SELECTION_NOT_MET` for the expected group.

### ❌ Wrong `optionId`
Sending `optionId` values that are inactive, unavailable, or incorrect.
* **Result**: `PLANNER_OPTION_NOT_FOUND` or invalid option errors.

### ❌ Product Changed But Old Options Kept
When a user switches from product A (e.g., Salmon) to product B (e.g., Chicken Breast), the app must reset `selectedOptions`. Sending old options with the new `productId` will fail.
* **Result**: `PLANNER_OPTION_RELATION_NOT_FOUND` or group validation mismatches.

### ❌ `selectedOptions` Lost During Mapping
Ensure that state mutations or serialization logic in BLoCs/Mappers does not drop the `selectedOptions` array. If empty, the slot is treated as having no selections.
* **Result**: `PLANNER_MIN_SELECTION_NOT_MET` for all required groups.

---

## 5. Real Payload Examples

### ✅ Valid Payload
```json
{
  "contractVersion": "meal_planner_menu.v3",
  "mealSlots": [
    {
      "slotIndex": 1,
      "slotKey": "slot_1",
      "selectionType": "sandwich",
      "productId": "6a3e87553a3b9944089f8ed5",
      "selectedOptions": []
    },
    {
      "slotIndex": 2,
      "slotKey": "slot_2",
      "selectionType": "premium_meal",
      "productId": "6a3e870b3a3b9944089f8ca6",
      "selectedOptions": [
        {
          "groupId": "6a3e86a73a3b9944089f89a6",
          "groupKey": "proteins",
          "optionId": "6a3e86aa3a3b9944089f89bb",
          "optionKey": "salmon",
          "quantity": 1
        },
        {
          "groupId": "6a3e86af3a3b9944089f89e5",
          "groupKey": "carbs",
          "optionId": "6a3e86bf3a3b9944089f8a37",
          "optionKey": "white_rice",
          "quantity": 1
        }
      ]
    }
  ]
}
```

### ❌ Invalid Payload (Missing Carbs)
```json
{
  "contractVersion": "meal_planner_menu.v3",
  "mealSlots": [
    {
      "slotIndex": 1,
      "slotKey": "slot_1",
      "selectionType": "premium_meal",
      "productId": "6a3e870b3a3b9944089f8ca6",
      "selectedOptions": [
        {
          "groupId": "6a3e86a73a3b9944089f89a6",
          "groupKey": "proteins",
          "optionId": "6a3e86aa3a3b9944089f89bb",
          "optionKey": "salmon",
          "quantity": 1
        }
      ]
    }
  ]
}
```

---

## 6. How to Compare Flutter Payload Against Backend Expectations

When validation fails with `422 Unprocessable Entity`, the response includes a `debug` object at the top level (and inside the thrown error details). 

This debug object contains:
* **`normalizedPayload`**: The state of the payload after early normalization (mapping and casting Slot indices and Object IDs).
* **`slots`**: An array of detailed diagnostic reports for each slot, including:
  1. **`rawSelectedOptions`**: Exactly what Flutter sent before any processing.
  2. **`productConfiguration`**: The expected selection rules (min/max/selection type) configured in the database catalog for this product.
  3. **`groupValidation`**: The validation results per group, indicating minimum/maximum requirements, actual counts received, and whether the group passed validation (`PASS` or `FAIL`).
  4. **`selectedOptionsAnalysis`**: A granular audit of every single option received, detailing whether it matched the catalog, which group it was counted towards, or the exact rejection reason if it failed (e.g. `OPTION_NOT_FOUND`, `GROUP_MISMATCH`, `OPTION_INACTIVE`).
  5. **`validationTimeline`**: A step-by-step trace of every validation check run for the slot (e.g., product availability, option group checks).
  6. **`humanReadableSummary`**: A plain-text summary comparing expected vs received selections and giving an actionable "Suggested Fix" to resolve the payload issue.

By checking these fields, you can pinpoint the exact payload problem and resolve integration errors in seconds.
