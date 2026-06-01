# بنية كتالوج المنيو الحالية في الباك إند

> هذا الملف مرجع وصفي للحالة الحالية في `scripts/seed-catalog.js`. الغرض منه مقارنة الكتالوج لاحقا مع منيو المطعم الخارجي وتحديث الـ seed على مراحل آمنة. لا يشغل هذا الملف أي seed ولا يغير قاعدة البيانات.

## 1. نظرة عامة

المصدر الأساسي والموثوق للكتالوج هو مجموعات `Menu*` والعلاقات المرتبطة بها:

```text
MenuCategory
  -> MenuProduct
       -> ProductOptionGroup
            -> MenuOptionGroup
            -> ProductGroupOption
                 -> MenuOption
```

أما `BuilderCategory` و`BuilderProtein` و`BuilderCarb` و`SaladIngredient` و`Sandwich` فهي مرايا توافق مؤقتة لمسارات مخطط الاشتراك القديمة. يتم بناؤها من نفس تعريفات الـ seed حتى تستمر المسارات القديمة في العمل إلى أن يكتمل الانتقال إلى الكتالوج القياسي.

المفاتيح التقنية `key` ثابتة عمليا:

- في تدفقات لوحة التحكم العادية، ينشئ الباك إند المفتاح عند إنشاء السجل، ثم يمنع تغييره لاحقا.
- في `scripts/seed-catalog.js` توجد مفاتيح canonical مكتوبة صراحة حتى تكون عمليات `upsert` قابلة للتكرار بدون إنشاء نسخ مكررة.
- لا تغير `key` لمجرد تعديل الاسم المعروض. تغيير المفتاح قد يكسر العلاقات أو تكامل Flutter أو مسارات التوافق القديمة.

يستدعي الـ seed في النهاية `publishMenu()`، والذي يضبط `publishedAt` للسجلات النشطة، ينشئ snapshot في `MenuVersion`، ويربط المنتجات بالإصدار المنشور.

## 2. الكيانات الأساسية

| الكيان | الغرض | أهم الحقول | العلاقات | الظهور |
| --- | --- | --- | --- | --- |
| `MenuCategory` | تصنيف منتجات المنيو القياسي | `key`, `name`, `ui.cardVariant`, `isActive`, `isVisible`, `isAvailable`, `sortOrder`, `publishedAt` | يحتوي `MenuProduct` عبر `categoryId` | منيو الطلب الواحد مباشرة. وقد تستخدم منتجاته في الاشتراك حسب المنتج |
| `MenuProduct` | المنتج القياسي القابل للبيع أو التهيئة | `categoryId`, `key`, `itemType`, `pricingModel`, `priceHalala`, أوزان المنتج، `availableFor`, `ui`, `publishedAt` | يرتبط بالتصنيف، وبـ `ProductOptionGroup`، وبـ `MenuVersion` | الطلب الواحد أو الاشتراك أو كلاهما حسب `availableFor` |
| `MenuOptionGroup` | مجموعة خيارات قابلة لإعادة الاستخدام، مثل البروتين أو الكارب | `key`, `name`, `ui.displayStyle`, حالات الإتاحة، `publishedAt` | تحتوي `MenuOption`، وترتبط بالمنتج عبر `ProductOptionGroup` | كلاهما عند ربطها بمنتج مناسب |
| `MenuOption` | خيار عالمي داخل مجموعة | `groupId`, `key`, `name`, أسعار الإضافة، `availableFor`, `premiumKey`, `displayCategoryKey`, `proteinFamilyKey`, `selectionType`, `ruleTags` | يتبع `MenuOptionGroup`، ويصبح مسموحا لمنتج عبر `ProductGroupOption` | كلاهما حسب القناة والعلاقة |
| `ProductOptionGroup` | علاقة منتج بمجموعة خيارات مع قواعد الاختيار الخاصة بهذا المنتج | `productId`, `groupId`, `minSelections`, `maxSelections`, `isRequired`, حالات الإتاحة، `sortOrder` | يربط `MenuProduct` بـ `MenuOptionGroup` | كلاهما حسب المنتج |
| `ProductGroupOption` | قائمة الخيارات المسموح بها فعليا داخل مجموعة معينة لمنتج معين، مع إمكانية override للسعر | `productId`, `groupId`, `optionId`, أسعار override، حالات الإتاحة، `sortOrder` | يربط المنتج والمجموعة بـ `MenuOption` | كلاهما حسب المنتج والقناة |
| `MenuVersion` | snapshot عند النشر لدعم التتبع والـ rollback | `status`, `publishedAt`, `publishedBy`, `notes`, `snapshot` | ترتبط المنتجات المنشورة به عبر `versionId` | داخلي للوحة التحكم، وليس عنصرا في المنيو |
| `BuilderCategory` | تصنيف توافق قديم للبروتين والكارب | `key`, `dimension`, `name`, `ui.cardVariant`, `rules`, `isActive` | يستخدمه `BuilderProtein` و`BuilderCarb` | مخطط الاشتراك القديم و`builderCatalogV2` المشتق |
| `BuilderProtein` | مرآة توافق لبروتينات `MenuOption` | `key`, `displayCategoryKey`, `proteinFamilyKey`, `selectionType`, `isPremium`, `premiumKey`, `extraFeeHalala`, `ruleTags` | يشير إلى `BuilderCategory`، وتستخدم نفس `_id` الخاصة بخيار المنيو عند الإدراج الجديد | مخطط الاشتراك |
| `BuilderCarb` | مرآة توافق لخيارات كارب `MenuOption` | `key`, `displayCategoryKey`, `availableForSubscription`, `legacyMappings` | يشير إلى `BuilderCategory`، وتستخدم نفس `_id` الخاصة بخيار المنيو عند الإدراج الجديد | مخطط الاشتراك |
| `SaladIngredient` | مرآة توافق لمكونات السلطة | `name`, `groupKey`, `price`, `maxQuantity`, `isActive` | تستخدم `_id` الخاصة بخيار `MenuOption` | مخطط الاشتراك، خصوصا السلطة الكبيرة |
| `Sandwich` | مرآة توافق لمنتجات الساندويتش | `name`, `selectionType`, `categoryKey`, `pricingModel`, `priceHalala`, `proteinFamilyKey` | تستخدم `_id` الخاصة بمنتج `MenuProduct` | مخطط الاشتراك |
| `Addon` | إضافات الاشتراك القديمة: عناصر يومية وخطط إضافية | `kind`, `category`, `billingMode`, `priceHalala`, `menuProductId`, `isActive` | قد ترتبط بمنتج منيو عبر `menuProductId`. الـ seed الحالي ينشئ عناصر العصائر والحلويات وخطط الإضافات | إضافات الاشتراك. ليست بديل `MenuProduct` في منيو الطلب الواحد |
| `Setting` | إعدادات عامة مثل الفروع ونسبة الضريبة | `key`, `value`, `skipAllowance`, `description` | يقرأ `getPublishedMenu()` قيمة `vat_percentage` | إعدادات داخلية تؤثر في الاستجابات والقواعد |

