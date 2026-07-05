# Full-Meal Product Contract

## Overview
The backend subscription meal-planner and meal-builder systems have been updated to support dynamic "full-meal" products (like pasta, ready-made bowls, or sandwiches) without relying on hardcoded item or category names.

This update removes legacy assumptions around the `sandwich` item type, allowing the frontend dashboard and Flutter client to dynamically identify products that are completely fulfilled as single entities.

## Configuration & Contract

Products assigned the selection type `full_meal_product` via the dashboard config will be emitted into the published API contracts (`/api/subscriptions/meal-builder` and `/api/subscriptions/meal-planner-menu`) with the following deterministic action payload:

```json
{
  "selectionType": "full_meal_product",
  "action": {
    "type": "direct_add",
    "treatAsFullMeal": true,
    "requiresBuilder": false
  }
}
```

### Frontend Guidelines
- **Identification:** Mobile clients should evaluate a product's status as a full meal by asserting `action.treatAsFullMeal === true` and `action.requiresBuilder === false`.
- **Exclusivity:** The backend slot validation requires that slots containing a `full_meal_product` do NOT include `carbs`, `proteinId`, or `salad` groups.
- **Backward Compatibility:** Legacy `sandwich` selection types automatically resolve to this exact action footprint and are structurally compatible. There is no need for mobile to fork logic between `sandwich` and `full_meal_product`.

## Slot Submission Payload
When submitting a day slot payload containing a `full_meal_product`, the payload should include the base `productId` as normal. (It should not be mapped to the legacy `sandwichId` field). 

```json
{
  "slotIndex": 1,
  "selectionType": "full_meal_product",
  "productId": "64abcdef01234567890abcde"
}
```
The canonical meal slot planner will appropriately materialize the item for downstream kitchen processing as an atomic entity.
