/*
  ============================================
  ملف إدارة المكونات
  ============================================
  هذا الملف يحتوي على كل ما يتعلق بحفظ
  وقراءة وحذف المكونات من ذاكرة المتصفح
  (localStorage). يخزن المكونات بوحدات أساسية
  صغيرة (جرام / مليلتر) عشان نقدر نحسب عليها
  بسهولة لاحقاً في الوصفات.
  ============================================
*/

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

    // ننشئ كائن المكون الجديد
    const newIngredient = {
        id: crypto.randomUUID(),
        name: name.trim(),
        packageWeightInGrams: packageWeightInGrams,
        unitType: unitType,
        packagePrice: Number(price),
        createdAt: new Date().toISOString()
    };

    // نضيفه على القائمة الحالية ونحفظ كل شي
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

// نعرض الدوال على كائن عام في window عشان main.js يقدر يستخدمها
// (ما نستخدم ES modules حالياً عشان نبقي الكود بسيط للمبتدئ)
window.tasceerIngredients = {
    getAllIngredients: getAllIngredients,
    addIngredient: addIngredient,
    deleteIngredient: deleteIngredient
};