ملاحظة: لا تحفظ أسعار إضافات الاشتراك المرتبطة بالمدة داخل seed الخاص بـ `Plan`. إضافات الاشتراك هي السناك والسلطة والعصير، وأسعارها تختلف حسب مدة الاشتراك ويجب إدارتها من لوحة التحكم بعد تثبيت عقد الـ schema/service الخاص بالإضافة. التوصيل ليس إضافة اشتراك؛ بل يتبع إعدادات التوصيل والشحن والـ checkout.

## 3. هيكل الـ seed الحالي

### `categoryRows`

يتحكم في تصنيفات `MenuCategory`: المفتاح، الاسم العربي والإنجليزي، و`ui.cardVariant`.

للإضافة الآمنة: أضف صفا بمفتاح `snake_case` جديد وثابت، واختر variant صالحا. لتعديل العرض، غير الاسم أو الـ variant مع إبقاء المفتاح القديم.

الخطأ المحتمل: تغيير المفتاح أو تكراره قد يفصل المنتجات عن التصنيف المتوقع أو يكسر واجهة تعتمد على المفتاح لأغراض هوية غير مرئية.

### `groupDefinitions`

يتحكم في مجموعات الخيارات العالمية وخيارات كل مجموعة. كل تشغيل seed ينشئ أو يحدث `MenuOptionGroup` و`MenuOption` ويعيد بناء مرايا البروتين والكارب ومكونات السلطة ذات الصلة.

للإضافة الآمنة: استخدم مفتاح مجموعة وخيار ثابتين، وضع metadata البروتين عند إضافة بروتين. أضف المجموعة إلى المنتج فقط عندما تحتاجها في `productRows[].groups`.

الخطأ المحتمل: وضع خيار في مجموعة خاطئة يكسر علاقات المنتج أو مرآة مخطط الاشتراك. metadata بروتين غير صحيحة قد تؤثر في حدود البروتين والرسوم المميزة.

### `saladIngredientGroupAliases`

يحول مفاتيح الكتالوج القياسية إلى مفاتيح نموذج السلطة القديم:

```js
{
  vegetables_legumes: "vegetables",
  sauces: "sauce",
}
```

للإضافة الآمنة: أضف alias فقط عندما يختلف اسم المجموعة القياسي عن enum التوافق القديم في `SaladIngredient`.

الخطأ المحتمل: حذف alias أو كتابة قيمة غير مدعومة يمنع حفظ مرآة `SaladIngredient` أو يغير شكل `salad.groups` القديم.

### `standardProteinOptionKeys`

القائمة الحالية:

```js
["chicken", "beef", "fish", "eggs"]
```

تحدد البروتينات القياسية غير المميزة. تستخدم حاليا لتقييد `basic_salad` و`basic_meal`.

للإضافة الآمنة: أضف بروتينا فقط إذا كان فعلا قياسيا وموجودا داخل مجموعة `proteins`.

الخطأ المحتمل: إدخال بروتين premium هنا يجعله يظهر في منتجات basic بدون تدفق التسعير المقصود.

### `productGroupAllowedOptionKeys`

يتحكم في القيود الخاصة بمنتج ومجموعة:

