# Timeline Planned-Day Investigation

Date: 2026-05-31

## Executive conclusion

Classification: **mixed issue**.

The backend has a real timeline contract bug. `GET /api/subscriptions/:id/timeline`
currently returns `status: "planned"` for an open day whenever at least one meal
is selected. It does this before checking whether the planner is confirmed and
before considering whether payment is still required:

```js
status = normalizedStatus === "open" && meals.selected > 0 ? "planned" : normalizedStatus;
```

Source: `src/services/subscription/subscriptionTimelineService.js`.

The same timeline row also includes more accurate derived fields from
`buildDayCommercialState(dbDay)`, including:

- `commercialState`
- `paymentRequirement.requiresPayment`
- `paymentRequirement.blockingReason`
- `isFulfillable`
- `canBePrepared`

As a result, one backend response can currently say both:

```json
{
  "status": "planned",
  "commercialState": "payment_required",
  "paymentRequirement": {
    "requiresPayment": true
  },
  "isFulfillable": false
}
```

Flutter can also contribute to the visible bug if it treats `status == "planned"`
or non-empty `mealSlots` as enough to render the fully planned state. The backend
must stop returning a misleading `planned` status, and Flutter must use an
explicit confirmation field instead of inferring confirmation from meal slots.

The scoped backend fix was implemented after approval. The timeline now keeps
the legacy `status` field for backward compatibility but only promotes an open
day to `status: "planned"` after explicit confirmation and satisfied commercial
state. Flutter should migrate to `timelineStatus` or `canShowAsPlanned`.

## Safety and QA boundary

`QA_ALLOW_WRITE` was unset during this investigation. No database rows were
created, updated, or deleted. No seeds, reset scripts, payment-provider calls, or
payment bypasses were run.

The pending-payment scenario was verified by static tracing of the actual write
and read paths. Manual QA with controlled QA data remains required after a
scoped fix is approved.

## Endpoints inspected

### Subscription lifecycle

| Endpoint | Purpose | Relevant backend path |
| --- | --- | --- |
| `GET /api/subscriptions` | List the user's subscriptions | `listCurrentUserSubscriptions()` |
| `POST /api/subscriptions/quote` | Quote a subscription purchase | subscription checkout services |
| `POST /api/subscriptions/checkout` | Initialize subscription purchase | `performSubscriptionCheckout()` |
| `GET /api/subscriptions/checkout-drafts/:draftId` | Read subscription checkout state | `getCheckoutDraftStatus()` |
| `POST /api/subscriptions/checkout-drafts/:draftId/verify-payment` | Verify activation or renewal payment | `verifyCheckoutDraftPayment()` |

### Subscription timeline and day planning

| Endpoint | Purpose | Relevant backend path |
| --- | --- | --- |
| `GET /api/subscriptions/:id/timeline` | Mobile calendar/timeline | `getSubscriptionTimeline()` -> `buildSubscriptionTimeline()` |
| `GET /api/subscriptions/:id/days` | Read saved day rows | `getSubscriptionDays()` -> `shapeMealPlannerReadFields()` |
| `GET /api/subscriptions/:id/days/:date` | Read one saved day | `getSubscriptionDay()` -> `shapeMealPlannerReadFields()` |
| `GET /api/subscriptions/:id/today` | Read today's saved day | `getSubscriptionToday()` -> `shapeMealPlannerReadFields()` |
| `POST /api/subscriptions/:id/days/:date/selection/validate` | Validate only; does not save | `performDaySelectionValidation()` |
| `PUT /api/subscriptions/:id/days/:date/selection` | Save canonical `mealSlots` as a draft | `performDaySelectionUpdate()` |
| `PUT /api/subscriptions/:id/days/selections/bulk` | Save multiple draft selections | `updateBulkDaySelectionsForClient()` |
| `POST /api/subscriptions/:id/days/:date/confirm` | Confirm the planned day | `performDayPlanningConfirmation()` |
| `POST /api/subscriptions/:id/days/:date/payments` | Initialize unified premium/add-on day payment | `createUnifiedDayPaymentFlow()` |
| `POST /api/subscriptions/:id/days/:date/payments/:paymentId/verify` | Verify unified day payment | `verifyUnifiedDayPaymentFlow()` |

