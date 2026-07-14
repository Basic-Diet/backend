# Database Integrity Report

Status: blocked for production.

Reason: no read-only `AUDIT_MONGO_URI` was supplied. No production database queries were executed.

Required read-only checks before release:

| Check | Risk |
|---|---|
| Duplicate subscription days by subscription/date | Double meal entitlement or fulfillment errors |
| Active subscription overlaps per user | Billing/fulfillment confusion |
| Negative balances or credits | Financial/subscription corruption |
| Payments without order/subscription target | Reconciliation gaps |
| Paid orders/subscriptions without payment evidence | Revenue leakage |
| Duplicate payment provider references/idempotency keys | Double activation/credits |
| Multiple active default pickup locations | Same-day delivery branch assignment ambiguity |
| Missing active default pickup location | Same-day delivery branch pickup failure |
| Inactive pickup locations referenced by active days | Ops failure |
| Orphaned references across users/plans/orders/days/deliveries | Broken API serialization |
| Expired OTP/refresh/temp records not cleaned | Security/storage risk |

Recommended next step: run a read-only aggregate script using only `AUDIT_MONGO_URI`; do not run migrations or repairs until anomalies are confirmed with business owners.
