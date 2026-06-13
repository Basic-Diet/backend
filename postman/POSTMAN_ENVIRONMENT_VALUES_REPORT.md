# Postman Environment Values Report

Generated: 2026-06-13T05:13:39.185Z
Backend path: `/home/hema/Projects/basicdiet145`
Database: `basicdiet145`

## Home Delivery Candidate

- Safety marker: `POSTMAN_HOME_DELIVERY_LIFECYCLE`
- Test customer name: `Postman Test Client - Home Delivery`
- Test customer email domain: `example.test`
- Subscription ID: `6a2ce700c2ce6c0528b5c9b2`
- Subscription status: `active`
- Delivery mode: `delivery`
- Day ID: `6a2ce701c2ce6c0528b5c9cd`
- Date: `2026-06-13`
- Day status at selection time: `open`
- Delivery ID: `6a2ce70143990b927254bda7`
- Delivery status at selection time: `scheduled`

## Why This Is Safe For Testing

This candidate was created as explicit seeded test data, not selected from a production customer. The user name, email domain, address notes, subscription contract snapshot, and day meal notes all carry the `POSTMAN_HOME_DELIVERY_LIFECYCLE` marker or clearly identify the record as Postman test data. No private token or password was written to the Postman environment.

## Queue / Payment Readiness

The seeded day was verified through `GET /api/dashboard/kitchen/queue?date=2026-06-13&method=delivery` using a temporary local dashboard JWT that was not saved. Verification confirmed:

- the row appears in the kitchen queue
- `fulfillment.type` is `home_delivery`
- `kitchen.meals` contains a complete meal
- Arabic display/preparation text is present
- product/protein display names are safe
- payment flags are not pending/superseded/revision-mismatched
- `actions.canPrepare` is true

## Updated Environment Fields

- `testDate=2026-06-13`
- `dateDay1=2026-06-13`
- `dateDay2=2026-06-14`
- `deliverySubscriptionId=6a2ce700c2ce6c0528b5c9b2`
- `deliverySubscriptionDayId=6a2ce701c2ce6c0528b5c9cd`
- `entityId=6a2ce701c2ce6c0528b5c9cd`
- `entityType=subscription_day`
- `deliveryId=6a2ce70143990b927254bda7`

## Postman Folders Now Runnable

After adding valid dashboard/admin/courier tokens manually, these delivery-oriented folders have valid data IDs:

- `01 - Queue Contract Smoke Tests`
- `02 - Home Delivery Lifecycle`
- `04 - Day Status / Transition Matrix` for the seeded delivery day
- `05 - Payment / Fulfillment Validity`
- relevant delivery duplicate/safety checks in `07 - Error Cases / Negative Tests`

Tokens remain blank by design.
