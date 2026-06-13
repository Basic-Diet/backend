# خطة اختبار دورة عمليات BasicDiet عبر Postman

## الاستيراد والتجهيز
1. افتح Postman ثم Import.
2. استورد الملف: `postman/BasicDiet_Operations_Lifecycle.postman_collection.json`.
3. استورد البيئة: `postman/BasicDiet_Local.postman_environment.json`.
4. اختر بيئة `BasicDiet Local` قبل التشغيل.

## المتغيرات التي يجب تعبئتها
- `baseUrl`: الافتراضي هو `https://basicdiet145.onrender.com`. غيّره إلى السيرفر المحلي عند الحاجة.
- `dashboardToken`: توكن لوحة التحكم العام للفحوصات المقروءة.
- `adminToken`: توكن لوحة تحكم بدور admin أو superadmin. مطلوب لمعظم انتقالات الاشتراك والخصم اليدوي.
- `courierToken`: توكن courier لاختبارات التوصيل.
- `kitchenToken`: توكن kitchen لاختبارات الاستلام من الفرع.
- `clientToken`: توكن تطبيق عميل حقيقي لاختبار إنشاء طلبات الاستلام.
- `testDate`: تاريخ الاختبار بصيغة YYYY-MM-DD.
- `dateDay1` و `dateDay2`: اختياريان لاختبارات قواعد اليوم الأول/الأيام اللاحقة.
- `customerPhone`: رقم عميل لاختبار البحث والخصم اليدوي.

لا يحتوي ملف البيئة على أي توكنات إنتاجية.

## ترتيب التشغيل
1. شغّل `00 - Setup / Auth / Health` للتأكد من صحة السيرفر والتوكنات.
2. شغّل `01 - Queue Contract Smoke Tests` للتأكد من عقد قوائم Dashboard v2.
3. شغّل دورة `02 - Home Delivery Lifecycle` عند وجود يوم توصيل منزلي قابل للتحضير في `testDate`.
4. شغّل دورة `03 - Branch Pickup Lifecycle` عند وجود اشتراك/طلب استلام من الفرع.
5. استخدم `04 - Day Status / Transition Matrix` لاختبار انتقالات الحالة على `entityId/entityType` المحفوظين.
6. شغّل `05 - Payment / Fulfillment Validity` للتحقق أن المدفوعات غير الصالحة لا تظهر كقابلة للإتمام.
7. شغّل `06 - Manual Deduction Lifecycle` بعد تعبئة `customerPhone` أو `manualDeductionSubscriptionId`.
8. شغّل `07 - Error Cases / Negative Tests` للتأكد من رسائل الأخطاء والحماية.

## ملخص الدورات
Home Delivery:
```txt
Kitchen Queue -> Prepare -> Dispatch -> Courier Queue -> Fulfill Delivery -> Fulfilled
```

Branch Pickup:
```txt
Pickup Request / Pickup Queue -> Prepare -> Ready For Pickup -> Fulfill Pickup -> Fulfilled
```

Manual Deduction:
```txt
Search Subscription -> Deduct Meals -> Verify Balance -> Verify Deduction History
```

## انتقالات الحالة المتوقعة
| الإجراء | من حالة | إلى حالة | الدور المتوقع | endpoint | شرط النجاح | خطأ متوقع عند عدم الصلاحية |
|---|---|---|---|---|---|---|
| lock | open/confirmed | locked | admin/superadmin فعلياً | POST /api/dashboard/ops/actions/lock | status true | INVALID_TRANSITION أو FORBIDDEN |
| prepare | open/locked/confirmed | in_preparation | admin/superadmin فعلياً | POST /api/dashboard/ops/actions/prepare | status true | PICKUP_PREPARE_REQUIRED أو INVALID_TRANSITION |
| dispatch | in_preparation | out_for_delivery | courier/admin حسب السياسة | POST /api/dashboard/ops/actions/dispatch | يظهر في courier queue | INVALID_ROLE_FOR_MODE أو INVALID_MODE_FOR_ACTION |
| ready_for_pickup | in_preparation | ready_for_pickup | admin/superadmin فعلياً | POST /api/dashboard/ops/actions/ready_for_pickup | كود استلام عند الحاجة | PICKUP_PREPARE_REQUIRED أو INVALID_TRANSITION |
| fulfill | out_for_delivery/ready_for_pickup | fulfilled | courier للتوصيل، kitchen للاستلام | POST /api/dashboard/ops/actions/fulfill | status fulfilled | ORDER_PAYMENT_REQUIRED أو INVALID_TRANSITION |
| cancel | حالات نشطة | delivery_canceled/canceled_at_branch/canceled | admin/superadmin فعلياً | POST /api/dashboard/ops/actions/cancel | status true | INVALID_TRANSITION أو FORBIDDEN |
| no_show | ready_for_pickup | no_show | admin/superadmin فعلياً | POST /api/dashboard/ops/actions/no_show | status no_show | INVALID_TRANSITION |
| reopen | canceled/no_show/locked | open | admin/superadmin | POST /api/dashboard/ops/actions/reopen | status true | INVALID_TRANSITION |
| notify_arrival | out_for_delivery | out_for_delivery مع إشعار | admin/superadmin فعلياً في الخدمة الحالية | POST /api/dashboard/ops/actions/notify_arrival | status true | FORBIDDEN أو INVALID_TRANSITION |

## قواعد العمل المهمة
- Home Delivery يمكن أن يحتوي على أكثر من وجبة في نفس اليوم.
- Home Delivery يجب أن ينتج زيارة توصيل واحدة لكل اشتراك/تاريخ، وإعادة dispatch يجب ألا تنشئ توصيلاً مكرراً.
- Branch Pickup يسمح بأي عدد موجب حتى `remainingMeals`.
- Branch Pickup يمكنه استلام كل الرصيد المتبقي في يوم واحد إذا كانت البيانات تسمح.
- `mealsPerDay` ليس سقفاً يومياً صارماً.
- الوجبة premium ليست وجبة إضافية.
- الإضافات add-ons ليست وجبات.
- الدفع المعلق أو superseded أو revision mismatch يجب ألا يكون fulfillable.
- الخصم اليدوي لا يمكن أن يتجاوز `remainingMeals` ولا يمكن أن يجعل الرصيد سالباً.

## اختبارات تعتمد على البيانات
بعض الطلبات ستفشل برسالة واضحة إذا لم توجد بيانات مناسبة في `testDate`: يوم توصيل مفتوح، طلب استلام جاهز، اشتراك عميل نشط، أو توكن عميل يملك الاشتراك. هذا فشل في توفر البيانات وليس بالضرورة خطأ في API.

## تفسير الفشل
- 401: التوكن غير موجود أو منتهي.
- 403/FORBIDDEN: الدور غير مناسب.
- 404/NOT_FOUND: المتغير يشير إلى سجل غير موجود أو لا يملكه التوكن.
- 409/INVALID_TRANSITION: الحالة الحالية لا تسمح بالإجراء.
- 422/INSUFFICIENT_CREDITS أو PAYMENT_REQUIRED: فشل قاعدة عمل متوقعة.

## عند إرسال فشل للفريق
أرسل لقطة شاشة من Postman تشمل: اسم الطلب، URL، status code، response body، وقيم المتغيرات `testDate`, `entityId`, `entityType`, `lastErrorCode`.
