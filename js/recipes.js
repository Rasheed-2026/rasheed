/*
  ============================================
  ملف إدارة الوصفات
  ============================================
  نفس فكرة ingredients.js لكن للوصفات.
  كل عمليات الحفظ والقراءة من ذاكرة المتصفح
  (localStorage) موجودة هنا، والملف ما يلمس
  DOM إطلاقاً. التحقق من المدخلات مسؤولية
  ملف الواجهة recipes-main.js.
  ============================================
*/

(function () {
    // مفتاح مختلف عن المكونات عشان تبقى البيانات مستقلة
    const STORAGE_KEY = 'tasceer_recipes';

    // دالة داخلية: تحفظ كامل قائمة الوصفات في localStorage
    function saveRecipes(recipes) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
    }

    // ترجع كل الوصفات المحفوظة. لو ما فيه شي، ترجع قائمة فاضية.
    function getAllRecipes() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            // لو البيانات تالفة، نرجع قائمة فاضية بدل ما نكسر البرنامج
            return [];
        }
    }

    // ترجع وصفة واحدة حسب رقمها التعريفي، أو null لو ما وجدتها
    function getRecipeById(id) {
        if (!id) {
            throw new Error('رقم الوصفة مطلوب');
        }
        const recipes = getAllRecipes();
        const found = recipes.find(function (item) {
            return item.id === id;
        });
        return found || null;
    }

    // تضيف وصفة جديدة. المكونات تبدأ كقائمة فاضية،
    // وبنضيف طريقة اختيارها في الجلسة القادمة.
    function addRecipe(name, servings, prepTime, cookTime, energySource) {
        const newRecipe = {
            id: crypto.randomUUID(),
            name: name.trim(),
            servings: Number(servings),
            prepTimeMinutes: Number(prepTime),
            cookTimeMinutes: Number(cookTime),
            energySource: energySource,
            ingredients: [],
            createdAt: new Date().toISOString()
        };

        const recipes = getAllRecipes();
        recipes.push(newRecipe);
        saveRecipes(recipes);

        return newRecipe;
    }

    // تعدّل الحقول الأساسية لوصفة موجودة.
    // مهم: نحافظ على قائمة المكونات كما هي، لأنها
    // ستمتلئ في الجلسة القادمة ولا نبغى نفقدها عند التعديل.
    function updateRecipe(id, name, servings, prepTime, cookTime, energySource) {
        if (!id) {
            throw new Error('رقم الوصفة مطلوب');
        }

        const recipes = getAllRecipes();
        const index = recipes.findIndex(function (item) {
            return item.id === id;
        });

        if (index === -1) {
            throw new Error('الوصفة غير موجودة: ' + id);
        }

        const existing = recipes[index];

        recipes[index] = {
            id: existing.id,
            name: name.trim(),
            servings: Number(servings),
            prepTimeMinutes: Number(prepTime),
            cookTimeMinutes: Number(cookTime),
            energySource: energySource,
            // نحافظ على المكونات السابقة بدون أي تغيير
            ingredients: existing.ingredients || [],
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        };

        saveRecipes(recipes);
        return recipes[index];
    }

    // تحذف وصفة حسب رقمها التعريفي
    function deleteRecipe(id) {
        if (!id) {
            throw new Error('رقم الوصفة مطلوب');
        }
        const recipes = getAllRecipes();
        const filtered = recipes.filter(function (item) {
            return item.id !== id;
        });
        saveRecipes(filtered);
    }

    // نعرض كل الدوال مرة وحدة على كائن عام في window
    window.tasceerRecipes = {
        getAllRecipes: getAllRecipes,
        getRecipeById: getRecipeById,
        addRecipe: addRecipe,
        updateRecipe: updateRecipe,
        deleteRecipe: deleteRecipe,
        saveRecipes: saveRecipes
    };
})();
