# Flutter Delivery & Fulfillment Cycle Implementation Handoff

This document details the API contracts, data models, state machines, and business rules governing the subscription delivery and fulfillment lifecycle. It is designed to serve as an implementation-ready guide for mobile application development and Codex integration.

For the Flutter team's screen-by-screen implementation checklist, form control types, select/multi-select options, and exact payload examples, see:
[FLUTTER_TIMELINE_FULFILLMENT_FOR_FRONTEND.md](./FLUTTER_TIMELINE_FULFILLMENT_FOR_FRONTEND.md).

---

## 1. Context & Business Domain Overview

The system supports two root fulfillment methods configured at the subscription level:
1. **Home Delivery (`deliveryMode = "delivery"`)**: Meals are packaged and dispatched via courier dispatch queues to the customer's registered delivery address within a chosen delivery window.
2. **Branch Pickup (`deliveryMode = "pickup"`)**: Meals are picked up directly from a selected branch.

### First Day Fulfillment Override Logic
For customer convenience, the system supports a **First Day Fulfillment Override** during checkout. This allows a subscription with a root `deliveryMode` of `"delivery"` to fulfill its very first day (`Day 1`) as a `"pickup"` from a specific branch.

* **Checkout Mechanism**: When checking out, the client provides `delivery.firstDayFulfillmentOverride` containing the override type and target pickup location ID.
* **Database Representation**:
  * The root subscription is saved with `deliveryMode = "delivery"`.
  * The `SubscriptionDay` record representing **Day 1** is initialized with:
    * `fulfillmentModeOverride = "pickup"`
    * `pickupLocationIdOverride = "<branchId>"`
  * Subsequent days (Day 2+) have:
    * `fulfillmentModeOverride = null`
    * `pickupLocationIdOverride = null`
* **Lifecycle Rules**:
  * **Day 1** operates as a pickup day. The client can fetch pickup availability and submit pickup requests for Day 1.
  * **Day 2+** rejects any pickup availability queries or pickup requests with `INVALID_DELIVERY_MODE` (HTTP 400).
* **Operations & Courier Board Integration**:
  * **Operations List (`GET /api/dashboard/ops/list`)**: Excludes the day from the delivery list when an active pickup request is created, ensuring the kitchen prepares it for branch collection.
  * **Courier Queue (`GET /api/dashboard/courier/queue`)**: Queries by the root `subscription.deliveryMode`. Consequently, Day 1 with a pickup override will not appear in the active delivery route once the pickup request is processed, while subsequent delivery days flow normally.

---

## 2. API Contract Inventory

All endpoints require standard Bearer token authorization: `Authorization: Bearer <JWT>`.

| Endpoint Description | Method | Route Path | Auth |
| :--- | :---: | :--- | :---: |
| **Checkout Subscription** | `POST` | `/api/subscriptions/checkout` | Yes |
| **Unified Day Fulfillment Status** | `GET` | `/api/subscriptions/:id/days/:date/fulfillment/status` | Yes |
| **Get Pickup Availability** | `GET` | `/api/subscriptions/:id/pickup-availability` | Yes |
| **Create Pickup Request** | `POST` | `/api/subscriptions/:id/pickup-requests` | Yes |
| **List Pickup Requests** | `GET` | `/api/subscriptions/:id/pickup-requests` | Yes |
| **Get Pickup Request Status** | `GET` | `/api/subscriptions/:id/pickup-requests/:requestId/status` | Yes |
| **Prepare Pickup (Legacy/Direct)** | `POST` | `/api/subscriptions/:id/days/:date/pickup/prepare` | Yes |
| **Get Pickup Status (Legacy/Direct)** | `GET` | `/api/subscriptions/:id/days/:date/pickup/status` | Yes |
| **Get Subscription Timeline** | `GET` | `/api/subscriptions/:id/timeline` | Yes |

---

## 3. Detailed Endpoint Specifications

### 1. Checkout Subscription
Initiates a subscription checkout draft, optionally specifying a first-day fulfillment override.