Legacy premium-extra and one-time add-on day payment endpoints were also
inspected. The unified endpoint is the canonical route for current meal planner
payments.

### One-time orders and provider callbacks

| Endpoint | Purpose | Notes |
| --- | --- | --- |
| `POST /api/orders/quote` | Quote one-time cart | Separate from subscription-day planning |
| `POST /api/orders` | Create a one-time order and initialize payment | Uses `Order.status` and `Order.paymentStatus` |
| `POST /api/orders/:orderId/payments/:paymentId/verify` | Verify one-time order payment | Separate from `SubscriptionDay` |
| `POST /api/webhooks/moyasar` | Receive Moyasar updates | Dispatches paid side effects after validation |
| `GET /api/payments/verify` | Verify redirect payment status | Uses the shared payment flow |
| `GET /payments/success` and `GET /payments/cancel` | Provider return pages | Do not bypass verification |

One-time `Order` rows are not the source of truth for a subscription timeline
day. For subscription-day planning, the relevant persisted records are
`Subscription`, `SubscriptionDay`, and `Payment`.

## Models inspected

| Model | Relevant state |
| --- | --- |
| `Subscription` | `status`: `pending_payment`, `active`, `frozen`, `expired`, `canceled`, `completed` |
| `SubscriptionDay` | operational `status`; `plannerState`; legacy `planningState`; `mealSlots`; `plannerMeta`; `addonSelections`; `premiumExtraPayment` |
| `Payment` | `type`; `status`: `initiated`, `paid`, `failed`, `canceled`, `expired`, `refunded`; `applied`; provider identifiers; snapshot metadata |
| `Order` | one-time order `status`; `paymentStatus`; `paymentId`; provider identifiers |

## Actual backend cycle

### A. Timeline view

Flutter fetches `GET /api/subscriptions/:id/timeline`.

`buildSubscriptionTimeline()` loads the parent `Subscription`, its
`SubscriptionDay` rows, and constructs a row for every date. It calculates meal
counts from `plannerMeta`, legacy planning fields, or persisted slots. It then
sets the legacy timeline `status`.

Current bug: if the operational status is `open` and `meals.selected > 0`, the
timeline status becomes `planned` even if the selection is only a saved draft.

After choosing `status`, the service separately calculates the correct
commercial projection with `buildDayCommercialState(dbDay)`.

### B. Selection validation

Flutter may call:

```text
POST /api/subscriptions/:id/days/:date/selection/validate
```

`performDaySelectionValidation()` builds and validates a draft in memory. It
returns `plannerState: "draft"`, slot details, `paymentRequirement`, and
`commercialState`. It does **not** persist the day.

Expected timeline effect: none.

### C. Selection save

Flutter saves canonical slots with:

```text
PUT /api/subscriptions/:id/days/:date/selection
```

`performDaySelectionUpdate()` validates the canonical slot payload and persists:

- `mealSlots`
- `plannerMeta`
- `plannerState: "draft"`
- `planningState: "draft"` through the compatibility projection
- premium and add-on selections
- `plannerRevisionHash`
- derived premium payment projection

Expected timeline display: `draft`, or `pending_payment` when unpaid extras are
present. It must not display as fully planned.

Current timeline display: `status: "planned"` as soon as any persisted meal is
selected.

### D. Day payment initialization

For payable premium selections or one-time add-ons, Flutter calls:

```text
POST /api/subscriptions/:id/days/:date/payments
```

`createUnifiedDayPaymentFlow()`:

1. Requires an active subscription and an open modifiable day.
2. Recomputes the derived payment requirement.
3. Captures a revision-bound snapshot of payable premium and add-on rows.
4. Creates a Moyasar invoice.
5. Creates a `Payment` row with `type: "day_planning_payment"` and
   `status: "initiated"`.
6. Links `SubscriptionDay.premiumExtraPayment.status = "pending"` when premium
   amount is present.

The planner remains a draft. Starting payment must not confirm the day.

### E. Pending, failed, canceled, or abandoned payment

While payment is pending or abandoned, premium slots and/or add-on rows remain
`pending_payment`. The commercial projection correctly returns:

