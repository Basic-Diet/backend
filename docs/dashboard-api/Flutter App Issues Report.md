Flutter Mobile App Integration Report
1. Executive Summary

Flutter app path:

/home/hema/Projects/full app/mobile_app-main

Backend path:

/home/hema/Projects/basicdiet145

The Flutter app is already connected to many real backend APIs using Dio/Retrofit. Core flows such as login, OTP registration, token refresh, plans, subscriptions, meal planner, orders, and pickup requests are partially or fully wired. The current integration readiness is approximately 70% based on the previous backend ↔ Flutter review.

After the latest backend fixes, several backend-side blockers have been resolved:

Mobile registration now supports fullName and email.
Dashboard auth and mobile auth remain separate.
Flutter should use /api/auth/* as the canonical mobile auth flow.
PUT /api/client/profile is now available.
GET /api/app/config is now available.
pickupLocationId is optional when there is only one active pickup branch.
Backend docs now clarify payment callback behavior and auth/session contracts.

The remaining work is now mostly on the Flutter side: sending the correct fields, calling the right endpoints, removing hardcoded URLs, wiring incomplete screens, handling auth expiry correctly, improving error parsing, and redacting sensitive logs.

2. Important Backend Contract Updates for Flutter
2.1 Mobile Auth Must Use /api/auth/*

Flutter should use the canonical mobile auth endpoints:

POST /api/auth/login
POST /api/auth/register/request-otp
POST /api/auth/register/verify
POST /api/auth/refresh
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/logout-all

Dashboard auth is intentionally separate and must not be used by Flutter.

/api/app/* is now documented as legacy/alternate and should not be used by new Flutter code unless explicitly required.

2.2 Registration Now Supports fullName and email

Backend now accepts fullName and email in mobile registration.

Request OTP:

POST /api/auth/register/request-otp

Example body:

{
  "phoneE164": "+201110021106",
  "fullName": "Client Name",
  "email": "client@example.com"
}

Verify OTP:

POST /api/auth/register/verify

Example body:

{
  "phoneE164": "+201110021106",
  "otp": "123456",
  "password": "UserStrongPassword123",
  "fullName": "Client Name",
  "email": "client@example.com"
}

Backend behavior:

fullName is optional.
email is optional.
email is normalized lowercase.
Invalid email returns VALIDATION_ERROR.
Duplicate email returns EMAIL_IN_USE.
The response remains backward compatible and includes fullName/email inside user.

Flutter must now pass these fields from the registration UI to the API layer.

2.3 Profile Update Is Now Available

Backend added:

PUT /api/client/profile
Authorization: Bearer <accessToken>

Expected body:

{
  "fullName": "Client Name",
  "email": "client@example.com"
}

Flutter should use this endpoint for profile edit screens.

2.4 App Config Is Now Available

Backend added:

GET /api/app/config

This is a public safe mobile config endpoint. Flutter should use it for app-level public configuration instead of hardcoding values where applicable.

Possible usage:

Support info.
App config.
Safe public settings.
Payment-related public config.
Feature flags if returned by backend.
2.5 Pickup Behavior

Current business has one pickup branch only.

Backend behavior now:

If there is one active pickup branch, pickupLocationId is optional.
Backend auto-selects the only active branch.
If multiple branches exist in the future, pickupLocationId will be required.
If no active pickup branch exists, backend returns VALIDATION_ERROR.

So pickupLocationId is not a blocker now, but Flutter can add it later as future-proofing.

2.6 One-Time Addon Payment Contract

There are two relevant flows.

Canonical planner endpoint
POST /api/subscriptions/:id/days/:date/one-time-addons/payments

This pays for pending add-ons already saved on that day. Body is optional, but Flutter may send:

{
  "successUrl": "https://your-app.example/payment-success",
  "backUrl": "https://your-app.example/payment-cancel"
}
Legacy/direct endpoint
POST /api/subscriptions/:id/addons/one-time

This requires:

{
  "addonId": "...",
  "date": "2026-05-20",
  "successUrl": "https://your-app.example/payment-success",
  "backUrl": "https://your-app.example/payment-cancel"
}

If addonId is missing on the legacy/direct endpoint, backend now returns 422 VALIDATION_ERROR.

Flutter must make sure it is using the correct flow.

3. Flutter Issues Overview
Critical Issues
Registration UI collects fullName/email, but Flutter must ensure they are sent to backend.
Logout clears local storage but does not call backend logout.
Refresh-token failure does not reliably redirect user to login.
Payment callback URLs are hardcoded and inconsistent.
Delivery settings screen is not wired to backend.
High Priority Issues
Phone number normalization is weak.
Error handling assumes response body is always JSON/map.
Dio logger can expose sensitive data.
Profile update screen must use PUT /api/client/profile.
Flutter must use GET /api/app/config where app config/support/settings are currently hardcoded.
Medium Priority Issues
One-time addon payment flow must be clarified and aligned with backend.
Old/duplicate premium payment methods create confusion.
Payment verification flow should be standardized.
Profile menu items should be reviewed and incomplete ones hidden or wired.
Low Priority / Future Proofing
Add optional pickupLocationId support for future multi-branch pickup.
4. Detailed Flutter Issues
Issue 1: Registration does not send all collected user fields
Area

Auth / Registration

Current problem

The Flutter registration screen collects:

fullName
email
phone
password

The previous integration report found that RegisterBloc collects fullName and email, but the active registration request only carried phone data through RegisterUseCaseInput.

Backend is now fixed and accepts fullName/email, so Flutter must update its request flow.

Files to review
lib/presentation/register/register_bloc.dart
lib/domain/usecase/register_usecase.dart
lib/data/data_source/remote_data_source_impl.dart
lib/data/network/app_api.dart
lib/data/request/*
Impact

New users may register successfully but have missing profile data.

Required fix

Pass fullName and email through the full registration chain:

Register Screen
→ RegisterBloc
→ RegisterUseCaseInput
→ Repository
→ RemoteDataSource
→ AppServiceClient
→ Backend
Expected request
{
  "phoneE164": "+201110021106",
  "fullName": "Client Name",
  "email": "client@example.com"
}

Then during verification:

{
  "phoneE164": "+201110021106",
  "otp": "123456",
  "password": "UserStrongPassword123",
  "fullName": "Client Name",
  "email": "client@example.com"
}
Priority

Critical

Owner

Flutter

Issue 2: Flutter logout does not revoke backend session
Area

Auth / Session management

Current problem

Backend supports:

POST /api/auth/logout

But Flutter currently clears local storage only. The previous report identified AppPreferences.logOut() as local-only behavior.

Files to review
lib/app/app_pref.dart
lib/presentation/main/profile/bloc/profile_bloc.dart
lib/data/network/app_api.dart
lib/data/repository/repository.dart
Impact

Refresh tokens may remain valid on the backend until they expire.

Required fix

Add a logout API call before clearing local storage.

POST /api/auth/logout
Authorization: Bearer <accessToken>

Body:

{
  "refreshToken": "<stored-refresh-token>"
}

After the request succeeds or safely fails, clear local session.

Priority

Critical / High

Owner

Flutter

Issue 3: No reliable redirect to login after refresh failure
Area

Auth / Token lifecycle

Current problem

Flutter refresh logic can clear session after refresh failure, but does not reliably navigate to the login screen. The previous report specifically mentioned DioFactory._refreshAndRetry() clears session but does not redirect.

Files to review
lib/data/network/dio_factory.dart
lib/app/app_pref.dart
lib/presentation/resources/routes_manager.dart
Required behavior

If refresh fails because of:

TOKEN_EXPIRED
TOKEN_INVALID
SESSION_REVOKED
AUTH_REQUIRED
REFRESH_TOKEN_INVALID
REFRESH_TOKEN_EXPIRED
401
403

Flutter should:

1. Clear access token.
2. Clear refresh token.
3. Clear cached user/session data.
4. Navigate to login.
5. Show a friendly message.

Suggested message:

Your session has expired. Please log in again.
Priority

High

Owner

Flutter

Issue 4: Payment callback URLs are hardcoded
Area

Payments / Checkout / Redirects

Current problem

The previous report found hardcoded payment URLs in multiple Flutter files, including placeholder URLs such as https://app.example.com/... and deployment-specific URLs.

Backend now documents that Flutter should send successUrl and backUrl, and must not hardcode domains.

Files to review
lib/presentation/main/cart/checkout_screen.dart
lib/presentation/resources/routes_manager.dart
lib/presentation/main/home/subscription-details/subscription_details_screen.dart
lib/presentation/plans/timeline/meal_planner/meal_planner_screen.dart
Impact

Payment may return to:

Wrong environment.
Placeholder website.
Wrong screen.
Web page instead of app.
Broken success/cancel flow.
Required fix

Create a central payment callback URL builder.

Example:

class PaymentCallbackUrls {
  static String subscriptionSuccess(String draftId) {
    // Read from env/config/deep link setup
  }

  static String subscriptionCancel(String draftId) {
    // Read from env/config/deep link setup
  }

  static String orderSuccess(String orderId) {
    // Read from env/config/deep link setup
  }

  static String orderCancel(String orderId) {
    // Read from env/config/deep link setup
  }

  static String dayPaymentSuccess(String subscriptionId, String date) {
    // Read from env/config/deep link setup
  }

  static String dayPaymentCancel(String subscriptionId, String date) {
    // Read from env/config/deep link setup
  }
}
Required rule

No payment URL should be hardcoded inside screens.

Priority

Critical

Owner

Flutter

Issue 5: Delivery settings screen is not wired to backend
Area

Delivery / Pickup / Subscription management

Current problem

The previous report found that:

delivery_settings_screen.dart

is UI-only/TODO despite backend delivery APIs existing.

Files to review
lib/presentation/plans/manage_subscription/delivery_settings/delivery_settings_screen.dart
lib/data/network/app_api.dart
lib/data/repository/repository.dart
lib/domain/usecase/*
Backend endpoints to use
PUT /api/subscriptions/:id/delivery
PUT /api/subscriptions/:id/days/:date/delivery
Required fix

Wire the screen through the normal architecture:

AppServiceClient
→ RemoteDataSource
→ Repository
→ UseCase
→ Bloc/Cubit
→ Screen
Required UI states
Loading.
Success.
Error.
Validation error.
Disabled submit while saving.
Priority

High

Owner

Flutter

Issue 6: Phone number normalization is weak
Area

Auth / Login / Register / OTP

Current problem

Backend expects E.164 format:

+9665...
+2010...

The previous report found Flutter validation is mostly non-empty/length-based.

Files to review
lib/presentation/login/login_bloc.dart
lib/presentation/register/register_bloc.dart
lib/presentation/verify/verify_bloc.dart
Impact

Users entering local phone formats may get backend validation errors.

Examples:

0501234567
501234567
01012345678
Required fix

Add a shared phone normalization utility.

Example behavior:

Saudi:
05xxxxxxxx → +9665xxxxxxxx

Egypt:
010xxxxxxxx → +2010xxxxxxxx

Better option: use a phone parsing package with country selector.

Priority

High

Owner

Flutter

Issue 7: Error handling is not defensive enough
Area

Network / Repository / Error mapping

Current problem

The previous report found the Flutter error mapper casts response data directly as:

Map<String, dynamic>

But backend errors follow:

{
  "ok": false,
  "error": {
    "code": "...",
    "message": "...",
    "details": {}
  }
}

Also, external failures may return HTML/string/non-JSON bodies.

Files to review
lib/data/repository/repository.dart
lib/data/network/dio_factory.dart
Required fix

Make parsing defensive.

Example:

final data = error.response?.data;

if (data is Map<String, dynamic>) {
  final backendError = data["error"];

  if (backendError is Map<String, dynamic>) {
    return Failure(
      backendError["message"]?.toString() ?? "Something went wrong",
    );
  }

  return Failure(
    data["message"]?.toString() ?? "Something went wrong",
  );
}

if (data is String && data.trim().isNotEmpty) {
  return Failure(data);
}

return Failure("Something went wrong. Please try again.");
Must handle
400
401
403
404
409
422
500
network timeout
server down
non-JSON response
Priority

High

Owner

Flutter

Issue 8: Dio logger may expose sensitive data
Area

Security / Logging

Current problem

The previous report found PrettyDioLogger configured with:

requestHeader: true
requestBody: true
responseBody: true

in non-release builds.

Files to review
lib/data/network/dio_factory.dart
Risk

Logs may expose:

Authorization header
accessToken
refreshToken
OTP
password
phone number
email
payment URL
payment token
user profile data
Required fix

Redact sensitive fields or disable full logging.

Fields to redact:

authorization
accessToken
refreshToken
password
otp
phoneE164
email
payment_url
paymentUrl
checkoutUrl
verify_url
Priority

High

Owner

Flutter

Issue 9: Profile edit must use new backend endpoint
Area

Profile

Current problem

Profile update/edit was previously not wired properly. Backend has now added:

PUT /api/client/profile

Files to review
lib/presentation/main/profile/*
lib/data/network/app_api.dart
lib/data/repository/repository.dart
lib/domain/usecase/*
Required fix

Add API method:

@PUT("/api/client/profile")
Future<ProfileResponse> updateClientProfile(
  @Body() UpdateProfileRequest request,
);

Request:

{
  "fullName": "Client Name",
  "email": "client@example.com"
}
UI behavior
Show current profile.
Allow edit.
Validate email.
Save to backend.
Refresh profile after update.
Show success/error message.
Priority

High / Medium

Owner

Flutter

Issue 10: Flutter should use GET /api/app/config
Area

App config / Support / Settings

Current problem

Backend now has:

GET /api/app/config

as a public safe mobile config endpoint.

Flutter should use it where app values are currently hardcoded.

Files to review
lib/data/network/app_api.dart
lib/presentation/main/profile/*
lib/presentation/resources/*
lib/app/constants.dart
Possible values to move to config
support phone
support email
working hours
payment callback base
feature flags
app minimum version
terms/support links
Priority

Medium

Owner

Flutter

Issue 11: One-time addon payment flow must be aligned
Area

Meal planner / Addons / Payment

Current problem

The old report said Flutter called one-time addon payment without body. The backend update clarified there are two flows.

Files to review
lib/data/network/app_api.dart
lib/data/repository/repository.dart
lib/presentation/plans/timeline/meal_planner/*
Required decision

If Flutter is paying for pending add-ons saved on a day, use:

POST /api/subscriptions/:id/days/:date/one-time-addons/payments

Body optional:

{
  "successUrl": "...",
  "backUrl": "..."
}

If Flutter is doing direct legacy addon purchase, use:

POST /api/subscriptions/:id/addons/one-time

Body required:

{
  "addonId": "...",
  "date": "2026-05-20",
  "successUrl": "...",
  "backUrl": "..."
}
Required fix

Remove ambiguity in code by naming methods clearly:

createPendingDayAddonsPayment(...)
createDirectOneTimeAddonPayment(...)
Priority

Medium / High depending on active UI

Owner

Flutter

Issue 12: Old or duplicate premium payment methods create confusion
Area

Meal planner payments

Current problem

The previous report found that old premium payment methods and unified day payment methods may point to similar endpoints, creating confusion.

Files to review
lib/data/network/app_api.dart
lib/data/repository/repository.dart
lib/presentation/plans/timeline/meal_planner/*
Required fix

Choose one canonical flow:

Unified day payment, or
Explicit premium-extra payment endpoint.

Remove, deprecate, or rename old methods so future developers do not call the wrong one.

Priority

Medium

Owner

Flutter

Issue 13: Payment verification strategy is not fully standardized
Area

Payments

Current problem

The backend supports payment redirect and verification helpers. The previous report found Flutter may rely on polling/direct verification and may not consistently use verify_url.

Backend update says verify_url, if present, is a helper for redirect flow, while mobile will likely use direct verify or polling.

Required fix

Pick one official Flutter strategy:

Option A: Direct verify / polling

Flutter opens payment URL, then polls backend or calls verify endpoint after return.

Option B: Backend verify URL

Flutter follows/uses verify_url where returned.

Recommended: use one strategy consistently per payment type and document it in code.

Priority

Medium

Owner

Flutter with backend/product confirmation

Issue 14: Profile menu items may include incomplete features
Area

Profile / Settings / User account

Current problem

The previous report noted that profile update/address/preferences/allergies/goals are not fully wired in Flutter. Backend also left address book/preferences/allergies/goals as not implemented canonical APIs pending product confirmation.

Required fix

Review profile menu items and classify each as:

Working with API
UI-only
Coming soon
Should be hidden
Needs backend/product confirmation
Recommendation

Do not show editable UI for unsupported features unless it is clearly marked as coming soon.

Priority

Medium

Owner

Flutter/Product

Issue 15: pickupLocationId is optional now but should be future-proofed
Area

Pickup / Checkout

Current state

Backend now auto-selects the only active pickup branch. pickupLocationId is optional while there is one branch.

Required Flutter action

Not urgent.

Optional future-proofing:

String? pickupLocationId;

Add it to quote/checkout delivery models later so the app is ready for multiple branches.

Priority

Low

Owner

Flutter

5. Feature-by-Feature Status
Auth
Feature	Backend Status	Flutter Status	Required Action
Login	Ready	Wired	Regression test
Register OTP	Updated	Needs field passing	Send fullName/email
Verify OTP	Updated	Needs field passing	Send fullName/email
Refresh token	Ready	Wired but needs failure handling	Redirect to login on failure
Auth me	Ready	Wired	Confirm parsing user fields
Logout	Ready	Not fully wired	Call backend logout
Logout all	Ready	Optional	Add if UI supports
Profile
Feature	Backend Status	Flutter Status	Required Action
Read profile	Ready	Wired	Regression test
Update profile	New endpoint ready	Needs wiring	Use PUT /api/client/profile
Addresses	Not canonical yet	Unclear/UI likely incomplete	Hide or confirm product
Preferences/allergies/goals	Not canonical yet	Unclear/UI likely incomplete	Hide or confirm product
Subscriptions
Feature	Backend Status	Flutter Status	Required Action
Plans	Ready	Wired	Regression test
Quote	Ready	Wired	Confirm request fields
Checkout	Ready	Wired	Fix callback URLs
Current overview	Ready	Wired	Regression test
Timeline	Ready	Wired	Regression test
Day detail	Ready	Wired	Regression test
Day selection	Ready	Wired	Regression test
Confirm day	Ready	Wired	Regression test
Freeze/skip/cancel	Ready	Partially wired	Test and complete if exposed
Delivery update	Ready	UI not wired	Wire delivery settings
Meal Planner / Addons
Feature	Backend Status	Flutter Status	Required Action
Meal planner menu	Ready	Wired	Regression test
Save selection	Ready	Wired	Regression test
Validate selection	Ready	Wired	Regression test
Confirm day	Ready	Wired	Regression test
Day payment	Ready	Wired	Fix callback URLs
One-time addon payment	Ready but two flows	Needs clarity	Use correct endpoint/body
Orders
Feature	Backend Status	Flutter Status	Required Action
Order menu	Ready	Wired	Regression test
Quote order	Ready	Wired	Regression test
Create order	Ready	Wired	Fix callback URLs
Verify order payment	Ready	Wired	Standardize payment flow
Orders list	Ready	Wired	Regression test
Order detail	Ready	Wired	Regression test
Cancel order	Ready	Wired	Regression test
Config / Support
Feature	Backend Status	Flutter Status	Required Action
App config	New endpoint ready	Needs wiring	Use GET /api/app/config
Settings	Available	Not fully used	Decide usage
Support/legal content	Partially available	Review	Wire or hide
6. Required Flutter Changes Checklist
Auth
 Standardize Flutter on /api/auth/*.
 Do not use dashboard auth.
 Avoid legacy /api/app/* auth unless explicitly required.
 Pass fullName and email in registration.
 Normalize phone number to E.164.
 Call POST /api/auth/logout.
 Redirect to login after refresh failure.
 Parse auth errors by code.
Profile
 Add request model for profile update.
 Add API method for PUT /api/client/profile.
 Add repository/use case/bloc logic.
 Wire profile edit UI.
 Hide unsupported address/preferences/allergies/goals features or mark as coming soon.
Payments
 Remove all hardcoded payment URLs.
 Remove app.example.com.
 Add central payment callback URL builder.
 Decide deep links vs backend callback pages.
 Standardize direct verify/polling strategy.
 Clarify one-time addon payment endpoint usage.
 Rename duplicate/old payment methods.
Delivery
 Wire delivery_settings_screen.dart.
 Add API method for PUT /api/subscriptions/:id/delivery.
 Add API method for PUT /api/subscriptions/:id/days/:date/delivery if day-level edit exists.
 Add loading/success/error states.
 Keep pickupLocationId optional for now.
Config
 Add API method for GET /api/app/config.
 Replace hardcoded support/config values where appropriate.
 Cache config if needed.
 Handle config load failure gracefully.
Error Handling
 Support { ok:false, error:{ code,message,details } }.
 Support { status:false, error/message } if encountered.
 Handle non-JSON errors.
 Handle 401, 403, 409, 422.
 Show user-friendly messages.
Security
 Redact Authorization headers.
 Redact access/refresh tokens.
 Redact OTP/password.
 Redact payment URLs/tokens.
 Disable full body logging for auth/payment APIs.
7. Recommended Implementation Order
Phase 1: Auth and Session Stability

Files:

lib/presentation/register/register_bloc.dart
lib/domain/usecase/register_usecase.dart
lib/data/data_source/remote_data_source_impl.dart
lib/data/network/app_api.dart
lib/data/network/dio_factory.dart
lib/app/app_pref.dart

Tasks:

1. Pass fullName/email in registration.
2. Normalize phone to E.164.
3. Add backend logout call.
4. Add redirect to login on refresh failure.
5. Confirm /api/auth/* is the only mobile auth flow.
Phase 2: Payment URL Cleanup

Files:

lib/presentation/main/cart/checkout_screen.dart
lib/presentation/resources/routes_manager.dart
lib/presentation/main/home/subscription-details/subscription_details_screen.dart
lib/presentation/plans/timeline/meal_planner/meal_planner_screen.dart

Tasks:

1. Remove hardcoded URLs.
2. Remove app.example.com.
3. Create centralized callback URL builder.
4. Decide mobile deep links or backend callback URLs.
5. Apply the same pattern to subscription, order, and day payments.
Phase 3: Profile and App Config

Files:

lib/presentation/main/profile/*
lib/data/network/app_api.dart
lib/data/repository/repository.dart
lib/domain/usecase/*

Tasks:

1. Wire PUT /api/client/profile.
2. Add GET /api/app/config.
3. Replace hardcoded support/config values.
4. Review incomplete profile menu items.
Phase 4: Delivery Settings

Files:

lib/presentation/plans/manage_subscription/delivery_settings/delivery_settings_screen.dart
lib/data/network/app_api.dart
lib/data/repository/repository.dart
lib/domain/usecase/*

Tasks:

1. Add update delivery API method.
2. Add use case/bloc/cubit.
3. Persist delivery changes.
4. Add loading/error/success states.
Phase 5: Meal Planner Payment Cleanup

Files:

lib/data/network/app_api.dart
lib/data/repository/repository.dart
lib/presentation/plans/timeline/meal_planner/*

Tasks:

1. Clarify pending add-ons payment vs direct add-on payment.
2. Rename methods clearly.
3. Remove or deprecate duplicate premium payment methods.
4. Standardize verify/polling behavior.
Phase 6: Error Handling and Security

Files:

lib/data/repository/repository.dart
lib/data/network/dio_factory.dart

Tasks:

1. Harden Dio error parser.
2. Handle non-map responses.
3. Handle auth/session error codes.
4. Redact sensitive logs.
5. Prevent auth/payment details from appearing in console logs.
8. Environment Configuration Notes

Flutter base URL should remain environment-driven.

Local backend on host machine
BASE_URL=http://localhost:3000
Android emulator
BASE_URL=http://10.0.2.2:3000
iOS simulator
BASE_URL=http://localhost:3000
Physical device
BASE_URL=http://192.168.x.x:3000
Production
BASE_URL=https://basicdiet145.onrender.com

Important rule:

No screen should contain hardcoded backend URLs or payment callback URLs.
9. Test Plan for Flutter Team
Auth Tests
 Register with phone, password, full name, and email.
 Confirm fullName/email appear after GET /api/auth/me.
 Confirm profile screen shows the saved name/email.
 Register with invalid email and confirm proper error message.
 Register with duplicate email and confirm proper error message.
 Login with valid credentials.
 Login with invalid credentials.
 Refresh token after access token expiration.
 Force refresh failure and confirm navigation to login.
 Logout and confirm backend logout API is called.
Profile Tests
 Load profile.
 Edit full name.
 Edit email.
 Save profile using PUT /api/client/profile.
 Refresh profile and confirm changes persist.
 Try invalid email and confirm validation error.
 Confirm unsupported profile menu items are hidden or marked coming soon.
Payment Tests
 Subscription checkout sends correct successUrl/backUrl.
 Order checkout sends correct successUrl/backUrl.
 Day payment sends correct successUrl/backUrl.
 No request contains app.example.com.
 No screen contains hardcoded Render URLs.
 Payment success returns user to correct screen.
 Payment cancel/back returns user to correct screen.
 Direct one-time addon payment sends addonId and date if using legacy endpoint.
 Pending day add-ons payment uses canonical planner endpoint correctly.
Delivery Tests
 Open delivery settings screen.
 Load existing delivery data.
 Update subscription-level delivery.
 Update day-level delivery if UI supports it.
 Save changes.
 Reopen screen and confirm changes persisted.
 Show loading state while saving.
 Show error state when backend returns validation error.
Config Tests
 Call GET /api/app/config.
 Confirm config values are parsed.
 Confirm UI uses config where applicable.
 Confirm app still works if config request fails.
Error Handling Tests
 Backend returns 401.
 Backend returns 403.
 Backend returns 409 EMAIL_IN_USE.
 Backend returns 422 VALIDATION_ERROR.
 Backend returns non-JSON error.
 Network timeout.
 Server down.
 Offline mode.
Security Tests
 Authorization header is not printed.
 Access token is not printed.
 Refresh token is not printed.
 Password is not printed.
 OTP is not printed.
 Payment URLs/tokens are not printed.
 Release build has no sensitive network logging.
10. Remaining Backend Notes for Flutter Team

The backend side has already addressed the major Flutter blockers:

fullName/email registration support is implemented.
Mobile and dashboard auth remain separate.
/api/auth/* is documented as canonical for Flutter.
PUT /api/client/profile is implemented.
GET /api/app/config is implemented.
pickupLocationId is optional for a single branch.
One-time addon payment validation is clearer.
Auth/session/logout contracts are documented.

Flutter should not wait for more backend changes for the main fixes listed in this report.

11. Final Conclusion

The backend is now mostly ready for Flutter integration. The remaining work is primarily Flutter-side implementation and cleanup.

Highest priority Flutter tasks:

1. Send fullName/email during registration.
2. Call backend logout before clearing local session.
3. Redirect to login when refresh token fails.
4. Remove hardcoded payment URLs.
5. Wire delivery settings screen to backend.
6. Normalize phone numbers to E.164.
7. Harden error parsing.
8. Redact sensitive network logs.
9. Wire PUT /api/client/profile.
10. Use GET /api/app/config where needed.

Non-blocking or lower priority:

1. Add pickupLocationId for future multi-branch support.
2. Clean duplicate/old premium payment methods.
3. Add address book/preferences/allergies/goals only after product confirmation.
4. Decide whether payment result handling should use deep links or backend callback pages.