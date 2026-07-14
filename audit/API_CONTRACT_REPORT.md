# API Contract Report

Confirmed contract fixes:

- Removed `qa_premium_protein` from runtime premium meal contracts and seed catalog.
- Public menu serializers now enforce shared `CUSTOMER_VISIBLE_CARB_KEYS` and `STANDARD_MEAL_PROTEIN_KEYS`.
- Kitchen queue normalization preserves hydrated explicit meal slots and Arabic salad/add-on names.
- Legacy root selection payloads now return `422 LEGACY_DAY_SELECTION_UNSUPPORTED` instead of generic `400 VALIDATION_ERROR`.

Production safe checks:

- `/` returned `200` with backend running JSON.
- `/health` returned `200` and DB state `up`.
- Unknown `/api/__audit_unknown_route__` returned JSON 404 with `NOT_FOUND`.
- CORS preflight from `https://example.invalid` returned 403 JSON `CORS`.
- `/api/settings` returned public settings JSON.
- `/api-docs/swagger.json` is public and returns OpenAPI JSON.

Risks:

- Public docs exposure may be intentional, but should be an explicit production decision.
- Authenticated mobile/dashboard contract checks were not run against production.
- Mongo-backed contract tests were skipped without a safe local test DB.
