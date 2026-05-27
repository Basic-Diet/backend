# Subscription Plan Seeding

Subscription plan prices are seeded by:

```bash
npm run seed:subscription-plans
```

The standalone script runs `scripts/seed-subscription-plans.js` and only creates or updates seeded `Plan` documents. It does not reset or modify users, orders, subscriptions, payments, menu products, categories, or options.

Prices are stored in halala. Frontend clients should display SAR by dividing halala values by `100`.

Seeded plans are identified by stable keys built from `mealsPerDay`, `durationDays`, and `mealSizeGrams`, for example `subscription_1_meal_7_days_100g`. Do not rely on translated plan names as identifiers.
