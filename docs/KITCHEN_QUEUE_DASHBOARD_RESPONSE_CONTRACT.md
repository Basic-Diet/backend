# Kitchen Queue Dashboard Response Contract

Backend path: `/home/hema/Projects/basicdiet145`

## Endpoint

`GET /api/dashboard/kitchen/queue?date=YYYY-MM-DD`

Detail:

`GET /api/dashboard/kitchen/queue/:dayId`

Contract version:

`dashboard_kitchen_queue.v2`

## Query Parameters

- `date`: KSA business date in `YYYY-MM-DD`.
- `method`: optional `delivery`, `pickup`, or `all`.
- `status`: optional comma-separated operational statuses.
- `q` / `search`: optional customer/order/subscription search.
- `zoneId`: optional delivery zone filter.
- `branchId`: optional pickup branch/location filter.
- `includeRaw=true`: attaches the legacy DTO under `items[].raw` for internal debugging.
- `view=legacy`: returns the pre-v2 board DTO.

By default, the kitchen queue returns the clean v2 contract. Heavy raw fields such as `mealSlots`, `materializedMeals`, raw snapshots, full payments, full users, full plans, and full catalog/product documents are not returned at the top level.

## List Shape

```js
{
  status: true,
  data: {
    contractVersion: "dashboard_kitchen_queue.v2",
    date: "2026-06-12",
    businessDate: "2026-06-12",
    count: 1,
    filters: {},
    items: []
  }
}
```

## Item Sections

- `ids`: stable backend identities: entity, subscription, day, order, delivery, pickup request.
- `customer`: id, name, phone.
- `source`: source type, reference, date, status.
- `subscription.plan`: plan/package fields plus `proteinGrams` and `portionSize`.
- `orderSummary`: meal/item counts, premium/add-on flags, notes, allergies.
- `kitchen.meals`: render-ready meal preparation details.
- `kitchen.addons`: add-ons separated from meals.
- `fulfillment`: delivery or pickup identity and state.
- `payment`: payment validity and preparation/fulfillment gates.
- `actions`: role/state-derived action list and convenience booleans.
- `timestamps`: creation/update/preparation/fulfillment timestamps.

Lightweight compatibility aliases (`entityId`, `entityType`, `subscriptionDayId`, `status`, `allowedActions`) may appear, but dashboard rendering should prefer the structured sections.

## Subscription Item Example

```js
{
  ids: {
    entityType: "subscription_day",
    entityId: "day1",
    subscriptionId: "sub1",
    subscriptionDayId: "day1",
    orderId: null,
    deliveryId: "delivery1",
    pickupRequestId: null
  },
  customer: { id: "user1", name: "Sara", phone: "+966500000000" },
  source: {
    type: "subscription_day",
    reference: "SUB-000001",
    date: "2026-06-12",
    status: "ready_for_pickup"
  },
  subscription: {
    id: "sub1",
    plan: {
      id: "plan1",
      key: "monthly_fit",
      name: "Monthly Fit",
      proteinGrams: 200,
      portionSize: "200g",
      selectedMealsPerDay: 2,
      totalMeals: 56,
      remainingMeals: 42,
      deliveryMode: "delivery"
    }
  },
  orderSummary: {
    mealCount: 1,
    itemCount: 3,
    hasPremium: true,
    hasAddons: true,
    notes: null,
    allergies: null
  },
  kitchen: {
    meals: [{
      slotIndex: 1,
      slotKey: "slot_1",
      mealType: "premium_meal",
      product: { id: "product1", key: "basic_meal", name: "Basic Meal" },
      protein: { id: "protein1", key: "beef", name: "Beef", grams: 200 },
      carbs: [{ id: "carb1", key: null, name: "Rice", grams: 150 }],
      salad: null,
      sauce: [{ optionKey: "bbq", name: "BBQ" }],
      sides: [],
      options: [],
      premium: { isPremium: true, key: "beef_premium", source: "paid" },
      quantity: 1,
      notes: null
    }],
    addons: [{ id: "addon1", key: null, name: "Protein Bar", quantity: 2 }]
  },
  fulfillment: {
    type: "home_delivery",
    delivery: {
      deliveryId: "delivery1",
      date: "2026-06-12",
      status: "out_for_delivery",
      address: {},
      window: "10:00 - 12:00",
      zoneId: "zone1",
      courierId: "courier1"
    },
    pickup: {
      pickupRequestId: null,
      branchId: null,
      locationId: null,
      mealCount: 0,
      reserved: false,
      consumed: false,
      released: false,
      pickupCodeState: null
    }
  },
  payment: {
    paymentRequired: false,
    paymentStatus: "not_required",
    paymentApplied: false,
    pendingUnpaid: false,
    superseded: false,
    revisionMismatch: false,
    canPrepare: false,
    canFulfill: true,
    reason: null
  }
}
```

## One-Time Order Item

One-time orders use:

- `source.type = "one_time_order"`
- `ids.orderId`
- `kitchen.meals[]` from order items and selections.
- `kitchen.addons[]` for `addon_item`, `drink`, and `dessert`.
- `payment.paymentStatus` from `Order.paymentStatus`.

Paid orders can be prepared or fulfilled only when the order status and action policy allow it. Unpaid one-time orders are excluded from the kitchen queue list.

## Pickup Item

Pickup requests use:

- `source.type = "pickup_request"`
- `fulfillment.type = "branch_pickup"`
- `ids.pickupRequestId`
- `fulfillment.pickup.mealCount`
- `fulfillment.pickup.reserved`
- `fulfillment.pickup.consumed`
- `fulfillment.pickup.released`
- `fulfillment.pickup.pickupCodeState`

## Reading Counts

- `orderSummary.mealCount`: meals to prepare. Premium does not add to this count.
- `kitchen.meals.length`: distinct meal rows/slots.
- `kitchen.meals[].quantity`: quantity for one-time order rows.
- `orderSummary.itemCount`: meal quantity plus add-on quantity.
- `kitchen.addons[]`: add-ons only; do not count them as meals.

## Reading Protein Portion

For subscriptions, protein grams come from `Subscription.selectedGrams`.

For a 200g subscription:

- `subscription.plan.proteinGrams = 200`
- `subscription.plan.portionSize = "200g"`
- `kitchen.meals[].protein.grams = 200`

The dashboard must not parse protein grams from plan names.

## Reading Payment Validity

Use `payment`:

- `pendingUnpaid = true`: do not show as paid/fulfillable.
- `superseded = true`: stale payment; do not prepare/fulfill.
- `revisionMismatch = true`: stale payment revision; do not prepare/fulfill.
- `canPrepare`: payment gate for preparation.
- `canFulfill`: payment gate for fulfillment.

Backend action validators remain authoritative. The dashboard should still submit actions to the action endpoints and handle `FORBIDDEN`, `INVALID_TRANSITION`, `PAYMENT_REQUIRED`, `PAYMENT_SUPERSEDED`, and `PAYMENT_REVISION_MISMATCH`.

## Deprecated / Debug Only

These fields are debug-only and only available inside `raw` when `includeRaw=true` or through `view=legacy`:

- raw `mealSlots`
- `materializedMeals`
- `lockedSnapshot`
- `fulfilledSnapshot`
- `confirmationSnapshot`
- full product/catalog snapshots
- full payment objects
- full subscription/user/plan documents
- repeated legacy context/pricing/items copies
