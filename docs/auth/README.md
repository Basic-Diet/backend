# Auth Documentation

This folder contains mobile/app authentication documentation, including registration OTP, password login, refresh-token sessions, token storage, and Flutter integration notes.

Current primary Flutter auth document:

- [flutter-otp-auth-integration.md](flutter-otp-auth-integration.md)

Existing verified mobile users who do not yet have `passwordHash` are not silently locked out:

- `POST /api/auth/login` returns `PASSWORD_RESET_REQUIRED`.
- The user should use the forgot/reset password flow to create a password.
- After reset, normal `phoneE164` + `password` login works.

Dashboard authentication is separate. Dashboard auth docs live under `docs/dashboard-api/` and use the dashboard API contract, not the mobile/app auth contract in this folder.