```js
{
  basic_salad: { proteins: standardProteinOptionKeys },
  basic_meal: { proteins: standardProteinOptionKeys },
}
```

عند عدم وجود قيد، يسمح الـ seed بكل خيارات المجموعة. عند وجوده، يسمح فقط بالمفاتيح المذكورة.

للإضافة الآمنة: استخدمه عندما يجب ألا يرث المنتج جميع خيارات مجموعة عامة قابلة لإعادة الاستخدام.

الخطأ المحتمل: مفتاح منتج أو مجموعة غير صحيح يجعل القيد غير فعال؛ وقائمة ناقصة تخفي خيارات مطلوبة.

### `productRows`

يتحكم في منتجات `MenuProduct` وعلاقات المجموعات لكل منتج. يثبت `baseUnitGrams = 100` و`weightStepGrams = 50`. إذا كان المنتج `per_100g` ولم يذكر `defaultWeightGrams` يصبح الوزن الافتراضي `100`.

للإضافة الآمنة: استخدم تصنيفا موجودا، و`itemType` و`pricingModel` صالحين، وسعرا بالهللة، وقنوات `availableFor` واضحة. أرفق المجموعات فقط عند الحاجة.

الخطأ المحتمل: سعر بوحدة SAR بدلا من هللة يسبب تسعيرا خاطئا بمقدار 100 مرة. مجموعة غير موجودة توقف الـ seed. قناة خاطئة تخفي المنتج من المسار المطلوب.

### `builderCategoryRows`

يتحكم في تصنيفات التوافق القديمة للبروتين والكارب وقواعد مخطط الاشتراك، مثل حد اللحم اليومي وقاعدة تقسيم الكارب.

للإضافة الآمنة: حافظ على `dimension` الصحيح وعلى القواعد الحالية ما لم تتغير سياسة العمل فعليا.

الخطأ المحتمل: حذف تصنيف مثل `premium` أو `standard_carbs` يمنع بناء مرايا البروتين أو الكارب. تغيير `rules` قد يغير تحقق مخطط الاشتراك.

## 4. تصنيفات الباك إند الحالية

| key | الاسم العربي | الاسم الإنجليزي | `ui.cardVariant` | الغرض | الاستخدام الحالي |
| --- | --- | --- | --- | --- | --- |
| `custom_order` | اطلب على مزاجك | Custom Order | `meal_builder` | منتجات قابلة للتهيئة واختيارات خفيفة أساسية | يحتوي منتجات basic والسلطات والزبادي |
| `light_options` | اختيارات خفيفة | Light Options | `light_collection` | مساحة عرض للخيارات الخفيفة | لا توجد منتجات مرتبطة به حاليا |
| `cold_sandwiches` | الساندويتش البارد | Cold Sandwiches | `sandwich_collection` | الساندويتشات الباردة | `chicken_sandwich`, `tuna_sandwich` للاشتراك |
| `sourdough` | الساندويشات | Sourdough Sandwiches | `sandwich_collection` | ساندويتشات الساوردو | `sourdough_turkey` للاشتراك |
| `desserts` | الحلويات | Desserts | `addon_collection` | الحلويات | منتجات إضافة للطلب الواحد والاشتراك |
| `juices` | العصائر | Juices | `addon_collection` | العصائر | منتجات إضافة للطلب الواحد والاشتراك |
| `drinks` | المشروبات | Drinks | `addon_collection` | المشروبات | منتجات إضافة للطلب الواحد والاشتراك |
| `ice_cream` | الايس كريم | Ice Cream | `addon_collection` | الآيس كريم | منتجات إضافة للطلب الواحد والاشتراك |

ملاحظة: `GET /api/orders/menu` يعيد فقط التصنيفات التي تحتوي منتجات منشورة ومتاحة لقناة `one_time`. لذلك لا يعني وجود التصنيف في الـ seed أنه سيظهر دائما في استجابة الطلب الواحد.

## 5. مجموعات الخيارات الحالية

### `proteins`

- الاسم: `بروتينات` / `Proteins`
- `ui.displayStyle`: `radio_cards`

| key | الاسم العربي | الاسم الإنجليزي | metadata |
| --- | --- | --- | --- |
| `chicken` | دجاج | Chicken | `displayCategoryKey=chicken`, `proteinFamilyKey=chicken`, `selectionType=standard_meal`, `extraFeeHalala=0` |
| `beef` | لحم | Beef | `displayCategoryKey=beef`, `proteinFamilyKey=beef`, `selectionType=standard_meal`, `extraFeeHalala=0` |
| `fish` | سمك | Fish | `displayCategoryKey=fish`, `proteinFamilyKey=fish`, `selectionType=standard_meal`, `extraFeeHalala=0` |
| `eggs` | بيض | Eggs | `displayCategoryKey=eggs`, `proteinFamilyKey=eggs`, `selectionType=standard_meal`, `extraFeeHalala=0` |
| `beef_steak` | ستيك لحم | Beef Steak | `premiumKey=beef_steak`, `displayCategoryKey=premium`, `proteinFamilyKey=beef`, `selectionType=premium_meal`, `extraFeeHalala=2000` |
| `shrimp` | جمبري | Shrimp | `premiumKey=shrimp`, `displayCategoryKey=premium`, `proteinFamilyKey=fish`, `selectionType=premium_meal`, `extraFeeHalala=2000` |
| `salmon` | سالمون | Salmon | `premiumKey=salmon`, `displayCategoryKey=premium`, `proteinFamilyKey=fish`, `selectionType=premium_meal`, `extraFeeHalala=2000` |

