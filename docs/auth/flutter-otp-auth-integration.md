# Flutter OTP/Auth Integration

## Overview

Mobile auth uses OTP only for:

1. First-time registration.
2. Forgot/reset password.

Normal daily login uses:

```text
phoneE164 + password
```

After registration or login, Flutter receives:

- `accessToken`: short-lived JWT for protected API requests.
- `refreshToken`: long-lived opaque token for renewing the session.

Do not request OTP on every app start. Store the refresh token securely and use `/api/auth/refresh` when the access token expires.

## Base URL

Replace this with the deployed API host:

```text
https://api.example.com
```

Local development example:

```text
http://localhost:3000
```

All canonical mobile auth endpoints are mounted under:

```text
/api/auth
```

Dashboard auth is separate and is not documented here.

## Token Storage In Flutter

Use `flutter_secure_storage` for:

```text
accessToken
refreshToken
```

Do not store tokens in `SharedPreferences`.

## Response Envelope

Canonical `/api/auth/*` endpoints use:

```json
{
  "ok": true
}
```

Errors use:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## Endpoints

## 1. Request Registration OTP

Use only when registering a new phone number or when an existing verified phone has no password yet.

```http
POST /api/auth/register/request-otp
Content-Type: application/json
```

Request:

```json
{
  "phoneE164": "+201110021106"
}
```

Success:

```json
{
  "ok": true,
  "status": "otp_sent",
  "phoneE164": "+201110021106",
  "cooldownSeconds": 30
}
```

Errors:

- `INVALID_PHONE`
- `USER_ALREADY_REGISTERED`
- `OTP_RATE_LIMITED`
- `OTP_SEND_FAILED`

## 2. Verify Registration OTP And Create Password

```http
POST /api/auth/register/verify
Content-Type: application/json
```

Request:

```json
{
  "phoneE164": "+201110021106",
  "otp": "123456",
  "password": "UserStrongPassword123",
  "deviceId": "optional-device-id",
  "deviceName": "iPhone 15"
}
```

Success:

```json
{
  "ok": true,
  "status": "registered",
  "accessToken": "jwt_access_token",
  "refreshToken": "secure_refresh_token",
  "expiresIn": 900,
  "refreshExpiresIn": 2592000,
  "user": {
    "id": "user_id",
    "phoneE164": "+201110021106",
    "phoneVerified": true
  }
}
```

Errors:

- `WEAK_PASSWORD`
- `OTP_EXPIRED_OR_INVALID`
- `OTP_VERIFY_FAILED`
- `USER_ALREADY_REGISTERED`

## 3. Login With Phone And Password

Normal login does not use OTP.

```http
POST /api/auth/login
Content-Type: application/json
```

Request:

```json
{
  "phoneE164": "+201110021106",
  "password": "UserStrongPassword123",
  "deviceId": "optional-device-id",
  "deviceName": "iPhone 15"
}
```

Success:

```json
{
  "ok": true,
  "status": "logged_in",
  "accessToken": "jwt_access_token",
  "refreshToken": "secure_refresh_token",
  "expiresIn": 900,
  "refreshExpiresIn": 2592000,
  "user": {
    "id": "user_id",
    "phoneE164": "+201110021106",
    "phoneVerified": true
  }
}
```

Errors:

- `INVALID_PHONE`
- `INVALID_CREDENTIALS`
- `PASSWORD_RESET_REQUIRED`

If `PASSWORD_RESET_REQUIRED` is returned, send the user through forgot/reset password to create a password.

## 4. Refresh Access Token

```http
POST /api/auth/refresh
Content-Type: application/json
```

Request:

```json
{
  "refreshToken": "secure_refresh_token"
}
```

Success:

```json
{
  "ok": true,
  "accessToken": "new_jwt_access_token",
  "refreshToken": "new_secure_refresh_token",
  "expiresIn": 900,
  "refreshExpiresIn": 2592000
}
```

Refresh tokens rotate. Replace the stored refresh token immediately after a successful refresh.

Errors:

- `REFRESH_TOKEN_INVALID`
- `REFRESH_TOKEN_EXPIRED`
- `SESSION_REVOKED`

## 5. Get Current User

```http
GET /api/auth/me
Authorization: Bearer accessToken
```