* **Path**: `/api/subscriptions/checkout`
* **Method**: `POST`
* **Request Body**:
```json
{
  "planId": "658dc7a1e4b0c53c8a98a002",
  "grams": 200,
  "mealsPerDay": 2,
  "startDate": "2026-07-01",
  "delivery": {
    "type": "delivery",
    "address": {
      "street": "Olaya St",
      "city": "Riyadh",
      "district": "Olaya",
      "building": "12",
      "apartment": "4B",
      "notes": "Deliver after 4 PM"
    },
    "zoneId": "658dc7c2e4b0c53c8a98a011",
    "slot": {
      "slotId": "delivery_slot_1",
      "window": "16:00-18:00",
      "label": "Evening Delivery"
    },
    "firstDayFulfillmentOverride": {
      "type": "pickup",
      "pickupLocationId": "branch_main_override"
    }
  },
  "idempotencyKey": "unique_checkout_key_123"
}
```
* **Success Response (201 Created)**:
```json
{
  "status": true,
  "data": {
    "draftId": "658ddf81e4b0c53c8a98c005",
    "status": "pending_payment",
    "paymentUrl": "https://checkout.moyasar.com/verify/...",
    "breakdown": {
      "basePlanPriceHalala": 60000,
      "deliveryFeeHalala": 1000,
      "vatHalala": 9150,
      "totalHalala": 70150,
      "currency": "SAR"
    }
  }
}
```

---

### 2. Unified Day Fulfillment Status
Returns a compact, polling-friendly status object showing current day fulfillment progress for both pickup and delivery subscriptions.

* **Path**: `/api/subscriptions/:id/days/:date/fulfillment/status`
* **Method**: `GET`
* **Route Params**:
  * `id` (String): Subscription ID
  * `date` (String): Target date (`YYYY-MM-DD`)
* **Success Response (200 OK)**:
```json
{
  "status": true,
  "data": {
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "date": "2026-07-01",
    "deliveryMode": "delivery",
    "fulfillmentModeOverride": "pickup",
    "effectiveFulfillmentMode": "pickup",
    "pickupLocationIdOverride": "branch_main_override",
    "firstDayFulfillmentOverride": true,
    "status": "in_preparation",
    "statusLabel": "Preparing",
    "message": "Kitchen is preparing your meals",
    "nextAction": "poll_pickup_request_status",
    "isTerminal": false,
    "pollingIntervalSeconds": 30,
    "lastUpdatedAt": "2026-06-26T18:00:00.000Z",
    "fulfillmentSummary": {
      "mode": "pickup",
      "title": "Branch Pickup",
      "status": "in_preparation",
      "statusLabel": "Preparing",
      "message": "Kitchen is preparing your meals",
      "nextAction": "poll_pickup_request_status",
      "isEditable": false,
      "isFulfillable": true,
      "planningReady": true,
      "fulfillmentReady": true,
      "lockedReason": null,
      "lockedMessage": null
    },
    "deliveryAddress": null,
    "deliveryWindow": null,
    "deliverySlot": {
      "type": "delivery",
      "slotId": "delivery_slot_1",
      "window": "16:00-18:00",
      "label": "Evening Delivery"
    },
    "pickupLocation": {
      "id": "branch_main_override",
      "name": "Branch Main",
      "address": "Branch St",
      "phone": "+966500000000",
      "city": "Riyadh",
      "district": "Olaya",
      "workingHours": "08:00 - 23:00",
      "latitude": 24.7136,
      "longitude": 46.6753,
      "mapUrl": "https://maps.google.com/..."
    },
    "lockedReason": null,
    "lockedMessage": null,
    "pickupCode": null,
    "pickupCodeIssuedAt": null,
    "planningReady": true,
    "fulfillmentReady": true,
    "isFulfillable": true,
    "canBePrepared": true
  }
}
```

---

### 3. Get Pickup Availability
Returns selectable meal slots, add-ons, and limits eligible for branch pickup on a specific business date.

* **Path**: `/api/subscriptions/:id/pickup-availability`
* **Method**: `GET`
* **Query Params**:
  * `date` (String, Required): Target date (`YYYY-MM-DD`)
  * `includeUnavailable` (Boolean, Optional): Defaults to `false`
  * `includeHistory` (Boolean, Optional): Defaults to `false`
