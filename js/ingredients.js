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
        addIngredient: addIngredient,
        deleteIngredient: deleteIngredient,
        formatPackageSize: formatPackageSize
    };
})();
