# Screen Contract: 11F_MENU_PREVIEW_RELEASE

## 1. Screen Purpose
Provides menu previewing, catalog validation, change diffing, version listing, menu publishing, and rollback capabilities.

## 2. Dashboard Route
`/menu` (Preview & Release tabs)

## 3. Visible UI Requirements
* Mobile Menu Preview frame.
* Version history list showing dates, notes, and publishing operator.
* Validation check panel showing error/warning counts and list of broken dependencies.
* Rollback confirmation modal.
* Release/Publish modal.

### Dashboard UI Note

Rollback can take around 53 seconds. The Dashboard must:
- show an explicit loading state during rollback
- disable the rollback confirmation button after submit
- prevent duplicate rollback requests
- show success/failure feedback after completion
- avoid using a very short client-side timeout for rollback

## 4. Backend Endpoints
* `GET /api/dashboard/menu/preview` (fetches a preview of the draft menu catalog)
* `GET /api/dashboard/menu/versions` (lists version history)
* `GET /api/dashboard/menu/diff` (gets differences between draft and published menu)
* `POST /api/dashboard/menu/publish` (releases/publishes the current draft catalog)
* `POST /api/dashboard/menu/rollback/:versionId` (restores catalog state from a previous snapshot)
* `POST /api/dashboard/menu/validate` (runs semantic checks on catalog integrity)

> [!WARNING]
> The frontend route map lists `/api/dashboard/menu/validation` as the validation endpoint. However, the backend expects `POST /api/dashboard/menu/validate`. The frontend must call the correct `/validate` route, or a routing adjustment is needed on the server.

## 5. Request Parameters
* **Publish/Release (`POST /api/dashboard/menu/publish`):**
  * `notes` (optional, string): Release description.
* **Rollback (`POST /api/dashboard/menu/rollback/:versionId`):**
  * `confirm` (required, boolean, must be `true`)
* **Validate (`POST /api/dashboard/menu/validate`):** No body required.

## 6. Response Fields Required
* **Validate Response (`POST /api/dashboard/menu/validate`):**
  * `status` (boolean): `true` if call succeeded.
  * `data` (object):
    * `ok` (boolean): `true` if menu has no validation errors.
    * `errors` (array of strings): High-priority errors (e.g. required customization group with no options).
    * `warnings` (array of strings): Low-priority warnings (e.g. extra weight price without extra weight unit).
    * `summary` (object): `{ categories, products, groups, options, activeProducts }`
* **Version List Response (`GET /api/dashboard/menu/versions`):**
  * `status` (boolean)
  * `data` (array of version objects):
    * `_id` (string, ObjectId)
    * `status` (string, e.g. `published`, `archived`)
    * `publishedAt` (string, ISO Date)
    * `publishedBy` (string, ObjectId)
    * `notes` (string)

## 7. Status
`PASS_FULL_WITH_PERFORMANCE_NOTE`

All documented Preview & Release endpoints were manually verified in Postman. Rollback works, but it is a long-running operation and should be handled carefully in Dashboard UI.

Manual Postman verification: PASS_FULL_WITH_PERFORMANCE_NOTE.
Automated coverage: existing backend contract tests passed separately; rollback performance should remain monitored.

## 8. Postman Verification

Status: `PASS_FULL_WITH_PERFORMANCE_NOTE`

Verified endpoints:

| Endpoint | Result | Notes |
|---|---|---|
| `POST /api/dashboard/menu/validate` | `PASS` | Returned `ok=true`, no errors, no warnings, and summary counts. |
| `GET /api/dashboard/menu/preview` | `PASS` | Returned dashboard menu preview snapshot for one-time order pickup catalog. |
| `GET /api/dashboard/menu/diff` | `PASS` | Returned `changedCount=0` against last published version. |
| `GET /api/dashboard/menu/versions` | `PASS` | Returned published version history. |
| `POST /api/dashboard/menu/publish` | `PASS` | Created published version `6a34660f81dc6d2512c76f89`. |
| `GET /api/dashboard/menu/versions` after publish | `PASS` | Confirmed new published version appeared in history. |
| `POST /api/dashboard/menu/rollback/:versionId` | `PASS_WITH_PERFORMANCE_NOTE` | Restored catalog from `6a33f7e4da5c4b32e2e8e0e9`. |
| `GET /api/dashboard/menu/versions` after rollback | `PASS` | Confirmed restored version `6a34673e415399d54fc3c91c` appeared in history. |

Rollback restored:

```txt
categories = 10
products = 74
optionGroups = 8
options = 93
productGroups = 35
productGroupOptions = 211
```

Performance note:

Rollback completed successfully but took about 53 seconds in Postman. Dashboard UI should treat rollback as a long-running operation: show a loading state, disable duplicate submissions, prevent double-click rollback, and use a request timeout high enough for rollback.