جميع `ruleTags` الحالية فارغة. منتجات `basic_meal` و`basic_salad` تسمح فقط بأول أربعة خيارات عبر `productGroupAllowedOptionKeys`.

### `carbs`

- الاسم: `كارب` / `Carbs`
- `ui.displayStyle`: `chips`

| key | الاسم العربي | الاسم الإنجليزي | metadata |
| --- | --- | --- | --- |
| `white_rice` | ارز ابيض | White Rice | `displayCategoryKey=standard_carbs` |
| `brown_rice` | ارز اسمر | Brown Rice | `displayCategoryKey=standard_carbs` |
| `potato` | بطاطس | Potato | `displayCategoryKey=standard_carbs` |
| `sweet_potato` | بطاطا حلوة | Sweet Potato | `displayCategoryKey=standard_carbs` |
| `pasta` | مكرونة | Pasta | `displayCategoryKey=standard_carbs` |

### `leafy_greens`

- الاسم: `ورقيات` / `Leafy Greens`
- `ui.displayStyle`: `checkbox_grid`

| key | الاسم العربي | الاسم الإنجليزي |
| --- | --- | --- |
| `lettuce` | خس | Lettuce |
| `arugula` | جرجير | Arugula |
| `spinach` | سبانخ | Spinach |

### `vegetables_legumes`

- الاسم: `خضراوات وبقوليات` / `Vegetables & Legumes`
- `ui.displayStyle`: `checkbox_grid`
- alias في نموذج السلطة القديم: `vegetables`

| key | الاسم العربي | الاسم الإنجليزي |
| --- | --- | --- |
| `cucumber` | خيار | Cucumber |
| `tomato` | طماطم | Tomato |
| `corn` | ذرة | Corn |
| `carrot` | جزر | Carrot |
| `red_beans` | فاصوليا حمراء | Red Beans |

### `cheese_nuts`

- الاسم: `الأجبان والمكسرات` / `Cheese & Nuts`
- `ui.displayStyle`: `checkbox_grid`

| key | الاسم العربي | الاسم الإنجليزي |
| --- | --- | --- |
| `feta_cheese` | جبنة فيتا | Feta Cheese |
| `almond` | لوز | Almond |
| `walnut` | جوز | Walnut |

### `fruits`

- الاسم: `فواكه` / `Fruits`
- `ui.displayStyle`: `checkbox_grid`

| key | الاسم العربي | الاسم الإنجليزي |
| --- | --- | --- |
| `apple` | تفاح | Apple |
| `pomegranate` | رمان | Pomegranate |
| `mango` | مانجا | Mango |

### `sauces`

- الاسم: `الصوصات` / `Sauces`
- `ui.displayStyle`: `radio_cards`
- alias في نموذج السلطة القديم: `sauce`

| key | الاسم العربي | الاسم الإنجليزي |
| --- | --- | --- |
| `ranch` | رانش | Ranch |
| `lemon_mustard` | ليمون وخردل | Lemon Mustard |
| `balsamic` | بلسميك | Balsamic |

## 6. المنتجات الحالية

الوزن الافتراضي أدناه هو القيمة التي يخزنها الـ seed فعليا بعد تطبيق fallback، وليس فقط القيمة المكتوبة داخل الصف.

