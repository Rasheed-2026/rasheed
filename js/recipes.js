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

    // تضيف وصفة جديدة.
    // شكل الوصفة الكامل الآن يحتوي على:
    //   - name, servings, prepTimeMinutes, cookTimeMinutes, energySource
    //   - ingredients[]
    //   - hourlyRate: قيمة ساعة العمل لهذه الوصفة (ريال)
    //   - electricityRate: تعرفة الكهرباء (هللة لكل كيلوواط ساعة)
    //   - gasCylinderPrice: سعر أسطوانة الغاز (ريال)
    //   - packagingCost: تكلفة التغليف للوصفة كاملة (ريال) — اختياري
    //   - deliveryCost: تكلفة التوصيل للوصفة كاملة (ريال) — اختياري
    //   - otherCost: أي تكاليف إضافية أخرى (ريال) — اختياري
    // الحقول الإضافية كلها اختيارية. الوصفات القديمة قبل
    // إضافتها لا تحتوي عليها، وطبقة الحسابات في pricing.js
    // ترجع تلقائياً إلى 0 عبر ?? — بدون أي migration.
    function addRecipe(name, servings, prepTime, cookTime, energySource, hourlyRate, electricityRate, gasCylinderPrice, packagingCost, deliveryCost, otherCost) {
        // تحقق من أن التكاليف الإضافية أرقام غير سالبة (الصفر مسموح)
        const pkg = Number(packagingCost);
        const del = Number(deliveryCost);
        const oth = Number(otherCost);
        if (!(pkg >= 0)) {
            throw new Error('تكلفة التغليف لازم تكون رقم صفر أو أكثر.');
        }
        if (!(del >= 0)) {
            throw new Error('تكلفة التوصيل لازم تكون رقم صفر أو أكثر.');
        }
        if (!(oth >= 0)) {
            throw new Error('التكاليف الأخرى لازم تكون رقم صفر أو أكثر.');
        }

        const newRecipe = {
            id: crypto.randomUUID(),
            name: name.trim(),
            servings: Number(servings),
            prepTimeMinutes: Number(prepTime),
            cookTimeMinutes: Number(cookTime),
            energySource: energySource,
            hourlyRate: Number(hourlyRate),
            electricityRate: Number(electricityRate),
            gasCylinderPrice: Number(gasCylinderPrice),
            packagingCost: pkg,
            deliveryCost: del,
            otherCost: oth,
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
    function updateRecipe(id, name, servings, prepTime, cookTime, energySource, hourlyRate, electricityRate, gasCylinderPrice, packagingCost, deliveryCost, otherCost) {
        if (!id) {
            throw new Error('رقم الوصفة مطلوب');
        }

        // تحقق من أن التكاليف الإضافية أرقام غير سالبة
        const pkg = Number(packagingCost);
        const del = Number(deliveryCost);
        const oth = Number(otherCost);
        if (!(pkg >= 0)) {
            throw new Error('تكلفة التغليف لازم تكون رقم صفر أو أكثر.');
        }
        if (!(del >= 0)) {
            throw new Error('تكلفة التوصيل لازم تكون رقم صفر أو أكثر.');
        }
        if (!(oth >= 0)) {
            throw new Error('التكاليف الأخرى لازم تكون رقم صفر أو أكثر.');
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
            // قيم التسعير الخاصة بالوصفة
            hourlyRate: Number(hourlyRate),
            electricityRate: Number(electricityRate),
            gasCylinderPrice: Number(gasCylinderPrice),
            // التكاليف الإضافية
            packagingCost: pkg,
            deliveryCost: del,
            otherCost: oth,
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

    // دالة مساعدة: تحوّل الكمية من الوحدة اللي اختارها المستخدم
    // إلى الوحدة الأساسية (جرام للوزن، مليلتر للحجم، كما هي للقطعة).
    // نستخدم نفس قواعد التحويل الموجودة في ingredients.js
    function convertToBaseUnit(amount, unit) {
        const n = Number(amount);
        if (unit === 'kg' || unit === 'l') {
            return n * 1000;
        }
        // g, ml, piece — تبقى كما هي
        return n;
    }

    // تضيف مكوناً إلى وصفة معينة بكمية محددة.
    // الكمية المخزّنة دائماً بالوحدة الأساسية، أما displayUnit
    // فيحفظ الوحدة اللي اختارها المستخدم عشان نعرضها له لاحقاً.
    function addIngredientToRecipe(recipeId, ingredientId, userAmount, userUnit) {
        if (!recipeId) {
            throw new Error('رقم الوصفة مطلوب');
        }
        if (!ingredientId) {
            throw new Error('رقم المكون مطلوب');
        }

        const recipes = getAllRecipes();
        const index = recipes.findIndex(function (r) {
            return r.id === recipeId;
        });
        if (index === -1) {
            throw new Error('الوصفة غير موجودة: ' + recipeId);
        }

        // نتأكد أن المكون موجود فعلاً في قائمة المكونات
        const ingredient = window.tasceerIngredients.getIngredientById(ingredientId);
        if (!ingredient) {
            throw new Error('المكون غير موجود: ' + ingredientId);
        }

        const recipe = recipes[index];
        if (!recipe.ingredients) {
            recipe.ingredients = [];
        }

        recipe.ingredients.push({
            ingredientId: ingredientId,
            quantity: convertToBaseUnit(userAmount, userUnit),
            displayUnit: userUnit
        });

        saveRecipes(recipes);
        return recipe;
    }

    // تحذف مكوناً من وصفة. نفترض أن المكون ما يتكرر
    // داخل نفس الوصفة (هذي قاعدة نفرضها في طبقة الواجهة).
    function removeIngredientFromRecipe(recipeId, ingredientId) {
        if (!recipeId) {
            throw new Error('رقم الوصفة مطلوب');
        }
        if (!ingredientId) {
            throw new Error('رقم المكون مطلوب');
        }

        const recipes = getAllRecipes();
        const index = recipes.findIndex(function (r) {
            return r.id === recipeId;
        });
        if (index === -1) {
            throw new Error('الوصفة غير موجودة: ' + recipeId);
        }

        const recipe = recipes[index];
        recipe.ingredients = (recipe.ingredients || []).filter(function (entry) {
            return entry.ingredientId !== ingredientId;
        });

        saveRecipes(recipes);
        return recipe;
    }

    // تحدّث كمية مكون داخل وصفة (غير مستخدمة حالياً في الواجهة
    // لكن موجودة عشان تكون طبقة البيانات كاملة).
    function updateIngredientInRecipe(recipeId, ingredientId, userAmount, userUnit) {
        if (!recipeId) {
            throw new Error('رقم الوصفة مطلوب');
        }
        if (!ingredientId) {
            throw new Error('رقم المكون مطلوب');
        }

        const recipes = getAllRecipes();
        const rIndex = recipes.findIndex(function (r) {
            return r.id === recipeId;
        });
        if (rIndex === -1) {
            throw new Error('الوصفة غير موجودة: ' + recipeId);
        }

        const recipe = recipes[rIndex];
        const entries = recipe.ingredients || [];
        const eIndex = entries.findIndex(function (entry) {
            return entry.ingredientId === ingredientId;
        });
        if (eIndex === -1) {
            throw new Error('المكون غير موجود داخل الوصفة: ' + ingredientId);
        }

        entries[eIndex] = {
            ingredientId: ingredientId,
            quantity: convertToBaseUnit(userAmount, userUnit),
            displayUnit: userUnit
        };

        recipe.ingredients = entries;
        saveRecipes(recipes);
        return recipe;
    }

    // نعرض كل الدوال مرة وحدة على كائن عام في window
    window.tasceerRecipes = {
        getAllRecipes: getAllRecipes,
        getRecipeById: getRecipeById,
        addRecipe: addRecipe,
        updateRecipe: updateRecipe,
        deleteRecipe: deleteRecipe,
        saveRecipes: saveRecipes,
        addIngredientToRecipe: addIngredientToRecipe,
        removeIngredientFromRecipe: removeIngredientFromRecipe,
        updateIngredientInRecipe: updateIngredientInRecipe
    };
})();
