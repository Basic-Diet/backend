# Handover Checklist

Run locally:

- Install: `npm ci`
- Start: set required env vars, then `npm start`
- Unit baseline: `npm test`
- Full local harness: `MONGO_URI=<isolated_test_uri> npm run test:all`
- Release gates: `MONGO_URI_TEST=<isolated_test_uri> npm run test:release-gates`

Database requirements:

- MongoDB for normal operation.
- Replica set required for transaction-dependent tests.
- Test database names must contain `test`, `local`, or `ci`; runners now refuse unsafe names.

Admin creation:

- Use the existing dashboard account scripts only with reviewed env vars and non-production dry-run where available.
- Do not use shared/default credentials in production.

Operations:

- Scheduled jobs start from `src/index.js` through `startJobs()`.
- Payment/webhook configuration must use production secrets only in production and sandbox secrets in staging.
- Logs include request IDs; avoid logging tokens, passwords, OTPs, or database URIs.

Known limitations:

- Production DB integrity was not audited in this pass.
- Full Mongo-backed release gates were not run in this environment.
- Moderate dependency advisories remain through `firebase-admin`.
- Public API docs exposure needs explicit product/security sign-off.

Emergency rollback:

- Disable new deploy.
- Restore previous Railway deployment/version.
- Rotate affected secrets.
- Restore DB from verified backup only if data corruption is confirmed and repair is approved.
