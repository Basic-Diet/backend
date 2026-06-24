# Screen Contract: 03_ACCOUNTING

## 1. Status

`BACKEND_READY_DASHBOARD_PENDING`

العقد الخلفي جاهز. لم تُعدّل واجهة Dashboard ضمن هذا العمل، لذلك لا يعني هذا التصنيف أن عناصر الشاشة الجديدة مطبقة في الواجهة.

## 2. Screen purpose

شاشة **المحاسبة** تعرض تقرير يوم العمل للطلبات أحادية المرة، التحصيل، ضريبة القيمة المضافة المملوكة للخلفية، والخصومات التشغيلية اليدوية للاشتراكات. التقرير للقراءة فقط وليس دفتر أستاذ محاسبيًا كاملًا.

## 3. Backend ownership rules

- Backend هو مصدر الحقيقة الوحيد لكل إجمالي.
- كل قيمة مالية في API بوحدة `halala` والعملة `SAR`.
- تعرض الواجهة الريال فقط: `SAR = halala / 100`؛ مثال `1500 = 15.00 ر.س`.
- لا تجمع الواجهة الصفوف ولا تعيد حساب الضريبة أو الصافي.
- الخصم اليدوي حدث استهلاك تشغيلي وليس إيرادًا جديدًا.
- الإضافات منفصلة عن الوجبات، والوجبات المميزة منفصلة عن العادية.

## 4. Frontend implementation status

لم تُعدّل الواجهة في هذه المهمة. على الواجهة استهلاك الحقول الجديدة تدريجيًا مع إبقاء دعم الحقول القديمة الموضحة أدناه.

## 5. Active endpoints

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET | `/api/dashboard/accounting/daily-report` | تقرير يوم العمل بصيغة JSON | `admin`, `superadmin` |
| GET | `/api/dashboard/accounting/daily-report/export` | نفس التقرير بصيغة CSV | `admin`, `superadmin` |

`cashier` و`kitchen` و`courier` غير مسموح لهم. لا يوجد دور branch مستقل في النظام.

## 6. Endpoint details

### GET /api/dashboard/accounting/daily-report

#### Purpose

إرجاع تقرير محاسبي وتشغيلي ليوم عمل واحد. تبدأ وتنتهي نافذة اليوم حسب إعدادات المطعم وفي المنطقة `Asia/Riyadh`.

#### Auth

Roles:

- `admin`
- `superadmin` (يمر تلقائيًا عبر middleware الأدوار)

#### Query params

| Param | Type | Required | Frontend control | Options | Default | Notes |
|---|---|---:|---|---|---|---|
| `date` | string | Yes | date | `YYYY-MM-DD` | — | تاريخ يوم العمل؛ تحقق صارم |
| `fulfillmentMethod` | string | No | select | `all`, `pickup`, `delivery` | `all` | يرشح الطلبات والخصومات اليدوية |
| `includeDetails` | boolean | No | switch | `true`, `false` | `true` | الافتراضي القديم محفوظ للتوافق؛ استخدم `false` للملخص الخفيف |

`fromDate` و`toDate` و`timezone` غير مدعومة. لا ترسلها الواجهة.

#### Request example

```http
GET {{baseUrl}}/api/dashboard/accounting/daily-report?date=2026-06-24&fulfillmentMethod=all&includeDetails=true
Authorization: Bearer <dashboardToken>
```

#### Success response example

```json
{
  "status": true,
  "data": {
    "date": "2026-06-24",
    "businessDate": "2026-06-24",
    "filters": {
      "date": "2026-06-24",
      "fromDate": null,
      "toDate": null,
      "fulfillmentMethod": "all",
      "includeDetails": true
    },
    "currency": "SAR",
    "moneyUnit": "halala",
    "period": {
      "start": "2026-06-23T21:00:00.000Z",
      "end": "2026-06-24T20:59:59.999Z"
    },
    "summary": {
      "grossRevenueHalala": null,
      "netRevenueHalala": 8620,
      "discountsHalala": 0,
      "refundsHalala": null,
      "deliveryFeesHalala": 0,
      "taxHalala": 1380,
      "totalCollectedHalala": 10000,
      "ordersCount": 1,
      "subscriptionsCount": null,
      "refundsCount": null,
      "manualDeductionsCount": 0,
      "grossSalesHalala": 10000,
      "netSalesHalala": 8620,
      "vatHalala": 1380
    },
    "breakdown": {
      "oneTimeOrders": {
        "count": 1,
        "grossRevenueHalala": null,
        "netRevenueHalala": 8620,
        "discountsHalala": 0,
        "refundsHalala": null
      },
      "subscriptions": {
        "count": null,
        "grossRevenueHalala": null,
        "netRevenueHalala": null,
        "discountsHalala": null,
        "refundsHalala": null
      },
      "delivery": { "ordersCount": 0, "revenueHalala": null, "feesHalala": 0 },
      "pickup": { "ordersCount": 1, "revenueHalala": null, "feesHalala": 0 },
      "manualDeductions": {
        "regularMeals": 0,
        "premiumMeals": 0,
        "addons": [],
        "totalActions": 0
      }
    },
    "details": {
      "orders": [],
      "subscriptions": [],
      "refunds": [],
      "manualDeductions": []
    },
    "generatedAt": "2026-06-24T12:00:00.000Z"
  }
}
```

