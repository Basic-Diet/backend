# Deployment Checklist

- Rotate exposed MongoDB credentials before any release.
- Confirm `.env` is not committed and no logs contain old credentials.
- Take a production database backup and verify restore procedure.
- Confirm production MongoDB user privileges and network restrictions.
- Verify all required env vars with `validateEnv`.
- Run full release gates on isolated replica-set MongoDB.
- Confirm required indexes in staging/production.
- Run read-only production DB integrity audit.
- Run payment sandbox verification; do not use live charges.
- Verify webhook secrets and replay/idempotency behavior.
- Verify scheduled jobs run in the intended process/replica topology.
- Smoke test production-safe GET endpoints.
- Confirm monitoring, request IDs, logs, and alerting.
- Prepare rollback: previous deploy version, DB backup, env var rollback, and payment webhook rollback plan.
- Do not deploy automatically from this audit branch.
