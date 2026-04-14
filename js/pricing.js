/*
  ============================================
  ملف حسابات التسعير
  ============================================
  هذا الملف يحتوي على كل المعادلات الحسابية
  اللي يعتمد عليها التطبيق لحساب تكلفة الوصفة
  واقتراح سعر البيع. الملف لا يلمس DOM إطلاقاً،
  فقط رياضيات وقراءة بيانات من كائن الوصفة.

  ليش ملف مستقل؟ عشان المستخدم يقدر يفتحه
  ويعدل المعادلات بنفسه بدون ما يخاف يكسر
  الواجهة.

  --------------------------------------------
  الثوابت والفرضيات:
  --------------------------------------------
  - ELECTRIC_OVEN_KW = 2
    الفرن الكهربائي المنزلي تقريباً يستهلك
    2 كيلوواط في الساعة. رقم وسطي معقول.

  - GAS_CYLINDER_BURN_HOURS = 14
    أسطوانة الغاز المنزلي السعودية (حوالي
    12 كيلو) تشتغل بالتقريب 14 ساعة متواصلة
    على موقد متوسط اللهب.

  - القيم الافتراضية للتسعير (DEFAULT_*):
    تُستخدم فقط لو الوصفة ما عندها قيمة خاصة
    محفوظة. وهذا يفيد:
      (أ) الوصفات القديمة قبل هذا التغيير
          واللي ما فيها الحقول الجديدة
      (ب) كنقطة بداية معقولة للوصفات الجديدة

  - تعرفة الكهرباء مخزّنة بالهللات لكل كيلوواط
    ساعة، فنقسمها على 100 لنحولها إلى ريال.

  - لو كان مصدر الطاقة "كلاهما" (كهرباء وغاز)،
    نفترض أن نصف وقت الطبخ كهرباء ونصفه غاز.

  - لو مصدر الطاقة "بدون"، تكلفة الطاقة = 0.

  - تكلفة الماء مو محسوبة في هذي النسخة.
  ============================================
*/