| key | category | itemType | الاسم العربي | الاسم الإنجليزي | pricingModel | السعر بالهللة | السعر SAR | defaultWeightGrams | availableFor | `ui.cardVariant` | المجموعات المرتبطة | ملاحظات |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| `basic_salad` | `custom_order` | `basic_salad` | سلطة بيسك | Basic Salad | `per_100g` | 2900 | 29 | 100 | كلاهما | `standard` | `leafy_greens(2..2)`, `vegetables_legumes(0..99)`, `fruits(0..99)`, `proteins(1..1)`, `cheese_nuts(0..99)`, `sauces(1..1)` | البروتينات القياسية فقط |
| `basic_meal` | `custom_order` | `basic_meal` | وجبة بيسك | Basic Meal | `per_100g` | 1900 | 19 | 100 | كلاهما | `standard` | `carbs(1..2)`, `proteins(1..1)` | البروتينات القياسية فقط |
| `premium_large_salad` | `custom_order` | `basic_salad` | سلطة كبيرة مميزة | Premium Large Salad | `fixed` | 2900 | 29 | 0 | اشتراك | `large_salad` | `leafy_greens(0..99)`, `vegetables_legumes(0..99)`, `proteins(1..1)`, `cheese_nuts(0..99)`, `fruits(0..99)`, `sauces(1..1)` | مخصص لمخطط الاشتراك |
| `small_salad` | `custom_order` | `green_salad` | سلطة خضراء صغيرة | Small Green Salad | `fixed` | 900 | 9 | 0 | كلاهما | `addon` | لا يوجد | إضافة مباشرة |
| `green_salad` | `custom_order` | `green_salad` | سلطة خضرا | Green Salad | `per_100g` | 1500 | 15 | 100 | كلاهما | `standard` | `leafy_greens(2..2)`, `vegetables_legumes(0..99)`, `sauces(1..1)` | سلطة مهيأة بالوزن |
| `fruit_salad` | `custom_order` | `fruit_salad` | سلطة فواكه | Fruit Salad | `fixed` | 1700 | 17 | 150 | طلب واحد | `standard` | `fruits(0..99)` | يحتاج builder لأن له مجموعة خيارات |
| `greek_yogurt` | `custom_order` | `greek_yogurt` | زبادي يوناني | Greek Yogurt | `fixed` | 1700 | 17 | 200 | طلب واحد | `standard` | `fruits(0..99)`, `cheese_nuts(0..99)` | يحتاج builder لأن له مجموعات خيارات |
| `chicken_sandwich` | `cold_sandwiches` | `cold_sandwich` | ساندويتش دجاج | Chicken Sandwich | `fixed` | 1300 | 13 | 0 | اشتراك | `standard` | لا يوجد | مرآة `Sandwich`, عائلة `chicken` |
| `tuna_sandwich` | `cold_sandwiches` | `cold_sandwich` | ساندويتش تونا | Tuna Sandwich | `fixed` | 1300 | 13 | 0 | اشتراك | `standard` | لا يوجد | مرآة `Sandwich`, عائلة `fish` |
| `sourdough_turkey` | `sourdough` | `sourdough` | ساوردو تركي | Sourdough Turkey | `fixed` | 2300 | 23 | 0 | اشتراك | `standard` | لا يوجد | مرآة `Sandwich`, عائلة `other` |
| `berry_cheesecake` | `desserts` | `dessert` | تشيز كيك بالتوت | Berry Cheesecake | `fixed` | 1900 | 19 | 0 | كلاهما | `addon` | لا يوجد | ينشئ أيضا `Addon` اشتراك من نوع snack |
| `dark_brownies` | `desserts` | `dessert` | براونيز داكن | Dark Brownies | `fixed` | 1300 | 13 | 0 | كلاهما | `addon` | لا يوجد | ينشئ أيضا `Addon` اشتراك من نوع snack |
| `berry_blast` | `juices` | `juice` | بيري بلاست | Berry Blast | `fixed` | 1100 | 11 | 0 | كلاهما | `addon` | لا يوجد | ينشئ أيضا `Addon` اشتراك من نوع juice |
| `classic_green` | `juices` | `juice` | كلاسيك جرين | Classic Green | `fixed` | 1100 | 11 | 0 | كلاهما | `addon` | لا يوجد | ينشئ أيضا `Addon` اشتراك من نوع juice |
| `protein_drink` | `drinks` | `drink` | مشروب بروتين | Protein Drink | `fixed` | 1900 | 19 | 0 | كلاهما | `addon` | لا يوجد | إضافة مباشرة |
| `water` | `drinks` | `drink` | مياه عادية | Water | `fixed` | 200 | 2 | 0 | كلاهما | `addon` | لا يوجد | إضافة مباشرة |
| `vanilla_ice_cream` | `ice_cream` | `ice_cream` | ايس كريم فانيليا | Vanilla Ice Cream | `fixed` | 1300 | 13 | 0 | كلاهما | `addon` | لا يوجد | إضافة مباشرة |

## 7. قواعد علاقات الخيارات

داخل `productRows` تكتب العلاقة بصورة مختصرة:

```js
["carbs", 1, 2]
```

ومعناها:

```text
groupKey = carbs
minSelections = 1
maxSelections = 2
isRequired = true // افتراضيا لأن minSelections > 0
```

ويمكن تحديد الإلزام صراحة:

```js
["leafy_greens", 0, 99, false]
```

ومعناها `isRequired = false`.

العلاقات موزعة على مستويين:

1. `ProductOptionGroup` يربط المنتج بالمجموعة ويحدد الحد الأدنى والأقصى والإلزام.
2. `ProductGroupOption` يحدد الخيارات المسموحة داخل هذه المجموعة لهذا المنتج بالتحديد، ويمكنه عمل override لأسعار الخيار.

إذا كان هناك قيد في `productGroupAllowedOptionKeys`، فإن الـ seed لا يحذف العلاقات القديمة غير المسموحة. بدلا من ذلك يضبط:

```js
{
  isActive: false,
  isVisible: false,
  isAvailable: false
}
```

تحذير مهم عند كتابة كود لوحة التحكم:

```js
// خطأ: يحول 0 إلى 1
const maxSelections = value || 1;

// صحيح: يحتفظ بالقيمة 0
const maxSelections = value ?? 1;
```

## 8. نماذج التسعير

### `fixed`

السعر ثابت للمنتج. لا يحتاج تدفق quote أو order إلى `weightGrams` لحساب السعر الأساسي.

### `per_100g`

