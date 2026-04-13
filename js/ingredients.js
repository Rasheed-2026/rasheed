/*
  ============================================
  ملف إدارة المكونات
  ============================================
  هذا الملف يحتوي على كل ما يتعلق بحفظ
  وقراءة وحذف المكونات من ذاكرة المتصفح
  (localStorage)، بالإضافة إلى دوال تنسيق
  بسيطة لعرض الحجم والسعر بشكل مفهوم.
  هذا الملف ما يلمس DOM إطلاقاً.
  ============================================
*/

(function () {
    // مفتاح التخزين في ذاكرة المتصفح
    const STORAGE_KEY = 'tasceer_ingredients';

    // دالة داخلية: تحفظ كامل قائمة المكونات في localStorage
    function saveIngredients(ingredients) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients));
    }

    // ترجع كل المكونات المحفوظة. لو ما فيه شي، ترجع قائمة فاضية.
    function getAllIngredients() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            // لو البيانات تالفة لأي سبب، نرجع قائمة فاضية بدل ما نكسر البرنامج
            return [];
        }
    }

    // تضيف مكون جديد. تستقبل الوحدة اللي اختارها المستخدم
    // وتحوّلها للوحدة الأساسية (جرام أو مليلتر) قبل الحفظ.
    function addIngredient(name, packageAmount, unit, price) {
        let packageWeightInGrams = Number(packageAmount);
        let unitType = 'weight';

        // تحويل الوحدة المختارة إلى الوحدة الأساسية
        if (unit === 'g') {
            unitType = 'weight';
        } else if (unit === 'kg') {
            packageWeightInGrams = packageWeightInGrams * 1000;
            unitType = 'weight';
        } else if (unit === 'ml') {
            unitType = 'volume';
        } else if (unit === 'l') {
            packageWeightInGrams = packageWeightInGrams * 1000;
            unitType = 'volume';
        } else if (unit === 'piece') {
            unitType = 'piece';
        }

        const newIngredient = {
            id: crypto.randomUUID(),
            name: name.trim(),
            packageWeightInGrams: packageWeightInGrams,
            unitType: unitType,
            packagePrice: Number(price),
            createdAt: new Date().toISOString()
        };

        const ingredients = getAllIngredients();
        ingredients.push(newIngredient);
        saveIngredients(ingredients);

        return newIngredient;
    }

    // ترجع مكون واحد حسب رقمه التعريفي، أو null لو ما وجدته
    function getIngredientById(id) {
        const ingredients = getAllIngredients();
        const found = ingredients.find(function (item) {
            return item.id === id;
        });
        return found || null;
    }

    // تعدّل مكون موجود. تستخدم نفس منطق تحويل الوحدات
    // المستخدم في addIngredient. لو ما وجدت المكون، ترمي خطأ.
    function updateIngredient(id, name, packageAmount, unit, price) {
        const ingredients = getAllIngredients();
        const index = ingredients.findIndex(function (item) {
            return item.id === id;
        });

        if (index === -1) {
            throw new Error('المكون غير موجود: ' + id);
        }

        // نفس منطق تحويل الوحدات في addIngredient
        let packageWeightInGrams = Number(packageAmount);
        let unitType = 'weight';

        if (unit === 'g') {
            unitType = 'weight';
        } else if (unit === 'kg') {
            packageWeightInGrams = packageWeightInGrams * 1000;
            unitType = 'weight';
        } else if (unit === 'ml') {
            unitType = 'volume';
        } else if (unit === 'l') {
            packageWeightInGrams = packageWeightInGrams * 1000;
            unitType = 'volume';
        } else if (unit === 'piece') {
            unitType = 'piece';
        }

        // نحدّث الحقول مع الإبقاء على id و createdAt
        ingredients[index] = {
            id: ingredients[index].id,
            name: name.trim(),
            packageWeightInGrams: packageWeightInGrams,
            unitType: unitType,
            packagePrice: Number(price),
            createdAt: ingredients[index].createdAt,
            updatedAt: new Date().toISOString()
        };

        saveIngredients(ingredients);
        return ingredients[index];
    }

    // تحذف مكون حسب رقمه التعريفي
    function deleteIngredient(id) {
        const ingredients = getAllIngredients();
        const filtered = ingredients.filter(function (item) {
            return item.id !== id;
        });
        saveIngredients(filtered);
    }

    // === دوال تنسيق العرض ===

    // تنسيق رقم: نشيل الأصفار الزائدة بعد الفاصلة (حد أقصى منزلتين)
    function formatNumber(num) {
        return Number(num.toFixed(2)).toString();
    }

    // ترجع الكمية والوحدة المناسبة لعرض المكون للمستخدم
    // (نفس المنطق المستخدم في formatPackageSize عشان نضمن
    // أن البطاقة ونموذج التعديل يعرضان نفس الوحدة).
    function getDisplayUnit(ingredient) {
        const base = ingredient.packageWeightInGrams;
        const type = ingredient.unitType;

        if (type === 'piece') {
            return { amount: base, unit: 'piece' };
        }
        if (type === 'weight') {
            if (base >= 1000) {
                return { amount: base / 1000, unit: 'kg' };
            }
            return { amount: base, unit: 'g' };
        }
        if (type === 'volume') {
            if (base >= 1000) {
                return { amount: base / 1000, unit: 'l' };
            }
            return { amount: base, unit: 'ml' };
        }
        return { amount: base, unit: 'g' };
    }

    // تختار الوحدة الأنسب لعرض حجم العبوة بشكل مفهوم للمستخدم
    function formatPackageSize(amount, unitType) {
        if (unitType === 'piece') {
            return amount + ' حبة';
        }
        if (unitType === 'weight') {
            if (amount >= 1000) {
                return formatNumber(amount / 1000) + ' كيلوجرام';
            }
            return formatNumber(amount) + ' جرام';
        }
        if (unitType === 'volume') {
            if (amount >= 1000) {
                return formatNumber(amount / 1000) + ' لتر';
            }
            return formatNumber(amount) + ' مليلتر';
        }
        return String(amount);
    }

    // نعرض كل الدوال مرة وحدة على كائن عام في window
    // (ما نستخدم ES modules حالياً عشان نبقي الكود بسيط للمبتدئ)
    window.tasceerIngredients = {
        getAllIngredients: getAllIngredients,
        getIngredientById: getIngredientById,
        addIngredient: addIngredient,
        updateIngredient: updateIngredient,
        deleteIngredient: deleteIngredient,
        formatPackageSize: formatPackageSize,
        getDisplayUnit: getDisplayUnit
    };
})();