(function () {
    // استهلاك الفرن الكهربائي بالكيلوواط
    const ELECTRIC_OVEN_KW = 2;
    // عدد الساعات التي تدوم فيها أسطوانة الغاز تقريباً
    const GAS_CYLINDER_BURN_HOURS = 14;

    // القيم الافتراضية — نستخدمها عندما ما تكون الوصفة
    // متضمّنة قيمة خاصة بها (مثل الوصفات القديمة).
    const DEFAULT_HOURLY_RATE = 20;        // ريال لكل ساعة عمل
    const DEFAULT_ELECTRICITY_RATE = 18;   // هللة لكل كيلوواط ساعة
    const DEFAULT_GAS_CYLINDER_PRICE = 25; // ريال لأسطوانة الغاز

    // تقريب لأقرب منزلتين عشريتين — نستخدمه لكل القيم المالية
    // عشان تبقى الأرقام المعروضة ثابتة ومفهومة.
    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    // تنسيق مبلغ مالي كنص عربي: "12.34 ريال".
    function formatSAR(amount) {
        const value = Number(amount) || 0;
        return value.toFixed(2) + ' ريال';
    }

    // === تكلفة المواد الخام ===
    // لكل مكون في الوصفة: (سعر العبوة ÷ وزن العبوة) × الكمية المستخدمة.
    // المكونات المحذوفة (ما نقدر نلاقيها في قائمة المكونات)
    // نتخطاها بدل ما نكسر الحساب.
    function calculateMaterialsCost(recipe) {
        const entries = (recipe && recipe.ingredients) || [];
        let total = 0;

        entries.forEach(function (entry) {
            const ingredient = window.tasceerIngredients.getIngredientById(entry.ingredientId);
            if (!ingredient) {
                return;
            }
            const costPerUnit = ingredient.packagePrice / ingredient.packageWeightInGrams;
            total += costPerUnit * Number(entry.quantity);
        });

        return round2(total);
    }

    // === تكلفة الطاقة ===
    // نقرأ تعرفة الكهرباء وسعر الأسطوانة من الوصفة نفسها.
    // إذا كانت الوصفة لا تحتوي على قيمة مخصصة (مثل الوصفات
    // القديمة)، نستخدم القيم الافتراضية عبر ??.
    function calculateEnergyCost(recipe) {
        const cookMinutes = Number(recipe.cookTimeMinutes) || 0;
        const source = recipe.energySource;

        if (source === 'none' || cookMinutes <= 0) {
            return 0;
        }

        // fallback للقيم الافتراضية إذا ما موجودة في الوصفة
        const electricityRateHalalas = recipe.electricityRate ?? DEFAULT_ELECTRICITY_RATE;
        const gasCylinderPrice = recipe.gasCylinderPrice ?? DEFAULT_GAS_CYLINDER_PRICE;

        // تعرفة الكهرباء بالريال = الهللات ÷ 100
        const electricityRateSAR = Number(electricityRateHalalas) / 100;
        const gasMinutesTotal = GAS_CYLINDER_BURN_HOURS * 60;

        // المعادلة الكهربائية:
        // ساعات الطبخ × استهلاك الفرن (2 كيلوواط) × تعرفة الكهرباء بالريال
        function electricCost(minutes) {
            const hours = minutes / 60;
            return hours * ELECTRIC_OVEN_KW * electricityRateSAR;
        }

        // المعادلة للغاز:
        // دقائق الطبخ × (سعر الأسطوانة ÷ عدد الدقائق الكلية للأسطوانة)
        function gasCost(minutes) {
            return minutes * (Number(gasCylinderPrice) / gasMinutesTotal);
        }

        let cost = 0;
        if (source === 'electric') {
            cost = electricCost(cookMinutes);
        } else if (source === 'gas') {
            cost = gasCost(cookMinutes);
        } else if (source === 'both') {
            // نفترض: نصف الوقت كهرباء ونصفه غاز
            const half = cookMinutes / 2;
            cost = electricCost(half) + gasCost(half);
        }

        return round2(cost);
    }

    // === قيمة الوقت ===
    // مجموع دقائق التحضير والطبخ ÷ 60 × سعر الساعة.
    // إذا كانت الوصفة لا تحتوي على قيمة مخصصة لساعة العمل،
    // نستخدم القيمة الافتراضية.
    function calculateTimeCost(recipe) {
        const prep = Number(recipe.prepTimeMinutes) || 0;
        const cook = Number(recipe.cookTimeMinutes) || 0;
        const totalMinutes = prep + cook;
        const hourlyRate = Number(recipe.hourlyRate ?? DEFAULT_HOURLY_RATE) || 0;

        const cost = (totalMinutes / 60) * hourlyRate;
        return round2(cost);
    }

    // === إجمالي التكلفة الفعلية ===
    // يستخدم قيم الوصفة مباشرة بدون الحاجة لمصدر خارجي للإعدادات.
    function calculateTotalCost(recipe) {
        const materials = calculateMaterialsCost(recipe);
        const energy = calculateEnergyCost(recipe);
        const time = calculateTimeCost(recipe);
        const total = round2(materials + energy + time);

        return {
            materials: materials,
            energy: energy,
            time: time,
            total: total
        };
    }

    // === اقتراح أسعار البيع ===
    // نعطي ثلاث خيارات: ربح 20% و30% و50%.
    function calculateSellingPrices(totalCost, servings) {
        const cost = Number(totalCost) || 0;
        const srv = Number(servings) || 0;

        function priceForMargin(marginDecimal) {
            const total = round2(cost * (1 + marginDecimal));
            const perServing = srv > 0 ? round2(total / srv) : null;
            return { total: total, perServing: perServing };
        }

        return {
            margin20: priceForMargin(0.20),
            margin30: priceForMargin(0.30),
            margin50: priceForMargin(0.50)
        };
    }

    // نعرض كل الدوال + الثوابت على كائن عام في window.
    // القيم الافتراضية معروضة كمان عشان طبقة الواجهة
    // تقدر تستخدمها لتعبئة النموذج في وضع الإضافة.
    window.tasceerPricing = {
        ELECTRIC_OVEN_KW: ELECTRIC_OVEN_KW,
        GAS_CYLINDER_BURN_HOURS: GAS_CYLINDER_BURN_HOURS,
        DEFAULT_HOURLY_RATE: DEFAULT_HOURLY_RATE,
        DEFAULT_ELECTRICITY_RATE: DEFAULT_ELECTRICITY_RATE,
        DEFAULT_GAS_CYLINDER_PRICE: DEFAULT_GAS_CYLINDER_PRICE,
        calculateMaterialsCost: calculateMaterialsCost,
        calculateEnergyCost: calculateEnergyCost,
        calculateTimeCost: calculateTimeCost,
        calculateTotalCost: calculateTotalCost,
        calculateSellingPrices: calculateSellingPrices,
        formatSAR: formatSAR
    };
})();