السعر مخزن لكل `baseUnitGrams`، والقيمة الحالية في الـ seed هي `100`. يجب أن ترسل تدفقات quote وorder قيمة `weightGrams` صحيحة: عدد صحيح موجب وصالح للمنتج. المنتجات الحالية من هذا النوع:

- `basic_salad`
- `basic_meal`
- `green_salad`

الأسعار مخزنة بالهللة:

```text
1900 هللة = 19 SAR
2900 هللة = 29 SAR
```

لا ترسل SAR في حقل `priceHalala`.

## 9. قواعد `availableFor`

القيم المدعومة:

- `one_time`: المنتج متاح لمنيو الطلب الواحد.
- `subscription`: المنتج متاح لمسارات الاشتراك.
- يمكن للمنتج دعم القناتين معا بوضع القيمتين.

يستخدم `GET /api/orders/menu` فلتر قناة `one_time`، ثم يبني:

```text
data.categories[]
  products[]
    optionGroups[]
      options[]
```

أما مخطط الاشتراك فيعرض `builderCatalogV2.sections` مع إبقاء `builderCatalog` القديم للتوافق. يعتمد ذلك على الكتالوج القياسي ومرايا التوافق، ويشمل حاليا أقسام `standard_meal` و`premium_meal` و`sandwich` و`premium_large_salad`.

ملاحظة: أسعار خطط الاشتراك ليست داخل `builderCatalogV2`. ينشئ `scripts/seed-subscription-plans.js` ثلاثة خطط علوية فقط:

- `subscription_7_days`
- `subscription_26_days`
- `subscription_30_days`

وكل خطة تحتوي خيارات `100g`, `150g`, `200g` ثم `1`, `2`, `3`, `4`, `5` وجبات يوميا.
إجمالي نقاط السعر المداخلة: 45.

> **ملاحظة (TODO):** توجد أسعار إضافات (سناك، سلطة، توصيل) محددة لكل مدة في المنيو الخارجي، لكن نموذج `Plan` لا يدعم الإضافات على مستوى الخطة حالياً. تدفق الإضافات الحالي يستخدم نموذج `Addon` المنفصل. يتطلب دمجها قراراً بشأن المخطط (schema) والخدمات.

## 10. عقد UI metadata

حقول العرض المدعومة:

- `category.ui.cardVariant`
- `product.ui.cardVariant`
- `product.ui.badge`
- `product.ui.ctaLabel`
- `product.ui.imageRatio`
- `optionGroup.ui.displayStyle`

قيم تصنيف المنيو:

```text
meal_builder
light_collection
sandwich_collection
addon_collection
```

قيم بطاقة المنتج:

```text
standard
premium
large_salad
addon
```

قيم طريقة عرض مجموعة الخيارات:

```text
chips
radio_cards
checkbox_grid
dropdown
stepper
```

يجب أن يرسم Flutter الواجهة من metadata، وليس من `key` أو الاسم. وفي المقابل، metadata للعرض فقط: لا تستخدمها للتسعير أو التحقق أو الاستحقاق أو حدود اللحم والكارب أو رسوم premium.

مثال مبسط:

```json
{
  "key": "basic_meal",
  "ui": { "cardVariant": "standard" },
  "optionGroups": [
    {
      "key": "carbs",
      "minSelections": 1,
      "maxSelections": 2,
      "ui": { "displayStyle": "chips" }
    }
  ]
}
```

## 11. خطوات تحديث آمنة لاحقا

1. قارن تصنيفا واحدا في كل مرة مع منيو المطعم الخارجي.
2. عدل `categoryRows` أو `groupDefinitions` أو `productRows` فقط بعد توثيق الفرق المطلوب.
3. حافظ على المفاتيح الحالية متى كان العنصر نفسه ما زال موجودا.
4. أضف مفتاحا جديدا فقط لعنصر جديد فعلا.
5. راجع `availableFor` قبل اعتبار العنصر مفقودا من مسار معين.
6. راجع مرايا التوافق عند تغيير بروتين أو كارب أو مكون سلطة أو ساندويتش.
7. لا تستخدم `--reset` لتطبيق تحديث اعتيادي. الـ seed مصمم لعمل `upsert` بالمفاتيح الثابتة.

## 12. قالب مقارنة المنيو الخارجي

استخدم هذا القسم كنسخة عمل عند استلام منيو المطعم الخارجي. لا تعدل الـ seed أثناء الاستخراج الأولي. سجل الفروق أولا، ثم راجع القرارات تصنيفا بعد تصنيف.

### بيانات المصدر

| الحقل | القيمة |
| --- | --- |
| اسم المصدر | مثال: منيو الفرع الرئيسي |
| نوع المصدر | صورة / PDF / ملف Excel / رابط |
| تاريخ الاستلام | `YYYY-MM-DD` |
| الفرع أو النطاق | جميع الفروع / فرع محدد |
| اللغة | عربي / إنجليزي / كلاهما |
| راجعه | اسم المراجع |
| ملاحظات عامة | الأسعار شاملة الضريبة؟ هل توجد عروض مؤقتة؟ |

### حالات المقارنة

استخدم قيمة واحدة واضحة في عمود `الحالة`:

| الحالة | المعنى | التصرف المتوقع |
| --- | --- | --- |
| `match` | العنصر الخارجي يطابق الباك إند | لا تعديل |
| `rename` | العنصر نفسه لكن الاسم تغير | تعديل `name` مع إبقاء `key` |
| `price_change` | العنصر نفسه لكن السعر تغير | تعديل `priceHalala` بعد تأكيد الوحدة |
| `metadata_change` | اختلاف عرض أو قناة أو نوع | راجع `availableFor`, `itemType`, `ui` |
| `new` | عنصر جديد فعلا | أضف `key` canonical جديدا |
| `missing_external` | موجود في الباك إند وغير ظاهر خارجيا | لا تحذفه مباشرة؛ أكد هل يجب تعطيله |
| `unclear` | الصورة أو الوصف لا يكفي لاتخاذ قرار | أوقف التعديل واطلب توضيحا |

### مقارنة التصنيفات

| الحالة | التصنيف الخارجي | `key` الحالي أو المقترح | الاسم العربي | الاسم الإنجليزي | `ui.cardVariant` | ترتيب العرض | مصدر المعلومة | القرار | ملاحظات |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |

مكان التعديل المتوقع: `categoryRows`.

### مقارنة المنتجات

| الحالة | التصنيف الخارجي | `key` الحالي أو المقترح | الاسم العربي | الاسم الإنجليزي | `itemType` | `pricingModel` | السعر الخارجي SAR | `priceHalala` المتوقع | `availableFor` | المجموعات المطلوبة | صورة مرجعية | القرار |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |  |  |  |

مكان التعديل المتوقع: `productRows`. قبل اعتماد السعر، حول SAR إلى هللة:

```text
السعر بالهللة = السعر بالريال * 100
19 SAR = 1900 هللة
```

### مقارنة مجموعات الخيارات

| الحالة | `group key` الحالي أو المقترح | الاسم العربي | الاسم الإنجليزي | `ui.displayStyle` | المنتجات المرتبطة | هل يحتاج alias قديم؟ | مصدر المعلومة | القرار |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |

مكان التعديل المتوقع: `groupDefinitions`، وقد يتطلب تحديث `saladIngredientGroupAliases`.

### مقارنة الخيارات

| الحالة | `group key` | `option key` الحالي أو المقترح | الاسم العربي | الاسم الإنجليزي | السعر الإضافي SAR | `extraFeeHalala` المتوقع | `displayCategoryKey` | `proteinFamilyKey` | `selectionType` | `premiumKey` | `ruleTags` | مصدر المعلومة | القرار |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |

مكان التعديل المتوقع: `groupDefinitions[].options`. عند إضافة بروتين قياسي أو premium راجع أيضا `standardProteinOptionKeys` و`productGroupAllowedOptionKeys`.

### سجل القرارات

| رقم | القرار | السبب | الملفات أو الأقسام المتأثرة | يحتاج تأكيد من المطعم؟ | الحالة |
| ---: | --- | --- | --- | --- | --- |
| 1 |  |  |  | نعم / لا | مفتوح / معتمد |

احتفظ بسجل منفصل لكل دفعة تعديل. لا تخلط عناصر مؤكدة بعناصر `unclear` في نفس عملية تحديث الـ seed.

## 13. دعم الصور

توجد حالتان مختلفتان للصور ويجب عدم الخلط بينهما:

1. **صورة مرجعية خارجية**: لقطة أو صفحة من منيو المطعم تستخدم لإثبات المقارنة فقط.
2. **صورة منتج داخل التطبيق**: رابط عام يحفظ في `imageUrl` ويظهر للعميل.

### صور المقارنة المرجعية

عند استلام صور منيو:

1. أعط كل صورة معرفا ثابتا مثل `menu-page-01` أو `desserts-photo-02`.
2. سجل اسم الملف أو الرابط في عمود `صورة مرجعية` أو `مصدر المعلومة`.
3. إذا كانت الصورة طويلة أو تحتوي أكثر من قسم، سجل الصفحة والمنطقة، مثل: `menu-page-03 / juices / top-right`.
4. لا تستنتج سعرا أو اسما إذا كان النص مقطوعا أو غير واضح. استخدم الحالة `unclear`.
5. لا ترفع صور المقارنة إلى قاعدة البيانات ولا تضع مسارات محلية داخل `imageUrl`.

قالب فهرس الصور:

| معرف الصورة | الملف أو الرابط | القسم الظاهر | الجودة | النص غير الواضح | ملاحظات |
| --- | --- | --- | --- | --- | --- |
| `menu-page-01` |  |  | واضحة / متوسطة / ضعيفة |  |  |

### صور المنتجات في التطبيق

الحقول الحالية التي تدعم صورة:

| الكيان | الحقل | الاستخدام |
| --- | --- | --- |
| `MenuCategory` | `imageUrl` | صورة أو غلاف التصنيف |
| `MenuProduct` | `imageUrl` | صورة المنتج |
| `MenuOption` | `imageUrl` | صورة الخيار، مثل البروتين |
| `BuilderProtein` | `imageUrl` | مرآة توافق قديمة للبروتين |
| `Sandwich` | `imageUrl` | مرآة توافق قديمة للساندويتش |
| `Addon` | `imageUrl` | صورة الإضافة القديمة |

