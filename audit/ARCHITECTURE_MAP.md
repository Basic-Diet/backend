# Architecture Map

Entry points:

- `src/index.js`: loads env, validates env, connects Mongo, starts HTTP server, starts jobs, handles shutdown.
- `src/app.js`: creates Express app, configures Helmet, CORS, request IDs, JSON normalization, body limits, health/root/docs, routes, 404, and error handling.
- `src/routes/index.js`: mounts public/auth/client/dashboard/subscription/order/payment/kitchen/courier/admin routes under `/api`.

Primary flows:

- Client auth: `/api/auth` and `/api/app` issue app tokens; `authMiddleware` verifies `app_access` client tokens and re-checks active user state.
- Dashboard auth: `/api/dashboard/auth` issues dashboard tokens; `dashboardAuthMiddleware` re-checks active dashboard users and password-change revocation.
- Subscription planning: client routes call `subscriptionPlanningClientService`, then `subscriptionSelectionService`, canonical planner validation, balance/payment services, and `SubscriptionDay`.
- Checkout/payment: checkout and invoice services create drafts and payments; Moyasar webhook/payment controllers apply payment side effects.
- Operations: dashboard ops routes build queue/action payloads via `opsPayloadService`, `deliveryWorkflowService`, order/subscription-day transition services, and queue normalizers.
- Catalog/menu: seed/catalog services maintain `MenuProduct`, `MenuOptionGroup`, `ProductOptionGroup`, `ProductGroupOption`, shared meal-planner constants, public menu serializers, and dashboard menu builders.

Core data relationships observed:

- `User` owns `Subscription`, `SubscriptionDay`, orders, and account deletion records.
- `Plan`/package selections produce subscription contracts, selected meal counts, selected grams, delivery mode, and balances.
- `SubscriptionDay` carries meal slots, add-ons, premium payment state, fulfillment state, kitchen/courier visibility, and audit context.
- Orders and one-time menu items connect to `Payment`, delivery records, kitchen records, courier actions, notifications, and accounting reports.
- Promotions link to checkout/order/payment totals through promo code usage.
- Activity/audit logs exist for subscription, menu, and admin/ops actions.

Important graph communities:

- Community 3/19/28: checkout, payment, activation, unified day payment.
- Community 14/65: subscription ownership, pickup requests, day transition rules.
- Community 15/67: delivery workflow and ops actions.
- Community 20/85: accounting report/export.
- Community 30/70: auth and token middleware.