* **Success Response (200 OK)**:
```json
{
  "status": true,
  "data": {
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "date": "2026-07-01",
    "subscriptionDayId": "658ddfa5e4b0c53c8a98e456",
    "remainingMeals": 11,
    "paymentReason": null,
    "wallet": {
      "remainingMeals": 11,
      "availableMeals": 11,
      "reservedMeals": 1,
      "consumedMeals": 0,
      "totalEntitlement": 12
    },
    "summary": {
      "availableCount": 2,
      "unavailableCount": 0,
      "availableSelectableCount": 2,
      "paymentBlockedCount": 0,
      "reservedCount": 0,
      "fulfilledCount": 0,
      "noShowCount": 0,
      "hiddenUnavailableCount": 0,
      "availableMealSlotCount": 2,
      "availableAddonCount": 0,
      "availableSaladCount": 0,
      "availableProteinExtraCount": 0,
      "availableSandwichCount": 0,
      "canCreatePickupRequest": true,
      "canAppendMeals": true,
      "appendLimit": 11,
      "titleAr": "عناصر متاحة للاستلام",
      "titleEn": "Items available for pickup",
      "emptyTextAr": "",
      "emptyTextEn": ""
    },
    "slots": [
      {
        "slotKey": "slot_1",
        "slotIndex": 1,
        "available": true,
        "productName": "Beef Burger",
        "proteinKey": "beef",
        "unavailableReason": null
      }
    ],
    "dayAddons": [],
    "addonSummary": {},
    "pickupItems": [
      {
        "itemId": "slot_1",
        "itemType": "meal",
        "label": "Beef Burger",
        "selectionMode": "independent",
        "availability": {
          "available": true,
          "canSelect": true,
          "state": "available"
        }
      }
    ],
    "sections": [],
    "availableSlotIds": ["slot_1"],
    "unavailableSlotIds": []
  }
}
```
* **Error Response (400 Bad Request - Date 2+ on Delivery Sub)**:
```json
{
  "status": false,
  "error": {
    "code": "INVALID_DELIVERY_MODE",
    "message": "Delivery mode is not pickup"
  }
}
```

---

### 4. Create Pickup Request
Submits a request to lock and prepare selected items for pickup.

* **Path**: `/api/subscriptions/:id/pickup-requests`
* **Method**: `POST`
* **Preferred Request Body (explicit pickup item IDs)**:
```json
{
  "date": "2026-07-01",
  "selectedPickupItemIds": ["slot_1"],
  "idempotencyKey": "pickup_req_idempotency_123"
}
```
* **Legacy fallback body (slot IDs only)**:
```json
{
  "date": "2026-07-01",
  "selectedMealSlotIds": ["slot_1"],
  "idempotencyKey": "pickup_req_idempotency_124"
}
```
* **Legacy count-only body**: Use `mealCount` only when the UI is not selecting explicit items.
```json
{
  "date": "2026-07-01",
  "mealCount": 1,
  "idempotencyKey": "pickup_req_idempotency_125"
}
```
Do not send the same meal slot in both `selectedPickupItemIds` and `selectedMealSlotIds`.
* **Success Response (200 OK)**:
```json
{
  "status": true,
  "data": {
    "requestId": "658de120e4b0c53c8a98f789",
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "subscriptionDayId": "658ddfa5e4b0c53c8a98e456",
    "date": "2026-07-01",
    "mealCount": 1,
    "selectedMealSlotIds": ["slot_1"],
    "selectedPickupItemIds": ["slot_1"],
    "selectedPickupItems": [
      {
        "itemId": "slot_1",
        "itemType": "meal",
        "label": "Beef Burger"
      }
    ],
    "addonCount": 0,
    "itemCount": 1,
    "selectionMode": "pickup_item_ids",
    "currentStep": 2,
    "status": "locked",
    "statusLabel": "Your order is locked",
    "message": "Modification period has ended. Waiting for kitchen.",
    "isReady": false,
    "isCompleted": false,
    "pickupCode": null,
    "pickupCodeIssuedAt": null,
    "fulfilledAt": null,
    "createdAt": "2026-06-26T18:05:00.000Z",
    "creditsReserved": true,
    "idempotent": false,
    "nextAction": "poll_pickup_request_status"
  }
}
```

---

### 5. List Pickup Requests
Retrieves historical and active pickup requests associated with the subscription.

