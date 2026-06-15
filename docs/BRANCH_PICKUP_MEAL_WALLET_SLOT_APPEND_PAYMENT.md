# Branch Pickup Meal Wallet, Slot Append, and Payment Safety

## Scope

Backend-only contract for Branch Pickup request creation, pickup availability, and append-only meal planning.

## Endpoints

- `GET /api/subscriptions/:id/pickup-availability?date=YYYY-MM-DD`
  - Returns planned slots for the day with `available`, `unavailableReason`, and reservation metadata.
  - A slot is unavailable when it is already reserved/consumed by an active pickup request or has unpaid premium/add-on payment exposure.

- `POST /api/subscriptions/:id/pickup-requests`
  - Preferred body:
    ```json
    {
      "date": "YYYY-MM-DD",
      "selectedMealSlotIds": ["slot_1", "slot_2"],
      "idempotencyKey": "client-generated-key"
    }
    ```
  - `mealCount` remains a legacy fallback only when it cannot bypass unpaid, reserved, fulfilled, or unavailable planned slots.
  - Same `idempotencyKey` plus same payload returns the original request.
  - Same `idempotencyKey` plus a different payload returns `IDEMPOTENCY_CONFLICT`.

- `POST /api/subscriptions/:id/days/:date/meals/append`
  - Body uses the same canonical planner payload shape as day selection:
    ```json
    {
      "mealSlots": [
        {
          "slotIndex": 1,
          "selectionType": "standard_meal",
          "productId": "...",
          "selectedOptions": []
        }
      ]
    }
    ```
  - Incoming slot indexes are ignored for persistence; appended slots are stored after the existing maximum `slotIndex`.

## Wallet Accounting

- Branch Pickup decrements `Subscription.remainingMeals` when a pickup request is created and credits are reserved.
- Pickup fulfillment marks reserved request credits consumed and does not decrement `remainingMeals` again.
- Cancellation releases reserved credits back to `remainingMeals`.
- No-show consumes reserved credits without refunding `remainingMeals`.
- Planned/appended slots are wallet-neutral. They affect planning entitlement, not `remainingMeals`.
- Home Delivery continues to consume credits through `subscription_day` fulfillment only.

## Slot Selection

- `SubscriptionPickupRequest.selectedMealSlotIds` stores selected slot identifiers.
- Slot IDs resolve from `slotKey` first, then `slotIndex`.
- Request snapshots include only selected slots in `snapshot.mealSlots`.
- Multiple same-date pickup requests are allowed when they select different available slots and the wallet has enough remaining credits.
- Reusing a selected slot from an active, fulfilled, or no-show request is blocked.

## Append Behavior

- Append never deletes, replaces, or mutates existing slots.
- New slots are appended after max existing `slotIndex` with `slotKey = slot_<slotIndex>`.
- Append is allowed for confirmed Branch Pickup days.
- The save still runs through canonical planner validation, commercial state derivation, payment lifecycle, and global meal entitlement checks.
- Total planned complete slots cannot exceed subscription meal entitlement.

## Premium/Add-on Payment Safety

- Premium slots with `premiumSource = pending_payment` require payment before pickup selection.
- Pending one-time add-ons make the day’s slots unavailable for pickup until paid.
- Pickup request creation rejects unpaid selected slots.
- Dashboard queue rows derive `canPrepare=false` and canonical payment reasons from the pickup request snapshot when unpaid content is present.

## Dashboard Queue

- Branch Pickup operation rows remain `subscription_pickup_request`.
- `kitchen.meals` is based on the selected request snapshot, not the full subscription day.
- `fulfillment.pickup.mealCount` equals the request meal count.

## Home Delivery

- Home Delivery remains `subscription_day` based.
- Chef Choice behavior is unchanged.
- Home Delivery does not create pickup requests or pickup codes.