Success:

```json
{
  "ok": true,
  "user": {
    "id": "user_id",
    "phoneE164": "+201110021106",
    "phoneVerified": true
  }
}
```

Errors:

- `AUTH_REQUIRED`
- `TOKEN_EXPIRED`
- `TOKEN_INVALID`
- `SESSION_REVOKED`

## 6. Logout Current Device

Revokes the submitted refresh token/current session.

```http
POST /api/auth/logout
Authorization: Bearer accessToken
Content-Type: application/json
```

Request:

```json
{
  "refreshToken": "secure_refresh_token"
}
```

Success:

```json
{
  "ok": true,
  "status": "logged_out"
}
```

## 7. Logout All Devices

Revokes all refresh sessions for the current user.

```http
POST /api/auth/logout-all
Authorization: Bearer accessToken
```

Success:

```json
{
  "ok": true,
  "status": "logged_out_all_devices"
}
```

## 8. Forgot Password

Sends an OTP only if the account exists. The response never reveals whether the phone exists.

```http
POST /api/auth/password/forgot
Content-Type: application/json
```

Request:

```json
{
  "phoneE164": "+201110021106"
}
```

Success:

```json
{
  "ok": true,
  "status": "otp_sent_if_account_exists"
}
```

Errors:

- `INVALID_PHONE`
- `OTP_RATE_LIMITED`
- `OTP_SEND_FAILED`

## 9. Reset Password

Verifies OTP, changes the password, and revokes all old refresh sessions.

```http
POST /api/auth/password/reset
Content-Type: application/json
```

Request:

```json
{
  "phoneE164": "+201110021106",
  "otp": "123456",
  "newPassword": "NewStrongPassword123"
}
```

Success:

```json
{
  "ok": true,
  "status": "password_reset"
}
```

Errors:

- `OTP_EXPIRED_OR_INVALID`
- `OTP_VERIFY_FAILED`
- `WEAK_PASSWORD`

## App Startup Flow

```text
1. Read accessToken and refreshToken from flutter_secure_storage.
2. If either token is missing, open Login.
3. Call GET /api/auth/me with accessToken.
4. If /me succeeds, open Home.
5. If /me returns TOKEN_EXPIRED, call POST /api/auth/refresh once.
6. If refresh succeeds, store the new accessToken and refreshToken, retry /me once, then open Home.
7. If refresh fails, clear tokens and open Login.
```

Do not request OTP during app startup.

## Automatic Refresh Flow

For protected requests:

```http
Authorization: Bearer accessToken
```

If the server returns `TOKEN_EXPIRED`:

```text
1. Call POST /api/auth/refresh once.
2. Store the returned accessToken and refreshToken.
3. Retry the original request once.
4. If refresh fails, clear tokens and open Login.
```

Avoid infinite refresh loops.

## Login/Register Flow

Registration:

```text
1. User enters phone.
2. Call POST /api/auth/register/request-otp.
3. User enters OTP and password.
4. Call POST /api/auth/register/verify.
5. Store accessToken and refreshToken.
6. Open Home.
```

Login:

```text
1. User enters phone and password.
2. Call POST /api/auth/login.
3. Store accessToken and refreshToken.
4. Open Home.
```

Forgot password:

```text
1. User enters phone.
2. Call POST /api/auth/password/forgot.
3. User enters OTP and new password.
4. Call POST /api/auth/password/reset.
5. Clear old tokens and open Login.
6. User logs in with the new password.
```

## Error Codes Reference