* **Path**: `/api/subscriptions/:id/pickup-requests`
* **Method**: `GET`
* **Query Params**:
  * `date` (String, Optional): Filter by date (`YYYY-MM-DD`)
  * `status` (String, Optional): Filters results. Values: `"all"`, `"active"` (defaults to `"all"`)
* **Success Response (200 OK)**:
```json
{
  "status": true,
  "data": {
    "requests": [
      {
        "requestId": "658de120e4b0c53c8a98f789",
        "subscriptionId": "658ddf9de4b0c53c8a98d123",
        "subscriptionDayId": "658ddfa5e4b0c53c8a98e456",
        "date": "2026-07-01",
        "mealCount": 1,
        "status": "locked",
        "statusLabel": "Your order is locked",
        "message": "Modification period has ended. Waiting for kitchen.",
        "isReady": false,
        "isCompleted": false,
        "pickupCode": null,
        "createdAt": "2026-06-26T18:05:00.000Z"
      }
    ]
  }
}
```

---

### 6. Get Pickup Request Status
Returns the status of a specific pickup request. Useful for tracking prep/readiness progress.

* **Path**: `/api/subscriptions/:id/pickup-requests/:requestId/status`
* **Method**: `GET`
* **Route Params**:
  * `id` (String): Subscription ID
  * `requestId` (String): Pickup Request ID
* **Success Response (200 OK)**:
```json
{
  "status": true,
  "data": {
    "requestId": "658de120e4b0c53c8a98f789",
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "subscriptionDayId": "658ddfa5e4b0c53c8a98e456",
    "date": "2026-07-01",
    "mealCount": 1,
    "selectedMealSlotIds": ["slot_1"],
    "selectedPickupItemIds": ["slot_1"],
    "selectedPickupItems": [
      {
        "itemId": "slot_1",
        "itemType": "meal",
        "label": "Beef Burger"
      }
    ],
    "addonCount": 0,
    "itemCount": 1,
    "selectionMode": "pickup_item_ids",
    "currentStep": 4,
    "status": "ready_for_pickup",
    "statusLabel": "Your order is ready",
    "message": "Use this pickup code at the branch.",
    "isReady": true,
    "isCompleted": false,
    "pickupCode": "9812",
    "pickupCodeIssuedAt": "2026-06-26T18:15:00.000Z",
    "fulfilledAt": null,
    "createdAt": "2026-06-26T18:05:00.000Z",
    "creditsReserved": true,
    "idempotent": false,
    "nextAction": "poll_pickup_request_status"
  }
}
```

---

### 7. Prepare Pickup (Legacy/Direct)
Transitions the targeted subscription day status to `"locked"` and marks `pickupRequested = true` directly on the day. Recommended only for backward-compatible/non-request-based pickup flows.

* **Path**: `/api/subscriptions/:id/days/:date/pickup/prepare`
* **Method**: `POST`
* **Route Params**:
  * `id` (String): Subscription ID
  * `date` (String): Target Date (`YYYY-MM-DD`)
* **Success Response (200 OK)**:
```json
{
  "status": true,
  "data": {
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "date": "2026-07-01",
    "currentStep": 2,
    "status": "locked",
    "statusLabel": "Locked",
    "statusLabelAr": "مغلق",
    "statusLabelEn": "Locked",
    "message": "Day is locked for preparation",
    "messageAr": "اليوم مغلق للتحضير",
    "messageEn": "Day is locked for preparation",
    "pickupRequested": true,
    "nextAction": "poll_pickup_status"
  }
}
```

---

### 8. Get Pickup Status (Legacy/Direct)
Fetches localized direct pickup status and branch info for a day.

