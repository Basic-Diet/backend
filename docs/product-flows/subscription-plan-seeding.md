# Subscription Plan Seeding

Subscription plan prices are seeded by:

```bash
npm run seed:subscription-plans
```

The standalone script runs `scripts/seed-subscription-plans.js` and only creates or updates the 3 canonical top-level `Plan` documents. It does not reset or modify users, orders, subscriptions, payments, menu products, categories, or options.

The correct hierarchy is:

- 3 top-level plans: 7 days, 26 days, and 30 days.
- Each plan has 3 gram options: 100g, 150g, and 200g.
- Each gram option has 5 meal options: 1, 2, 3, 4, 5 meals/day. (Total nested price points: 45)

Prices are stored in halala. Frontend clients should display SAR by dividing halala values by `100`.

Duration-specific subscription addon prices are intentionally not persisted in the `Plan` seed. Snack, salad, and juice are subscription addons whose prices vary by duration and should be managed from the dashboard once the addon schema/service contract is finalized. Delivery is not a subscription addon; it belongs to delivery/shipping/checkout settings.

`npm run bootstrap:data` is additive by default. It creates missing catalog rows, relations, plans, settings, pickup locations, and addons without overwriting dashboard-managed values. Use `npm run bootstrap:data:sync` only for an intentional canonical sync. Legacy flat-plan deactivation and menu publication also run only in explicit sync mode.

Seeded top-level plans are identified by stable duration keys:

- `subscription_7_days`
- `subscription_26_days`
- `subscription_30_days`

Do not rely on translated plan names as identifiers.

The script also deactivates the previous incorrect flat seeded keys, such as `subscription_1_meal_7_days_100g`, by setting availability/activity flags to false. It only targets the known wrong seeded keys.
