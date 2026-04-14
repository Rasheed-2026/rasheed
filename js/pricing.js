/*
  ============================================
  ملف حسابات التسعير
  ============================================
  هذا الملف يحتوي على كل المعادلات الحسابية
  اللي يعتمد عليها التطبيق لحساب تكلفة الوصفة
  واقتراح سعر البيع. الملف لا يلمس DOM إطلاقاً،
  فقط رياضيات وقراءة بيانات.

  ليش ملف مستقل؟ عشان المستخدم يقدر يفتحه
  ويعدل المعادلات بنفسه بدون ما يخاف يكسر
  الواجهة.

  --------------------------------------------
  الثوابت والفرضيات:
  --------------------------------------------
  - ELECTRIC_OVEN_KW = 2
    الفرن الكهربائي المنزلي تقريباً يستهلك
    2 كيلوواط في الساعة. هذا رقم تقريبي —
    الأفران تختلف قليلاً، لكن 2 كيلوواط
    قيمة وسطية معقولة.

  - GAS_CYLINDER_BURN_HOURS = 14
    أسطوانة الغاز المنزلي السعودية (حوالي
    12 كيلو) تشتغل بالتقريب 14 ساعة متواصلة
    على موقد متوسط اللهب. رقم تقريبي أيضاً.

  - تعرفة الكهرباء مخزّنة بالهللات لكل كيلوواط
    ساعة، فنقسمها على 100 لنحولها إلى ريال.

  - لو كان مصدر الطاقة "كلاهما" (كهرباء وغاز)،
    نفترض أن نصف وقت الطبخ كهرباء ونصفه غاز.
    هذي فرضية بسيطة وواضحة.

  - لو مصدر الطاقة "بدون"، تكلفة الطاقة = 0.

  - تكلفة الماء مو محسوبة في هذي النسخة —
    ممكن نضيفها لاحقاً لو دعت الحاجة.
  ============================================
*/

(function () {
    // استهلاك الفرن الكهربائي بالكيلوواط
    const ELECTRIC_OVEN_KW = 2;
    // عدد الساعات التي تدوم فيها أسطوانة الغاز تقريباً
    const GAS_CYLINDER_BURN_HOURS = 14;

    // تقريب لأقرب منزلتين عشريتين — نستخدمه لكل القيم المالية
    // عشان تبقى الأرقام المعروضة ثابتة ومفهومة.
    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    // تنسيق مبلغ مالي كنص عربي: "12.34 ريال".
    // نعرض دائماً منزلتين عشريتين لتكون الأرقام موحدة.
    function formatSAR(amount) {
        const value = Number(amount) || 0;
        return value.toFixed(2) + ' ريال';
    }

    // === تكلفة المواد الخام ===
    // نحسب لكل مكون في الوصفة: (سعر العبوة ÷ وزن العبوة) × الكمية المستخدمة.
    // ثم نجمع كل التكاليف ونرجع الإجمالي بالريال.
    // لو أحد المكونات محذوف من قائمة المكونات (entry.ingredientId
    // ما يقابله مكون موجود)، نتخطاه بدل ما نكسر الحساب.
    function calculateMaterialsCost(recipe) {
        const entries = (recipe && recipe.ingredients) || [];
        let total = 0;

        entries.forEach(function (entry) {
            const ingredient = window.tasceerIngredients.getIngredientById(entry.ingredientId);
            if (!ingredient) {
                // المكون محذوف — نتخطاه بدون ما نكسر الحساب
                return;
            }
            // سعر الوحدة الواحدة (جرام/مليلتر/قطعة)
            const costPerUnit = ingredient.packagePrice / ingredient.packageWeightInGrams;
            // مساهمة هذا المكون في التكلفة
            total += costPerUnit * Number(entry.quantity);
        });

        return round2(total);
    }

    // === تكلفة الطاقة ===
    // نرجع تكلفة الكهرباء/الغاز لطبخ الوصفة بالريال بناءً
    // على وقت الطبخ ومصدر الطاقة المختار في الوصفة.
    function calculateEnergyCost(recipe, settings) {
        const cookMinutes = Number(recipe.cookTimeMinutes) || 0;
        const source = recipe.energySource;

        // بدون مصدر طاقة = صفر
        if (source === 'none' || cookMinutes <= 0) {
            return 0;
        }

        // تعرفة الكهرباء بالريال = الهللات ÷ 100
        const electricityRateSAR = Number(settings.electricityRate) / 100;
        const gasCylinderPrice = Number(settings.gasCylinderPrice);
        // عدد الدقائق الكلية اللي تدوم فيها أسطوانة الغاز
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
            return minutes * (gasCylinderPrice / gasMinutesTotal);
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
    // يعني: "كم يساوي الوقت اللي صرفتيه على هذي الوصفة بالريال".
    function calculateTimeCost(recipe, settings) {
        const prep = Number(recipe.prepTimeMinutes) || 0;
        const cook = Number(recipe.cookTimeMinutes) || 0;
        const totalMinutes = prep + cook;
        const hourlyRate = Number(settings.hourlyRate) || 0;

        const cost = (totalMinutes / 60) * hourlyRate;
        return round2(cost);
    }

    // === إجمالي التكلفة الفعلية ===
    // نرجع كائن فيه الأجزاء الثلاثة + المجموع.
    // الواجهة تعتمد على هذي الأسماء بالضبط.
    function calculateTotalCost(recipe, settings) {
        const materials = calculateMaterialsCost(recipe);
        const energy = calculateEnergyCost(recipe, settings);
        const time = calculateTimeCost(recipe, settings);
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
    // لكل خيار: السعر الكلي للوصفة + سعر الحصة الواحدة.
    // لو عدد الحصص غير صحيح (≤ 0)، نخلي perServing = null.
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

    // نعرض كل الدوال + الثوابت على كائن عام في window
    // عشان الواجهة تستخدمها (بدون ES modules — نفس نمط بقية الملفات).
    window.tasceerPricing = {
        ELECTRIC_OVEN_KW: ELECTRIC_OVEN_KW,
        GAS_CYLINDER_BURN_HOURS: GAS_CYLINDER_BURN_HOURS,
        calculateMaterialsCost: calculateMaterialsCost,
        calculateEnergyCost: calculateEnergyCost,
        calculateTimeCost: calculateTimeCost,
        calculateTotalCost: calculateTotalCost,
        calculateSellingPrices: calculateSellingPrices,
        formatSAR: formatSAR
    };
})();