القيم أعلاه مثال بنيوي فقط وليست أرقام إنتاج. القيم الفعلية تأتي من Backend.

#### Response fields

| Field | Type | Nullable | Frontend display | Notes |
|---|---|---:|---|---|
| `data.date` | string | No | تاريخ التقرير | alias إضافي لـ`businessDate` |
| `data.businessDate` | string | No | تاريخ التقرير | حقل قديم محفوظ |
| `data.filters` | object | No | حالة الفلاتر | الفلاتر المطبقة فعليًا |
| `data.currency` | string | No | العملة | دائمًا `SAR` |
| `data.moneyUnit` | string | No | — | دائمًا `halala` |
| `data.summary.totalCollectedHalala` | integer | No | إجمالي المحصل | إجمالي الطلبات أحادية المرة ذات `paymentStatus=paid` |
| `data.summary.netRevenueHalala` | integer | No | صافي الإيرادات | `totalCollectedHalala - taxHalala`؛ لا يمثل ربحًا تجاريًا |
| `data.summary.grossRevenueHalala` | null | Yes | غير متاح | غير معرّف بأمان عبر كل مصادر الإيراد الحالية |
| `data.summary.refundsHalala` | null | Yes | غير متاح | لا يوجد Refund ledger/model |
| `data.breakdown` | object | No | البطاقات | تفصيل إضافي ثابت |
| `data.details` | object | No | الجداول | المصفوفات فارغة عند `includeDetails=false` |
| `data.oneTimeOrders`, `money`, `subscriptions`, `operations`, `reconciliation`, `warnings` | object/array | No | توافق قديم | لم تُحذف ولم يتغير معناها |

#### Detail DTOs

طلب أحادي المرة:

```json
{
  "id": "...",
  "orderId": "...",
  "orderNumber": "ORD-001",
  "customerName": "Customer Name",
  "customerPhone": "+966...",
  "fulfillmentMethod": "delivery",
  "status": "fulfilled",
  "paymentStatus": "paid",
  "subtotalHalala": 0,
  "discountHalala": 0,
  "deliveryFeeHalala": 0,
  "taxHalala": 0,
  "totalHalala": 0,
  "createdAt": "2026-06-24T10:00:00.000Z"
}
```

خصم يدوي:

```json
{
  "id": "...",
  "activityLogId": "...",
  "subscriptionId": "...",
  "customerName": "Customer Name",
  "customerPhone": "+966...",
  "regularMeals": 1,
  "premiumMeals": 0,
  "addons": [{ "addonId": "...", "name": { "ar": "عصير", "en": "Juice" }, "qty": 1 }],
  "reason": "branch_pickup",
  "actor": { "id": "...", "name": "admin@example.com", "role": "admin" },
  "createdAt": "2026-06-24T10:00:00.000Z"
}
```

#### Error responses

```json
{
  "ok": false,
  "status": false,
  "message": "date must be a valid YYYY-MM-DD business date",
  "messageAr": "صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD",
  "error": {
    "code": "INVALID_DATE",
    "message": "date must be a valid YYYY-MM-DD business date",
    "messageAr": "صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD"
  }
}
```

#### Frontend notes

أرسل الفلاتر إلى Backend. لا تطبق فلترة مالية محلية. استخدم `details` للشكل الموحد، مع إمكانية دعم العقد القديم أثناء الانتقال.

### GET /api/dashboard/accounting/daily-report/export

#### Purpose

تنزيل CSV مبني من نفس خدمة التقرير ونفس فلتر التاريخ وطريقة التنفيذ.