ملاحظات مهمة:

- استخدم رابطا عاما صالحا للعميل، وليس مسارا محليا مثل `/home/.../image.png`.
- سجل مصدر الصورة وحقوق استخدامها قبل اعتمادها.
- حافظ على نسبة العرض عبر `product.ui.imageRatio` عند الحاجة. القيمة الافتراضية الحالية `square`.
- الـ seed الحالي لا يمرر `imageUrl` من جميع صفوف `productRows` إلى كل المرايا بنفس الشكل. عند إضافة صور فعلية، راجع مسار المنتج ومسار التوافق المطلوب قبل التنفيذ.
- الصورة metadata للعرض فقط. لا تستخدم وجودها أو اسم الملف كقاعدة business logic.

قالب جاهزية صورة المنتج:

| `product key` أو `option key` | رابط الصورة العام | المصدر | حقوق الاستخدام مؤكدة؟ | `imageRatio` | يحتاج تحديث مرآة توافق؟ | الحالة |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | نعم / لا | `square` | نعم / لا | جاهز / ناقص |

## 14. قائمة التحقق النهائية قبل تعديل الـ seed

لا تبدأ تعديل `scripts/seed-catalog.js` قبل إكمال هذه القائمة للدفعة المطلوبة.

### النطاق والمصدر

- [ ] تم تحديد مصدر المنيو الخارجي وتاريخ استلامه والفرع المقصود.
- [ ] تم توثيق هل الأسعار شاملة الضريبة وهل توجد عروض مؤقتة يجب استبعادها.
- [ ] تم ربط كل فرق بصورة أو صفحة أو مصدر واضح.
- [ ] لا توجد عناصر `unclear` ضمن الدفعة التي ستطبق.
- [ ] التعديل مقسم حسب قسم واضح، مثل العصائر أو الحلويات أو البروتينات.

### الهوية والمفاتيح

- [ ] تم الإبقاء على `key` الحالي عند تعديل نفس العنصر.
- [ ] كل عنصر جديد فعلا له `key` جديد بصيغة `snake_case`.
- [ ] لا توجد مفاتيح مكررة داخل `categoryRows` أو `productRows` أو خيارات المجموعة نفسها.
- [ ] لم يستخدم الاسم العربي أو الإنجليزي كبديل عن المفتاح التقني.

### المنتجات والأسعار

- [ ] كل منتج يشير إلى تصنيف موجود.
- [ ] كل `itemType` مدعوم في `MenuProduct`.
- [ ] كل سعر حول إلى هللة وتحقق منه شخص ثان، مثل `19 SAR = 1900`.
- [ ] تم اختيار `fixed` أو `per_100g` بصورة صحيحة.
- [ ] منتجات `per_100g` لها أوزان صالحة ومتوافقة مع تدفقات quote وorder.
- [ ] تمت مراجعة `availableFor`: `one_time` أو `subscription` أو كلاهما.

### الخيارات والعلاقات

- [ ] كل مجموعة مستخدمة في `productRows[].groups` موجودة في `groupDefinitions`.
- [ ] تمت مراجعة `minSelections`, `maxSelections`, `isRequired` لكل منتج.
- [ ] لم تستخدم صيغة `maxSelections || 1` في أي كود جديد؛ استخدمت `maxSelections ?? 1`.
- [ ] تمت مراجعة `productGroupAllowedOptionKeys` حتى لا ترث المنتجات basic خيارات premium بالخطأ.
- [ ] تمت مراجعة `standardProteinOptionKeys` عند إضافة أو تغيير بروتين.
- [ ] تمت مراجعة `premiumKey`, `proteinFamilyKey`, `displayCategoryKey`, `selectionType`, `extraFeeHalala`, `ruleTags` للبروتينات.

### التوافق والصور

- [ ] تمت مراجعة مرايا `BuilderProtein`, `BuilderCarb`, `SaladIngredient`, `Sandwich` عند تأثرها.
- [ ] تمت مراجعة `saladIngredientGroupAliases` عند تغيير مجموعات السلطة.
- [ ] صور المقارنة ليست مخزنة كمسارات محلية في `imageUrl`.
- [ ] روابط صور التطبيق عامة وحقوق استخدامها مؤكدة.
- [ ] تمت مراجعة `imageRatio` ومسار مرآة التوافق عند إضافة صور.

### التشغيل الآمن بعد التعديل

- [ ] لن يستخدم `--reset` أو `ALLOW_CATALOG_RESET=true`.
- [ ] لن تحذف بيانات مستخدمين أو طلبات أو اشتراكات أو مدفوعات.
- [ ] ستراجع diff قبل التشغيل للتأكد أن التغيير محصور في الدفعة المطلوبة.
- [ ] ستشغل اختبارات الكتالوج المناسبة قبل أي تطبيق فعلي.
- [ ] ستشغل `graphify update .` بعد تعديل ملفات الكود.
- [ ] ستستخدم تشغيل seed اعتياديا يعتمد على `upsert` فقط بعد الموافقة الصريحة على تطبيق البيانات.
