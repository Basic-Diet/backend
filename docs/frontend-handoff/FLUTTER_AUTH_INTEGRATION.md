# Flutter Auth Integration

This document moved to:

```text
docs/auth/flutter-otp-auth-integration.md
```

Use the canonical auth document there. It describes the implemented mobile/app auth contract:

- OTP only for registration and forgot/reset password.
- Normal login with `phoneE164` + `password`.
- `accessToken` + rotating `refreshToken`.
- `/api/auth/*` endpoints for Flutter auth.

Dashboard auth remains separate under `docs/dashboard-api/`.