```json
{
  "commercialState": "payment_required",
  "paymentRequirement": {
    "requiresPayment": true
  },
  "isFulfillable": false,
  "canBePrepared": false
}
```

A failed, canceled, or expired verification updates `Payment.status` and does
not apply paid side effects. The day must remain not planned.

Current gap: the timeline legacy `status` remains `"planned"` because it is
based on selected meal count, not confirmation or payment state.

### F. Successful payment

`verifyUnifiedDayPaymentFlow()` and the Moyasar webhook validate provider
identity, amount, currency, and the saved snapshot. When paid, they dispatch
`applyPaymentSideEffects()`, which settles the exact revision-bound premium and
add-on rows.

After settlement, the derived day becomes:

```json
{
  "commercialState": "ready_to_confirm",
  "paymentRequirement": {
    "requiresPayment": false
  }
}
```

Payment success alone does not confirm the planner. Flutter must still call:

```text
POST /api/subscriptions/:id/days/:date/confirm
```

### G. Explicit confirmation

`performDayPlanningConfirmation()` rebuilds and validates the saved slots. It
rejects confirmation while payment is required and only persists:

```json
{
  "plannerState": "confirmed",
  "planningState": "confirmed"
}
```

after the day is complete and has no pending payable rows.

The correct fully planned condition is therefore explicit day confirmation, not
the existence of selections and not payment success by itself.

## Current response fields returned to Flutter

### Timeline response

`GET /api/subscriptions/:id/timeline` currently includes these useful day fields:

| Field | Current meaning |
| --- | --- |
| `status` | Legacy timeline display status. Currently unsafe for planned-day rendering because selected open drafts are promoted to `planned`. |
| `mealSlots` | Persisted canonical slot selections. Presence means saved selection, not confirmation. |
| `meals.selected` | Saved selected-meal count. Not a confirmation field. |
| `commercialState` | `draft`, `payment_required`, `ready_to_confirm`, or `confirmed`. Accurate payment/confirmation projection. |
| `paymentRequirement.requiresPayment` | Whether payable rows still block confirmation. |
| `paymentRequirement.blockingReason` | Why confirmation is blocked. |
| `paymentRequirement.canCreatePayment` | Whether a day payment can be initialized. |
| `premiumExtraPayment.status` | Premium-extra payment projection: `none`, `pending`, `paid`, `failed`, `expired`, or `revision_mismatch`. |
| `isFulfillable` | True only when planner state is confirmed, commercial state is confirmed, payment is satisfied, and operational day status is open. |
| `canBePrepared` | Mirrors `isFulfillable`. |
| `planningReady` | True for `ready_to_confirm` or `confirmed` when no payment is required. It is not equivalent to fully planned. |
| `hasCustomerSelections` | Whether specified persisted meals exist. It is not equivalent to fully planned. |

`GET /api/subscriptions/:id/days` and
`GET /api/subscriptions/:id/days/:date` expose the same commercial fields through
`shapeMealPlannerReadFields()`.

### Additive timeline fields

The timeline now provides these additive fields:

- `hasSelection`
- `selectionStatus`
- aggregate `paymentStatus`
- `orderStatus`
- `subscriptionStatus`
- `timelineStatus`
- `isPlanned`
- `canShowAsPlanned`
- `canEdit`
- `paymentStateReason`

These fields prevent Flutter from having to infer confirmation from `status`,
meal counts, or slot presence.

## Root cause

### Backend bug

Before the scoped fix, `src/services/subscription/subscriptionTimelineService.js`
promoted an open row to `planned` using only:

```js
meals.selected > 0
```

It ignores:

- `plannerState !== "confirmed"`
- `commercialState === "payment_required"`
- `paymentRequirement.requiresPayment === true`
- `isFulfillable === false`

This is incorrect for saved drafts, pending payment, failed payment, canceled
payment, and abandoned payment.

### Flutter risk

The Flutter repository was not present in this workspace, so the exact widget
condition could not be inspected. The likely decision point is the subscription
timeline UI that consumes `GET /api/subscriptions/:id/timeline`.

Flutter is incorrect if it treats any of these as fully planned:

- `day.status == "planned"` from the current backend
- `day.mealSlots.isNotEmpty`
- `day.meals.selected > 0`
- `day.hasCustomerSelections == true`
- `day.planningReady == true`

`planningReady` may mean “ready for the explicit confirm call,” not confirmed.

## Implemented backend contract

Add these fields to each timeline day while retaining existing fields for
backward compatibility:

```json
{
  "date": "2026-05-29",
  "hasSelection": true,
  "selectionStatus": "draft",
  "paymentStatus": "pending",
  "orderStatus": "none",
  "subscriptionStatus": "active",
  "timelineStatus": "pending_payment",
  "isPlanned": false,
  "canShowAsPlanned": false,
  "canEdit": true,
  "paymentStateReason": "PREMIUM_PAYMENT_REQUIRED"
}
```

### Field rules

| Field | Rule |
| --- | --- |
| `hasSelection` | True when persisted selected slots/meals exist. Validation-only responses may return selections, but timeline remains unchanged until save. |
| `selectionStatus` | `empty` when no persisted selection; `draft` for saved unconfirmed selection; `confirmed` only when planner state is confirmed. A validate-only response may use `validated` in that endpoint response only. |
| `paymentStatus` | `not_required`, `required`, `pending`, `paid`, `failed`, `canceled`, `expired`, or `refunded`. This is an aggregate day-planning payment state, not only the premium projection. |
| `orderStatus` | `none` for subscription days unless a future day-order model is introduced. One-time `Order` rows must not be mixed into subscription timeline state. |
| `subscriptionStatus` | Effective parent subscription state, at minimum `active`, `pending_payment`, `frozen`, `expired`, or `canceled`. |
| `timelineStatus` | `empty`, `draft`, `pending_payment`, `planned`, or `failed`. Operational states such as frozen, skipped, locked, and delivered should remain separately represented by the existing operational `status`. |
| `isPlanned` | True only for explicit confirmed planning that is commercially satisfied and allowed by subscription state. |
| `canShowAsPlanned` | Alias of `isPlanned` for Flutter display intent. |
| `canEdit` | True only when the day is open and the day modification policy permits edits. |
| `paymentStateReason` | Existing commercial blocking reason where applicable, for example `PREMIUM_PAYMENT_REQUIRED`, `ADDON_PAYMENT_REQUIRED`, or `PAYMENT_REVISION_MISMATCH`. |

### Timeline-status derivation

Use this precedence for the additive `timelineStatus`:

```text
if no persisted selection:
  empty
else if latest applicable day payment is failed, canceled, expired, or refunded:
  failed
else if paymentRequirement.requiresPayment or paymentStatus == pending:
  pending_payment
else if plannerState == confirmed
     and commercialState == confirmed
     and subscriptionStatus == active:
  planned
else:
  draft
```

For operational presentation, Flutter must still handle existing operational
states such as `frozen`, `skipped`, `locked`, and `delivered` before normal
planning decoration.

## Exact Flutter condition

Flutter should not show a subscription day as fully planned merely because
`mealSlots` exist or because the legacy timeline `status` says `planned`.

Use the additive backend contract:

```dart
final showPlanned =
    day.timelineStatus == 'planned' || day.canShowAsPlanned == true;

final showPendingPayment =
    day.timelineStatus == 'pending_payment' ||
    day.paymentStatus == 'pending' ||
    day.paymentStatus == 'required';

final showFailed =
    day.timelineStatus == 'failed' ||
    const {'failed', 'canceled', 'expired', 'refunded'}.contains(day.paymentStatus);

final showDraft =
    day.hasSelection == true &&
    !showPlanned &&
    !showPendingPayment &&
    !showFailed;
```

Until the additive contract is deployed, use the existing accurate fields:

```dart
final showPlanned =
    day.commercialState == 'confirmed' &&
    day.isFulfillable == true &&
    day.paymentRequirement?.requiresPayment != true;

final showPendingPayment =
    day.commercialState == 'payment_required' ||
    day.paymentRequirement?.requiresPayment == true;

final showDraft =
    day.mealSlots.isNotEmpty &&
    !showPlanned &&
    !showPendingPayment;
```

Do not use `day.status == "planned"` as the fully planned condition until the
backend legacy mapping is corrected.

