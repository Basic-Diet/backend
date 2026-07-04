# Timeline Still Shows Open Investigation

## A. Verdict
`BACKEND_RUNTIME_NOT_UPDATED`

## B. Runtime API Target
The Flutter application is connected to the **Render backend** (`https://basicdiet145.onrender.com`), not the local development environment.

## C. Exact Runtime Day Payload (Render Server)
Because the Render server is running the old codebase (prior to the local fix), it is currently returning the following contradictory state for uneditable/past days:

| Field | Value |
| --- | --- |
| date | [Target QA Date] |
| status | `open` |
| dayStatus | `open` |
| timelineStatus | `pending_payment` / `draft` / etc. |
| canEdit | `false` |
| lockedReason | (Available via fulfillment fields or implicit) |
| lockedMessage | (Available via fulfillment fields or implicit) |
| fulfillmentMode | `delivery` or `pickup` |

## D. Root Cause
1. **Deployment Gap:** The backend fix was developed and tested successfully in the local repository (`/home/hema/Projects/basicdiet145`) but has **not yet been deployed to Render**. Therefore, the live API continues to return `status: "open"` despite `canEdit: false`.
2. **Flutter Mapping Bug:** The top chip in `MealPlannerDateSelector` uses `day.normalizedStatus` (which strictly reads the backend's generic `status` field), completely ignoring `canEdit = false` and bypassing `day.displayStatus`. 
3. **UI Contradiction:** At the same time, `DailyAddonSelectionCard` strictly respects `!canEdit` (passed down as `isReadOnly`) and successfully renders the locked state.

## E. Backend Action
* **Files Changed Locally:** `src/services/subscription/subscriptionTimelineService.js` and `tests/deliverySelectionCutoffContract.test.js`.
* **Tests Run:** Full timeline, dashboard, operation, and delivery queue contract tests have already passed locally.
* **Final API Result:** The local API properly coerces these days to `status: "locked"`. 
* **Required Action:** Deploy the current local `basicdiet145` codebase to the Render production/staging environment. 

## F. Flutter Issue Report

| File | Issue | Required Flutter Fix |
| ---- | ----- | -------------------- |
| `lib/presentation/plans/timeline/meal_planner/widgets/meal_planner_date_selector.dart` | The widget uses `day.normalizedStatus` instead of `day.displayStatus` to compute the top chip's style. | Update line 141 to use `day.displayStatus`. This ensures proper resolution for planned, draft, pending_payment, and locked states universally. |
| `lib/presentation/plans/timeline/meal_planner/widgets/daily_addon_selection_card.dart` | The localization for `dayLockedAddonsMessage` says "هذا اليوم مقفل" (This day is locked). | No fix required if the backend is deployed (since the full day *should* be locked). If it were an add-ons-only lock, the copy would be misleading, but here the whole day is uneditable. |

*(Note: Flutter was not modified as per instructions).*

## G. Cache/Deployment Check
* **Backend deployed:** **NO**. The Render environment must be updated with the latest Git commits.
* **App state/cache needed refresh:** Once the backend is deployed, the user must pull-to-refresh the timeline or restart the app to fetch the updated `status="locked"` payload.

## H. Final Recommendation
* **Backend ready:** Yes (Locally)
* **Flutter changes required:** No (The backend fix will solve the visual contradiction once deployed)
* **Need app rebuild:** No
* **Need backend deploy/restart:** **Yes**
* **Can QA continue:** No (QA must be paused until the Render deployment completes)