* **Path**: `/api/subscriptions/:id/days/:date/pickup/status`
* **Method**: `GET`
* **Success Response (200 OK)**:
```json
{
  "status": true,
  "data": {
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "date": "2026-07-01",
    "currentStep": 2,
    "status": "locked",
    "statusLabel": "Locked",
    "statusLabelAr": "مغلق",
    "statusLabelEn": "Locked",
    "message": "Day is locked for preparation",
    "canModify": false,
    "isReady": false,
    "isCompleted": false,
    "pickupRequested": true,
    "pickupPrepared": false,
    "pickupPreparationFlowStatus": "locked",
    "consumptionState": "not_consumed",
    "fulfillmentMode": "pickup",
    "dayEndConsumptionReason": null,
    "canRequestPrepare": false,
    "requestBlockedReason": "LOCKED",
    "requestBlockedMessage": "Day already locked",
    "pickupLocation": {
      "id": "branch_main_override",
      "name": "Branch Main",
      "address": "Branch St",
      "phone": "+966500000000",
      "city": "Riyadh",
      "district": "Olaya",
      "workingHours": "08:00 - 23:00",
      "latitude": 24.7136,
      "longitude": 46.6753,
      "mapUrl": "https://maps.google.com/..."
    },
    "restaurantHours": {
      "openTime": "00:00",
      "closeTime": "23:59",
      "isOpenNow": true
    },
    "pickupCode": null,
    "pickupCodeIssuedAt": null,
    "fulfilledAt": null
  }
}
```

---

### 9. Get Subscription Timeline
Gets the calendar list of subscription days.

* **Path**: `/api/subscriptions/:id/timeline`
* **Method**: `GET`
* **Success Response (200 OK)**:
```json
{
  "status": true,
  "data": {
    "subscriptionId": "658ddf9de4b0c53c8a98d123",
    "dailyMealsRequired": 2,
    "days": [
      {
        "date": "2026-07-01",
        "day": "Wednesday",
        "month": "July",
        "dayNumber": 1,
        "status": "locked",
        "dayStatus": "in_preparation",
        "statusLabel": "Locked",
        "fulfillmentMode": "pickup",
        "fulfillmentModeOverride": "pickup",
        "pickupLocationIdOverride": "branch_main_override",
        "canEdit": true,
        "planningReady": true,
        "fulfillmentReady": true,
        "isFulfillable": true
      },
      {
        "date": "2026-07-02",
        "day": "Thursday",
        "month": "July",
        "dayNumber": 2,
        "status": "open",
        "dayStatus": "open",
        "statusLabel": "Open",
        "fulfillmentMode": "delivery",
        "fulfillmentModeOverride": null,
        "pickupLocationIdOverride": null,
        "canEdit": true,
        "planningReady": true,
        "fulfillmentReady": true,
        "isFulfillable": true
      }
    ]
  }
}
```

---

## 4. Dart DTO Code Representations

Below are the safe, strongly typed Dart model classes for parsing fulfillment status and pickup responses.