#### Auth

Roles:

- `admin`
- `superadmin`

#### Query params

| Param | Type | Required | Frontend control | Options | Default | Notes |
|---|---|---:|---|---|---|---|
| `date` | string | Yes | date | `YYYY-MM-DD` | — | نفس تاريخ الشاشة |
| `fulfillmentMethod` | string | No | select | `all`, `pickup`, `delivery` | `all` | نفس فلتر الشاشة |
| `includeDetails` | boolean | No | switch | `true`, `false` | — | التصدير يجلب التفاصيل دائمًا حاليًا |
| `format` | string | No | hidden/select | `csv` | `csv` | غير `csv` يعيد 400 |

#### Request example

```http
GET {{baseUrl}}/api/dashboard/accounting/daily-report/export?date=2026-06-24&fulfillmentMethod=all&format=csv
Authorization: Bearer <dashboardToken>
```

#### Success response example

```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="daily-accountant-report-2026-06-24.csv"
```

#### Response fields

| Field | Type | Nullable | Frontend display | Notes |
|---|---|---:|---|---|
| body | CSV text | No | تنزيل ملف | UTF-8 sectioned CSV |

#### Error responses

```json
{
  "ok": false,
  "status": false,
  "message": "Only csv export is currently supported",
  "messageAr": "صيغة التصدير غير مدعومة. الصيغة المتاحة هي csv"
}
```

#### Frontend notes

استخدم نفس `date` و`fulfillmentMethod` المعروضين على الشاشة. لا تعد إنشاء CSV في الواجهة.

## 7. Filters and UI controls

| Field | Arabic UI label | Control | Options | Required |
|---|---|---|---|---:|
| `date` | التاريخ | date | `YYYY-MM-DD` | Yes |
| `fromDate` | من تاريخ | date | غير مدعوم حاليًا | No |
| `toDate` | إلى تاريخ | date | غير مدعوم حاليًا | No |
| `fulfillmentMethod` | طريقة التنفيذ | select | `all=الكل`, `pickup=استلام من الفرع`, `delivery=توصيل` | No |
| `includeDetails` | عرض التفاصيل | switch | `true=عرض التفاصيل`, `false=ملخص فقط` | No |
| `format` | صيغة التصدير | hidden/select | `csv=CSV` | Export only |
| `export` | تصدير التقرير | button | — | No |

التاريخ `YYYY-MM-DD`. التاريخ والوقت المرجع من Backend بصيغة ISO، وتوطّنه الواجهة للعرض فقط.

## 8. Tables and cards

- البطاقات: إجمالي المحصل، صافي الإيراد قبل الضريبة، الضريبة، الخصومات، رسوم التوصيل، عدد الطلبات، والخصومات اليدوية.
- لا تعرض بطاقة `grossRevenueHalala` أو refunds كرقم عندما تكون `null`؛ اعرض **غير متاح**.
- الجداول: الطلبات أحادية المرة والخصومات اليدوية عند طلب التفاصيل.
- لا توجد حاليًا صفوف تفاصيل موثوقة لإيراد الاشتراكات أو الاستردادات.

## 9. Response DTO reference

مصادر البيانات الفعلية:

| Domain | Source | Included |
|---|---|---|
| One-time orders | `Order` | Yes |
| Linked payment metadata | `Payment` | Yes، عند الربط بالطلب |
| Subscription payments | `Payment` | No؛ لتجنب احتساب خاطئ/مزدوج |
| Manual deductions | `ActivityLog.meta` | Yes، بما فيها `deductedAddons` |
| Refunds | لا يوجد `Refund` model | لا؛ الحقول الجديدة `null` والتفاصيل فارغة |
| VAT | `src/config/vat.js` + snapshots المخزنة | Yes، 16% inclusive للـlegacy fallback |

`refundedOrdersCount` و`refundedTotalHalala` حقول قديمة مبنية على `Order.paymentStatus=refunded`، وليست Refund ledger. لا تستخدمها الواجهة كدليل تسوية بنكية.

## 10. Export CSV contract

الأقسام والعناوين الإنجليزية محفوظة للتوافق:

- `Report`: `field,value`
- `Summary`: `metric,value`
- `Money`: `metric,value`
- `One-Time Orders`: `orderId,orderNumber,createdAt,customerName,customerPhone,status,paymentStatus,fulfillmentMethod,totalHalala,netHalala,vatHalala,currency,paymentMethod`
- `Manual Subscription Deductions`: `activityLogId,subscriptionId,customerId,customerName,customerPhone,fulfillmentMethod,businessDate,regularMeals,premiumMeals,totalMeals,actorId,actorName,actorRole,reason,notes,createdAt`
- `Warnings`: `code,message,count`

لا يوجد `locale=ar` حاليًا. `Content-Type` هو `text/csv; charset=utf-8`، والاسم `daily-accountant-report-<date>.csv`.

## 11. Error responses

| HTTP | Code | Arabic UI message |
|---:|---|---|
| 400 | `INVALID_DATE` | صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD |
| 400 | `INVALID_FULFILLMENT_METHOD` | طريقة التنفيذ غير صحيحة |
| 400 | `INVALID_INCLUDE_DETAILS` | قيمة عرض التفاصيل غير صحيحة |
| 400 | `UNSUPPORTED_EXPORT_FORMAT` | صيغة التصدير غير مدعومة |
| 401 | `UNAUTHORIZED` | يرجى تسجيل الدخول لعرض تقرير المحاسبة |
| 403 | `FORBIDDEN` | ليس لديك صلاحية لعرض تقرير المحاسبة |

أخطاء المصادقة تحتفظ بشكل المنصة العام `{ ok:false, error:{...} }`؛ `messageAr` الإضافي مضمون حاليًا لأخطاء تحقق المحاسبة.

## 12. Business rules

- `totalCollectedHalala`: مجموع إجمالي الطلبات أحادية المرة التي حالتها المالية `paid` داخل نافذة يوم العمل.
- `taxHalala`: مجموع VAT المخزن لكل طلب؛ للصفوف القديمة ذات الإجمالي فقط يستخرج Backend VAT inclusive حسب الإعداد البرمجي.
- `netRevenueHalala = totalCollectedHalala - taxHalala`.
- `grossRevenueHalala=null` لأن تعريف gross موحدًا عبر المنتجات والخصومات ورسوم التوصيل والاشتراكات غير مضمون حاليًا.
- رسوم التوصيل والخصومات حقول مستقلة ولا تعاد إضافتها إلى التحصيل.
- لا تدخل مدفوعات الاشتراك في التقرير الحالي، ولا يحوّل استهلاك الوجبات اليومي إلى إيراد.
- الخصومات اليدوية عمليات أرصدة وليست مبالغ.

## 13. Arabic UI labels

`المحاسبة`، `تقرير اليوم`، `تاريخ التقرير`، `طريقة التنفيذ`، `الكل`، `توصيل`، `استلام من الفرع`، `عرض التفاصيل`، `إخفاء التفاصيل`، `تصدير CSV`، `إجمالي الإيرادات`، `صافي الإيرادات`، `إجمالي الخصومات`، `إجمالي الاستردادات`، `رسوم التوصيل`، `الطلبات`، `الاشتراكات`، `الخصومات اليدوية`، `الوجبات العادية`، `الوجبات المميزة`، `الإضافات`، `لا توجد بيانات محاسبية لهذا التاريخ`، `تعذر تحميل تقرير المحاسبة`، `صيغة التاريخ غير صحيحة`، `ليس لديك صلاحية لعرض تقرير المحاسبة`.

## 14. Frontend checklist

- [ ] إرسال التاريخ وطريقة التنفيذ إلى Backend.
- [ ] إرسال `includeDetails=false` للملخص الخفيف أو `true` للجداول.
- [ ] عرض halala بالريال بالقسمة على 100 فقط.
- [ ] عدم إعادة حساب summary أو VAT.
- [ ] التعامل مع القيم `null` كـ **غير متاح** وليس صفرًا.
- [ ] استخدام نفس الفلاتر عند التصدير.
- [ ] عرض رسائل الأخطاء العربية.
- [ ] عدم منح cashier/courier/kitchen وصولًا للشاشة.

## 15. Unsupported / future features

- نطاق `fromDate/toDate`.
- اختيار timezone؛ التقرير يستخدم `Asia/Riyadh`.
- Refund ledger وتفاصيل refund حقيقية.
- إدخال مدفوعات الاشتراكات في الإيراد وفق سياسة اعتراف محاسبي معتمدة.
- تعريف gross revenue موحد وفصل product revenue بصورة مضمونة لكل legacy rows.
- CSV عربي أو `locale=ar`.
- فلاتر payment method أو status مستقلة.
