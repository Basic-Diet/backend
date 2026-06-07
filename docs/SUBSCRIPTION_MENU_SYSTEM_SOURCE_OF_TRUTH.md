# Subscription Menu / Meal Planner Source Of Truth

Internal backend reference: YES
Final Dashboard/Flutter implementation contract: READY FOR CONTRACT REVIEW
Overall readiness: READY FOR DASHBOARD/FLUTTER CONTRACT REVIEW

Decision:

The subscription menu / meal planner backend can be used as the backend source of truth and contract review baseline. Dashboard and Flutter can start implementation against the documented v3 contract.

This is not a claim of full production readiness. Production readiness still depends on environment validation, secrets rotation, deployment checks, and real payment provider staging verification.

## Contract Decisions

- v3 premium large salad validation enforces the backend subscription salad protein allowlist.
- Dashboard relations cannot allow a disallowed premium large salad protein.
- `extra_protein_50g` is rejected for subscription premium large salad.
- Unified day payment create/verify responses include stable safe fields:
  `paymentId`, `payment_id`, `status`, `requiresPayment`, `premiumAmountHalala`, `addonsAmountHalala`, `totalHalala`, `plannerRevisionHash`, `paymentUrl`, and `payment_url`.
- Planner add-on CTA uses `ADDON_PAYMENT_REQUIRED`, not `ONE_TIME_ADDON_PAYMENT_REQUIRED`.
- Dashboard readiness is exposed through `GET /api/dashboard/health/meal-planner`.
- Flutter stale catalog refresh behavior is driven by explicit planner error codes and refresh hints.

## Final Status

READY FOR DASHBOARD/FLUTTER CONTRACT REVIEW

Dashboard/Flutter can begin contract review against:

- `GET /api/subscriptions/meal-planner-menu`
- `GET /api/subscriptions/addon-choices`
- `PUT /api/subscriptions/:id/days/:date/selection`
- `POST /api/subscriptions/:id/days/:date/selection/validate`
- `POST /api/subscriptions/:id/days/:date/payments`
- `POST /api/subscriptions/:id/days/:date/payments/:paymentId/verify`
- `POST /api/subscriptions/:id/days/:date/confirm`
- `GET /api/dashboard/health/meal-planner`