```dart
import 'dart:convert';

class UnifiedFulfillmentStatusResponse {
  final bool status;
  final FulfillmentData? data;

  UnifiedFulfillmentStatusResponse({required this.status, this.data});

  factory UnifiedFulfillmentStatusResponse.fromJson(Map<String, dynamic> json) {
    return UnifiedFulfillmentStatusResponse(
      status: json['status'] ?? false,
      data: json['data'] != null ? FulfillmentData.fromJson(json['data']) : null,
    );
  }
}

class FulfillmentData {
  final String subscriptionId;
  final String date;
  final String deliveryMode;
  final String? fulfillmentModeOverride;
  final String effectiveFulfillmentMode;
  final String? pickupLocationIdOverride;
  final bool firstDayFulfillmentOverride;
  final String status;
  final String statusLabel;
  final String message;
  final String nextAction;
  final bool isTerminal;
  final int? pollingIntervalSeconds;
  final String? lastUpdatedAt;
  final FulfillmentSummary? fulfillmentSummary;
  final DeliveryAddress? deliveryAddress;
  final DeliverySlot? deliverySlot;
  final PickupLocation? pickupLocation;
  final String? lockedReason;
  final String? lockedMessage;
  final String? pickupCode;
  final String? pickupCodeIssuedAt;
  final bool planningReady;
  final bool fulfillmentReady;
  final bool isFulfillable;
  final bool canBePrepared;

  FulfillmentData({
    required this.subscriptionId,
    required this.date,
    required this.deliveryMode,
    this.fulfillmentModeOverride,
    required this.effectiveFulfillmentMode,
    this.pickupLocationIdOverride,
    required this.firstDayFulfillmentOverride,
    required this.status,
    required this.statusLabel,
    required this.message,
    required this.nextAction,
    required this.isTerminal,
    this.pollingIntervalSeconds,
    this.lastUpdatedAt,
    this.fulfillmentSummary,
    this.deliveryAddress,
    this.deliverySlot,
    this.pickupLocation,
    this.lockedReason,
    this.lockedMessage,
    this.pickupCode,
    this.pickupCodeIssuedAt,
    required this.planningReady,
    required this.fulfillmentReady,
    required this.isFulfillable,
    required this.canBePrepared,
  });

  factory FulfillmentData.fromJson(Map<String, dynamic> json) {
    return FulfillmentData(
      subscriptionId: json['subscriptionId'] ?? '',
      date: json['date'] ?? '',
      deliveryMode: json['deliveryMode'] ?? '',
      fulfillmentModeOverride: json['fulfillmentModeOverride'],
      effectiveFulfillmentMode: json['effectiveFulfillmentMode'] ?? '',
      pickupLocationIdOverride: json['pickupLocationIdOverride'],
      firstDayFulfillmentOverride: json['firstDayFulfillmentOverride'] ?? false,
      status: json['status'] ?? '',
      statusLabel: json['statusLabel'] ?? '',
      message: json['message'] ?? '',
      nextAction: json['nextAction'] ?? '',
      isTerminal: json['isTerminal'] ?? false,
      pollingIntervalSeconds: json['pollingIntervalSeconds'],
      lastUpdatedAt: json['lastUpdatedAt'],
      fulfillmentSummary: json['fulfillmentSummary'] != null
          ? FulfillmentSummary.fromJson(json['fulfillmentSummary'])
          : null,
      deliveryAddress: json['deliveryAddress'] != null
          ? DeliveryAddress.fromJson(json['deliveryAddress'])
          : null,
      deliverySlot: json['deliverySlot'] != null
          ? DeliverySlot.fromJson(json['deliverySlot'])
          : null,
      pickupLocation: json['pickupLocation'] != null
          ? PickupLocation.fromJson(json['pickupLocation'])
          : null,
      lockedReason: json['lockedReason'],
      lockedMessage: json['lockedMessage'],
      pickupCode: json['pickupCode'],
      pickupCodeIssuedAt: json['pickupCodeIssuedAt'],
      planningReady: json['planningReady'] ?? false,
      fulfillmentReady: json['fulfillmentReady'] ?? false,
      isFulfillable: json['isFulfillable'] ?? false,
      canBePrepared: json['canBePrepared'] ?? false,
    );
  }
}

class FulfillmentSummary {
  final String mode;
  final String title;
  final String status;
  final String statusLabel;
  final String message;
  final String nextAction;
  final bool isEditable;
  final bool isFulfillable;
  final bool planningReady;
  final bool fulfillmentReady;
  final String? lockedReason;
  final String? lockedMessage;

  FulfillmentSummary({
    required this.mode,
    required this.title,
    required this.status,
    required this.statusLabel,
    required this.message,
    required this.nextAction,
    required this.isEditable,
    required this.isFulfillable,
    required this.planningReady,
    required this.fulfillmentReady,
    this.lockedReason,
    this.lockedMessage,
  });

  factory FulfillmentSummary.fromJson(Map<String, dynamic> json) {
    return FulfillmentSummary(
      mode: json['mode'] ?? '',
      title: json['title'] ?? '',
      status: json['status'] ?? '',
      statusLabel: json['statusLabel'] ?? '',
      message: json['message'] ?? '',
      nextAction: json['nextAction'] ?? '',
      isEditable: json['isEditable'] ?? false,
      isFulfillable: json['isFulfillable'] ?? false,
      planningReady: json['planningReady'] ?? false,
      fulfillmentReady: json['fulfillmentReady'] ?? false,
      lockedReason: json['lockedReason'],
      lockedMessage: json['lockedMessage'],
    );
  }
}

class DeliveryAddress {
  final String? label;
  final String? line1;
  final String? line2;
  final String? district;
  final String? city;
  final String? zoneName;
  final String? formatted;
  final String? street;
  final String? building;
  final String? apartment;
  final String? notes;

  DeliveryAddress({
    this.label,
    this.line1,
    this.line2,
    this.district,
    this.city,
    this.zoneName,
    this.formatted,
    this.street,
    this.building,
    this.apartment,
    this.notes,
  });

  factory DeliveryAddress.fromJson(Map<String, dynamic> json) {
    return DeliveryAddress(
      label: json['label'],
      line1: json['line1'],
      line2: json['line2'],
      district: json['district'],
      city: json['city'],
      zoneName: json['zoneName'],
      formatted: json['formatted'],
      street: json['street'],
      building: json['building'],
      apartment: json['apartment'],
      notes: json['notes'],
    );
  }
}

class DeliverySlot {
  final String type;
  final String slotId;
  final String window;
  final String label;

  DeliverySlot({
    required this.type,
    required this.slotId,
    required this.window,
    required this.label,
  });

  factory DeliverySlot.fromJson(Map<String, dynamic> json) {
    return DeliverySlot(
      type: json['type'] ?? '',
      slotId: json['slotId'] ?? '',
      window: json['window'] ?? '',
      label: json['label'] ?? '',
    );
  }
}

class PickupLocation {
  final String id;
  final String name;
  final String address;
  final String phone;
  final String city;
  final String district;
  final String workingHours;
  final double? latitude;
  final double? longitude;
  final String? mapUrl;

  PickupLocation({
    required this.id,
    required this.name,
    required this.address,
    required this.phone,
    required this.city,
    required this.district,
    required this.workingHours,
    this.latitude,
    this.longitude,
    this.mapUrl,
  });

  factory PickupLocation.fromJson(Map<String, dynamic> json) {
    return PickupLocation(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      address: json['address'] ?? '',
      phone: json['phone'] ?? '',
      city: json['city'] ?? '',
      district: json['district'] ?? '',
      workingHours: json['workingHours'] ?? '',
      latitude: json['latitude'] != null ? (json['latitude'] as num).toDouble() : null,
      longitude: json['longitude'] != null ? (json['longitude'] as num).toDouble() : null,
      mapUrl: json['mapUrl'],
    );
  }
}
```

