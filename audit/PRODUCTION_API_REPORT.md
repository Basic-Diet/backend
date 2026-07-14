# Production API Report

Base URL: `https://basicdiet145-production-51e9.up.railway.app`

Safe checks performed:

| Request | Result |
|---|---|
| `GET /` | `200`, JSON backend running message |
| `GET /health` | `200`, DB state up |
| `GET /api/settings` | `200`, public settings |
| `GET /api/__audit_unknown_route__` | `404`, JSON `NOT_FOUND` |
| `OPTIONS /api/settings` with disallowed Origin | `403`, JSON `CORS` |
| `GET /api-docs/swagger.json` | `200`, OpenAPI JSON |

Headers observed:

- Helmet-style security headers present, including HSTS, CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options.
- `X-Request-Id` present.
- Server header exposes Railway edge only.

Not performed:

- Authenticated requests.
- Mutations.
- Payment provider calls.
- Load/stress/fuzz testing.
- Production DB queries.

Production concerns:

- Public Swagger JSON is exposed; confirm this is intentional.
- Public `/api/settings` includes business configuration and contact/location defaults; confirm desired exposure.