| Code | Meaning | Flutter Action |
| --- | --- | --- |
| `INVALID_PHONE` | Invalid phone number | Ask user to check phone number |
| `USER_ALREADY_REGISTERED` | User already has verified phone and password | Move to Login |
| `INVALID_CREDENTIALS` | Phone or password is wrong | Show generic login error |
| `WEAK_PASSWORD` | Password is too weak | Ask for stronger password |
| `OTP_RATE_LIMITED` | OTP requests are too frequent | Show wait timer |
| `OTP_SEND_FAILED` | OTP provider send failed | Ask user to retry later |
| `OTP_VERIFY_FAILED` | OTP provider verification failed | Show retry later message |
| `OTP_EXPIRED_OR_INVALID` | OTP expired or invalid | Ask user to retry or request new OTP |
| `REFRESH_TOKEN_INVALID` | Refresh token is unknown/malformed | Clear tokens and open Login |
| `REFRESH_TOKEN_EXPIRED` | Refresh token expired | Clear tokens and open Login |
| `AUTH_REQUIRED` | Missing auth token | Open Login |
| `TOKEN_EXPIRED` | Access token expired | Call `/api/auth/refresh` |
| `TOKEN_INVALID` | Access token invalid | Clear tokens and open Login |
| `SESSION_REVOKED` | Session was revoked | Clear tokens and open Login |
| `PASSWORD_RESET_REQUIRED` | Existing verified user has no password | Open reset password flow |

## Token And Config Details

- Access token field: `accessToken`.
- Refresh token field: `refreshToken`.
- Access token TTL: `ACCESS_TOKEN_EXPIRES_IN` or `JWT_ACCESS_EXPIRES_IN`, default `15m`.
- Response `expiresIn`: `900`.
- Refresh token TTL: `REFRESH_TOKEN_EXPIRES_DAYS`, default `30`.
- Response `refreshExpiresIn`: `2592000` when the default is used.
- Refresh tokens are stored server-side only as HMAC hashes.
- Refresh tokens rotate on refresh.

## OTP Details

- Request field: `phoneE164`.
- OTP field: `otp`.
- OTP length: 6 digits.
- OTP TTL: `OTP_TTL_MINUTES`, default `5`.
- OTP cooldown: `OTP_COOLDOWN_SECONDS`, default `30`.
- Provider: Twilio Verify SMS in normal operation.
- Tests can use guarded OTP test mode and do not call Twilio.

## Legacy Compatibility

Legacy OTP endpoints remain available for older mobile clients:

- `POST /api/app/register`
- `POST /api/app/login`
- `POST /api/auth/otp/verify`
- `GET /api/app/profile`

The canonical Flutter contract is the password + refresh-token flow documented above.

## Simple Flutter Pseudocode

Startup:

```dart
final accessToken = await secureStorage.read(key: 'accessToken');
final refreshToken = await secureStorage.read(key: 'refreshToken');

if (accessToken == null || refreshToken == null) {
  goToLogin();
  return;
}

final meResponse = await api.getMe(accessToken);

if (meResponse.ok) {
  goToHome();
  return;
}

if (meResponse.errorCode == 'TOKEN_EXPIRED') {
  final refreshResponse = await api.refresh(refreshToken);

  if (refreshResponse.ok) {
    await secureStorage.write(key: 'accessToken', value: refreshResponse.accessToken);
    await secureStorage.write(key: 'refreshToken', value: refreshResponse.refreshToken);

    final retryMe = await api.getMe(refreshResponse.accessToken);
    if (retryMe.ok) {
      goToHome();
      return;
    }
  }
}

await secureStorage.delete(key: 'accessToken');
await secureStorage.delete(key: 'refreshToken');
goToLogin();
```

Login:

```dart
final response = await api.login(
  phoneE164: '+201110021106',
  password: 'UserStrongPassword123',
);

if (response.ok) {
  await secureStorage.write(key: 'accessToken', value: response.accessToken);
  await secureStorage.write(key: 'refreshToken', value: response.refreshToken);
  goToHome();
}
```

## Backend Verification Status

- Verified and implemented against backend files on 2026-05-16.
- New canonical endpoints confirmed under `/api/auth`.
- Legacy OTP/app endpoints remain present for backward compatibility.
- Password hashes are stored on `User.passwordHash`.
- Refresh sessions are stored in `RefreshSession` with hashed refresh tokens only.
- Password reset revokes all existing refresh sessions.
- Normal login does not send OTP.

Files updated/inspected:

- `src/routes/auth.js`
- `src/controllers/authController.js`
- `src/services/appTokenService.js`
- `src/services/appPasswordService.js`
- `src/services/refreshSessionService.js`
- `src/services/otpService.js`
- `src/models/User.js`
- `src/models/Otp.js`
- `src/models/RefreshSession.js`
- `src/middleware/auth.js`
- `src/app.js`
- `tests/mobileAuthPasswordRefresh.test.js`