## Implemented scoped backend fix

The backward-compatible additive fix in the timeline projection now:

1. Calculate `buildDayCommercialState(dbDay)` before deriving timeline display
   status.
2. Stop promoting any selected open day to `status: "planned"`.
3. Preserve `status: "planned"` only when the persisted planner is explicitly
   confirmed and `commercialState === "confirmed"`.
4. Add `hasSelection`, `selectionStatus`, `subscriptionStatus`,
   `timelineStatus`, `isPlanned`, `canShowAsPlanned`, and `canEdit`.
5. Add aggregate day-level `paymentStatus` and `paymentStateReason`.
6. Keep one-time order status separate. Emit `orderStatus: "none"` for
   subscription days.

The aggregate `paymentStatus` is resolved from the latest applicable
subscription-day payment snapshot for the current planner revision. The timeline
loads only day-planning payment types for the subscription. This covers
add-on-only unified payments without mixing one-time `Order` state into
subscription days. When no applicable payment exists, the response falls back
to the derived commercial payment requirement.

The corrected legacy rule is:

```text
legacy timeline status may become "planned" only when
plannerState == "confirmed" and commercialState == "confirmed"
```

This change does not modify payment-provider behavior.

## Tests added and remaining

`tests/subscriptionTimelinePlanningContract.test.js` adds focused derivation
coverage for:

1. Validate-only selection does not create a timeline day and remains `empty`.
2. Saved complete standard selection with `plannerState: "draft"` returns
   `timelineStatus: "draft"` and does not return fully planned.
3. Saved premium or add-on selection with pending payment returns
   `timelineStatus: "pending_payment"`, `isPlanned: false`, and
   `canShowAsPlanned: false`.
4. Initialized but unpaid day payment remains `pending_payment`.
5. Failed, canceled, expired, and refunded day payments return
   `timelineStatus: "failed"` and never planned.
6. Paid settled rows that are not explicitly confirmed return `draft` or
   ready-to-confirm state, not planned.
7. Confirmed, commercially satisfied day on an active subscription returns
   `timelineStatus: "planned"` and `canShowAsPlanned: true`.
8. Inactive parent subscription never returns `canShowAsPlanned: true`.
Additional integration coverage remains useful for:

1. Add-on-only unified payments exposing the same aggregate payment status as
   premium-containing payments.
2. Existing operational states such as `frozen`, `skipped`, `locked`, and
   `delivered` retaining their operational presentation.

Existing integration coverage already exercises save, timeline slot reads,
payment settlement, and explicit confirmation in
`tests/mealPlanner.integration.test.js`, but it does not protect the misleading
timeline `status: "planned"` mapping.

## Manual QA steps

Run only in an isolated QA environment with `QA_ALLOW_WRITE=true`.

1. Create or use an active QA subscription with a future modifiable day.
2. Fetch `GET /api/subscriptions/:id/timeline`; confirm the day is empty/open.
3. Call `POST /api/subscriptions/:id/days/:date/selection/validate` with valid
   canonical slots. Fetch timeline again. Confirm it is still empty/open.
4. Save a complete standard selection with
   `PUT /api/subscriptions/:id/days/:date/selection`. Fetch timeline. Confirm
   draft, not fully planned.
5. Call `POST /api/subscriptions/:id/days/:date/confirm`. Fetch timeline.
   Confirm planned only after explicit confirmation.
6. On another day, save a selection requiring premium or add-on payment.
   Confirm timeline returns pending payment and not planned.
7. Initialize `POST /api/subscriptions/:id/days/:date/payments`, but do not pay.
   Fetch timeline. Confirm it remains pending payment and not planned.
8. Cancel or abandon the QA payment normally through the provider flow. Fetch
   timeline. Confirm failed/canceled presentation and not planned.
9. Start a new QA payment, complete it through the real provider flow, and
   verify it. Fetch timeline. Confirm ready-to-confirm but not fully planned.
10. Call the explicit confirm endpoint. Fetch timeline. Confirm fully planned.
11. Repeat the pending and paid checks for an add-on-only payable day.

Do not delete data, reset seeds, or manually patch payment statuses during this
QA flow.