---

## 5. Common Integration Pitfalls & Error Handling Checklist

### Cutoff Logic & Riyadh Business Date Boundary Rules
* **Crucial Rule**: The restaurant operates on an **Asia/Riyadh** business date boundary.
* A pickup request can only be submitted for the **current KSA business date**.
* Submit requests before daily restaurant locking or preparation hours begin. If the restaurant has closed ordering/preparation for the day, requests will be blocked.

### Error Code Catalog

If an API call fails, the response will follow the standard error structure:
```json
{
  "status": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message describing the issue",
    "details": {}
  }
}
```

| HTTP Status | Error Code | Description / Context |
| :---: | :--- | :--- |
| **400** | `INVALID_DELIVERY_MODE` | Attempting pickup availability or request on a day with no pickup capability (e.g., Day 2+ on an overridden delivery subscription). |
| **400** | `INVALID_DATE` | Date parameters are poorly formatted or query is not for the current day. |
| **409** | `DAY_SKIPPED` | Attempting to request pickup for a day that has been skipped or frozen. |
| **409** | `LOCKED` | The target day is already locked for preparation or already completed. |
| **422** | `INSUFFICIENT_CREDITS` | The subscription's remaining meal balance is less than the requested meal count. |
| **422** | `SUB_INACTIVE` / `SUB_EXPIRED` | The subscription is not active or has passed its validity date range. |
| **422** | `PLANNING_UNCONFIRMED` | Day selections are draft only; they must be confirmed before requesting pickup. |
| **422** | `PREMIUM_PAYMENT_REQUIRED` | Day contains premium selections that have unpaid overages. |

### Polling Optimization Guidelines
For `GET /api/subscriptions/:id/days/:date/fulfillment/status`:
* **Do not poll indefinitely**: Check `isTerminal`. If `isTerminal == true`, stop polling (e.g. status is `fulfilled`, `delivery_canceled`, `skipped`, etc.).
* **Dynamic Polling Intervals**: The server returns `pollingIntervalSeconds`. Use this value to scale back network queries:
  * For active states (`in_preparation`, `out_for_delivery`, `ready_for_pickup`), the endpoint advises **30 seconds**.
  * For non-terminal, non-active states, the endpoint advises **60 seconds**.
  * When `isTerminal` is true, `pollingIntervalSeconds` is `null`.
