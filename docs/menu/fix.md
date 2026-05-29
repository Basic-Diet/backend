# Flutter Fix Required — Subscription Meal Selection Validation

## المشكلة الحالية

عند استدعاء:

```http
POST /api/subscriptions/:subscriptionId/days/:date/selection/validate
```

ظهر الخطأ التالي:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_PROTEIN_TYPE",
    "message": "Premium meal requires a premium protein",
    "details": {
      "slotErrors": [
        {
          "slotIndex": 2,
          "code": "INVALID_PROTEIN_TYPE",
          "message": "Premium meal requires a premium protein"
        }
      ]
    }
  }
}
```

## تفسير الخطأ

هذا الخطأ يعني أن الوجبة رقم `slotIndex: 2` محسوبة في الباك إند كـ **Premium Meal**، لكن Flutter أرسل لها بروتين غير مميز، أو أرسل بروتين مميز بصيغة ناقصة/غير صحيحة.

الباك إند هنا يعمل بشكل صحيح؛ لأن قواعد الاشتراك تمنع إرسال بروتين عادي داخل وجبة premium.

---

## المطلوب من Flutter

يجب فصل اختيارات البروتين حسب نوع الوجبة:

### 1. Standard Meal

إذا كانت الوجبة:

```txt
selectionType = standard_meal
```

يجب عرض وإرسال بروتينات standard فقط:

```txt
chicken
beef
fish
eggs
```

ولا يجب عرض أو إرسال premium proteins هنا.

---

### 2. Premium Meal

إذا كانت الوجبة:

```txt
selectionType = premium_meal
```

يجب عرض وإرسال بروتينات premium فقط:

```txt
beef_steak
shrimp
salmon
```

ويجب الحفاظ على بيانات البروتين المميز من الكتالوج، خصوصًا:

```txt
key
premiumKey
extraFeeHalala
isPremium
```

---

## مصدر البيانات الصحيح

يجب الاعتماد على:

```http
GET /api/subscriptions/meal-planner-menu?includeLegacy=true&lang=ar
```

واستخدام:

```txt
data.builderCatalogV2.sections
```

الأقسام المهمة:

```txt
standard_meal
premium_meal
sandwich
premium_large_salad
```

الـ Flutter يجب أن يقرأ خيارات البروتين من section الصحيح:

```txt
standard_meal => standard proteins فقط
premium_meal  => premium proteins فقط
```

---

## ممنوع

لا يجب استخدام نفس قائمة البروتينات لكل أنواع الوجبات.

لا يجب إرسال:

```txt
chicken / beef / fish / eggs
```

داخل:

```txt
premium_meal
```

ولا يجب إرسال:

```txt
beef_steak / shrimp / salmon
```

داخل:

```txt
standard_meal
```

---

## مطلوب تعديل الـ payload logging

اللوج الحالي غير كافي لأنه يطبع:

```txt
mealSlots: [Instance of 'MealSlotRequest', Instance of 'MealSlotRequest']
```

وهذا لا يوضح البيانات الفعلية المرسلة للباك إند.

يجب تعديل Flutter ليطبع JSON الحقيقي قبل الإرسال:

```dart
final body = {
  'mealSlots': mealSlots.map((slot) => slot.toJson()).toList(),
  'addonsOneTime': addonsOneTime,
};

debugPrint(
  const JsonEncoder.withIndent('  ').convert(body),
);
```

ويجب إرسال نفس الـ body إلى Dio:

```dart
dio.post(
  url,
  data: body,
);
```

لا يجب إرسال raw `MealSlotRequest` objects داخل الـ request.

---

## مثال Payload صحيح

### وجبة standard

```json
{
  "slotIndex": 1,
  "selectionType": "standard_meal",
  "proteinKey": "chicken",
  "carbKey": "white_rice"
}
```

### وجبة premium

```json
{
  "slotIndex": 2,
  "selectionType": "premium_meal",
  "proteinKey": "shrimp",
  "premiumKey": "shrimp",
  "carbKey": "brown_rice"
}
```

ملاحظة: لو الـ `premiumKey` في الكتالوج مختلف عن `key`، يجب إرسال قيمة `premiumKey` الحقيقية القادمة من الباك إند.

---

## المطلوب في UI

عند تغيير نوع الوجبة:

### من standard إلى premium

يجب مسح البروتين المختار سابقًا إذا كان standard protein.

مثال:

```txt
كان مختار chicken
ثم غيّر الوجبة إلى premium_meal
=> يجب مسح chicken وإجبار المستخدم يختار premium protein
```

### من premium إلى standard

يجب مسح البروتين المختار سابقًا إذا كان premium protein.

---

## Local Validation قبل استدعاء API

قبل إرسال request إلى `/selection/validate`، يجب عمل check محلي:

إذا كانت الوجبة:

```txt
premium_meal
```

والبروتين المختار ليس premium، يجب منع الطلب وإظهار رسالة:

```txt
يجب اختيار بروتين مميز لهذه الوجبة
```

وإذا كانت الوجبة:

```txt
standard_meal
```

والبروتين المختار premium، يجب مسحه أو منع الإرسال.

---

## اختبارات مطلوبة من Flutter

يجب اختبار الحالات التالية:

1. `standard_meal` + `chicken`
   النتيجة: validate ينجح.

2. `premium_meal` + `shrimp`
   النتيجة: validate ينجح.

3. `premium_meal` + `chicken`
   النتيجة: Flutter يمنع الإرسال قبل API.

4. تغيير slot من standard إلى premium
   النتيجة: يتم مسح البروتين القديم.

5. تغيير slot من premium إلى standard
   النتيجة: يتم مسح البروتين القديم.

6. طباعة request body الحقيقي قبل الإرسال للتأكد أن `slotIndex: 2` يرسل premium protein.

---

## ملحوظة Backend

الباك إند لا يحتاج تعديل في هذه النقطة.
الخطأ `INVALID_PROTEIN_TYPE` هو validation صحيح ومقصود لحماية قواعد الاشتراك.

المطلوب هو تعديل Flutter لاستخدام `builderCatalogV2.sections.premium_meal` عند اختيار وجبة premium، وعدم إرسال بروتين standard داخل premium meal.
