/*
  ============================================
  ملف إدارة الوصفات (Supabase)
  ============================================
  الوصفات الآن في جدول recipes، ومكونات كل وصفة
  في جدول مستقل recipe_ingredients. هذا الملف
  يغلّف كل هذا ويرجع للكود العادي كائن وصفة
  "مدمج" فيه حقل ingredients كمصفوفة — بنفس
  الشكل القديم — ليقل تأثير التغيير على باقي
  الملفات.

  كل الدوال async. أسماء الأعمدة في القاعدة
  snake_case، والتطبيق camelCase، ولذا نستخدم
  دوال تحويل dbToRecipe/dbToEntry.
  ============================================
*/

(function () {
    async function getCurrentUserId() {
        const { data } = await window.supabaseClient.auth.getUser();
        return data.user ? data.user.id : null;
    }

    // ===== تحويل صف recipe_ingredients إلى كائن مصفوفة الوصفة =====
    function dbToEntry(row) {
        return {
            ingredientId: row.ingredient_id,
            quantity: Number(row.quantity),
            displayUnit: row.display_unit
        };
    }

    // ===== تحويل صف recipes + قائمة مدخلاته إلى كائن جافاسكربت =====
    function dbToRecipe(row, ingredientEntries) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            servings: Number(row.servings),
            prepTimeMinutes: Number(row.prep_time_minutes),
            cookTimeMinutes: Number(row.cook_time_minutes),
            energySource: row.energy_source,
            hourlyRate: Number(row.hourly_rate),
            electricityRate: Number(row.electricity_rate),
            gasCylinderPrice: Number(row.gas_cylinder_price),
            packagingCost: Number(row.packaging_cost),
            deliveryCost: Number(row.delivery_cost),
            otherCost: Number(row.other_cost),
            imageUrl: row.image_url || null,
            createdAt: row.created_at,
            ingredients: (ingredientEntries || []).map(dbToEntry)
        };
    }

    // ===== تحويل الكمية من وحدة المستخدم إلى الوحدة الأساسية =====
    function convertToBaseUnit(amount, unit) {
        const n = Number(amount);
        if (unit === 'kg' || unit === 'l') {
            return n * 1000;
        }
        return n;
    }

    // ترجع كل وصفات المستخدم مع مكوناتها.
    // للتحسين: نجيب كل recipe_ingredients لكل الوصفات بطلب واحد
    // ثم نجمّعها حسب recipe_id (بدل N+1 طلبات).
    async function getAllRecipes() {
        const userId = await getCurrentUserId();
        if (!userId) return [];

        // ١. كل الوصفات
        const { data: recipeRows, error: recipesError } = await window.supabaseClient
            .from('recipes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (recipesError) {
            console.error('getAllRecipes error:', recipesError);
            return [];
        }
        if (!recipeRows || recipeRows.length === 0) {
            return [];
        }

        // ٢. كل recipe_ingredients دفعة وحدة
        const recipeIds = recipeRows.map(function (r) { return r.id; });
        const { data: entryRows, error: entriesError } = await window.supabaseClient
            .from('recipe_ingredients')
            .select('*')
            .in('recipe_id', recipeIds);

        if (entriesError) {
            console.error('recipe_ingredients fetch error:', entriesError);
            // نرجع الوصفات بدون مكونات بدل ما ننهار
            return recipeRows.map(function (r) { return dbToRecipe(r, []); });
        }

        // ٣. نجمّع المدخلات حسب recipe_id
        const byRecipeId = {};
        (entryRows || []).forEach(function (entry) {
            if (!byRecipeId[entry.recipe_id]) {
                byRecipeId[entry.recipe_id] = [];
            }
            byRecipeId[entry.recipe_id].push(entry);
        });

        return recipeRows.map(function (r) {
            return dbToRecipe(r, byRecipeId[r.id] || []);
        });
    }

    // ترجع وصفة واحدة مع مكوناتها.
    async function getRecipeById(id) {
        if (!id) {
            throw new Error('رقم الوصفة مطلوب');
        }

        const { data: recipeRow, error: recipeError } = await window.supabaseClient
            .from('recipes')
            .select('*')
            .eq('id', id)
            .single();

        if (recipeError || !recipeRow) {
            if (recipeError && recipeError.code !== 'PGRST116') {
                console.error('getRecipeById error:', recipeError);
            }
            return null;
        }

        const { data: entryRows, error: entriesError } = await window.supabaseClient
            .from('recipe_ingredients')
            .select('*')
            .eq('recipe_id', id);

        if (entriesError) {
            console.error('recipe_ingredients fetch error:', entriesError);
            return dbToRecipe(recipeRow, []);
        }

        return dbToRecipe(recipeRow, entryRows || []);
    }

    // تضيف وصفة جديدة (بدون مكونات — تضاف لاحقاً عبر addIngredientToRecipe)
    // imageUrl اختياري — رابط صورة الوصفة في Supabase Storage
    async function addRecipe(name, servings, prepTime, cookTime, energySource, hourlyRate, electricityRate, gasCylinderPrice, packagingCost, deliveryCost, otherCost, imageUrl) {
        const userId = await getCurrentUserId();
        if (!userId) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }

        // تحقق من التكاليف الإضافية
        const pkg = Number(packagingCost);
        const del = Number(deliveryCost);
        const oth = Number(otherCost);
        if (!(pkg >= 0)) throw new Error('تكلفة التغليف لازم تكون رقم صفر أو أكثر.');
        if (!(del >= 0)) throw new Error('تكلفة التوصيل لازم تكون رقم صفر أو أكثر.');
        if (!(oth >= 0)) throw new Error('التكاليف الأخرى لازم تكون رقم صفر أو أكثر.');

        var insertData = {
            user_id: userId,
            name: name.trim(),
            servings: Number(servings),
            prep_time_minutes: Number(prepTime),
            cook_time_minutes: Number(cookTime),
            energy_source: energySource,
            hourly_rate: Number(hourlyRate),
            electricity_rate: Number(electricityRate),
            gas_cylinder_price: Number(gasCylinderPrice),
            packaging_cost: pkg,
            delivery_cost: del,
            other_cost: oth
        };
        // نضيف رابط الصورة فقط لو موجود
        if (imageUrl !== undefined && imageUrl !== null) {
            insertData.image_url = imageUrl;
        }

        const { data, error } = await window.supabaseClient
            .from('recipes')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('addRecipe error:', error);
            throw new Error('تعذر حفظ الوصفة. حاول مرة أخرى.');
        }
        return dbToRecipe(data, []);
    }

    // تعدّل حقول وصفة موجودة. لا نلمس recipe_ingredients هنا.
    // imageUrl: لو undefined = ما نلمس الصورة الحالية، لو null = نحذفها، لو string = نحدّثها
    async function updateRecipe(id, name, servings, prepTime, cookTime, energySource, hourlyRate, electricityRate, gasCylinderPrice, packagingCost, deliveryCost, otherCost, imageUrl) {
        if (!id) throw new Error('رقم الوصفة مطلوب');

        const pkg = Number(packagingCost);
        const del = Number(deliveryCost);
        const oth = Number(otherCost);
        if (!(pkg >= 0)) throw new Error('تكلفة التغليف لازم تكون رقم صفر أو أكثر.');
        if (!(del >= 0)) throw new Error('تكلفة التوصيل لازم تكون رقم صفر أو أكثر.');
        if (!(oth >= 0)) throw new Error('التكاليف الأخرى لازم تكون رقم صفر أو أكثر.');

        var updateData = {
            name: name.trim(),
            servings: Number(servings),
            prep_time_minutes: Number(prepTime),
            cook_time_minutes: Number(cookTime),
            energy_source: energySource,
            hourly_rate: Number(hourlyRate),
            electricity_rate: Number(electricityRate),
            gas_cylinder_price: Number(gasCylinderPrice),
            packaging_cost: pkg,
            delivery_cost: del,
            other_cost: oth
        };
        // نحدّث الصورة فقط لو المستخدم غيّرها أو حذفها
        // undefined = ما نلمسها، null = نحذفها، string = صورة جديدة
        if (imageUrl !== undefined) {
            updateData.image_url = imageUrl;
        }

        const { data, error } = await window.supabaseClient
            .from('recipes')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('updateRecipe error:', error);
            throw new Error('تعذر تعديل الوصفة. حاول مرة أخرى.');
        }
        return dbToRecipe(data, []);
    }

    // تحذف وصفة. CASCADE في القاعدة يحذف recipe_ingredients التابعة.
    // قبل الحذف: نجيب الوصفة عشان نحذف صورتها من Storage لو موجودة.
    async function deleteRecipe(id) {
        if (!id) throw new Error('رقم الوصفة مطلوب');

        // نجيب الوصفة أولاً عشان نعرف لو عندها صورة
        var imageUrl = null;
        var fetchResult = await window.supabaseClient
            .from('recipes')
            .select('image_url')
            .eq('id', id)
            .single();
        if (fetchResult.data && fetchResult.data.image_url) {
            imageUrl = fetchResult.data.image_url;
        }

        const { error } = await window.supabaseClient
            .from('recipes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('deleteRecipe error:', error);
            throw new Error('تعذر حذف الوصفة. حاول مرة أخرى.');
        }

        // بعد الحذف: ننظف الصورة من Storage (محاولة — لو فشلت ما يهم)
        if (imageUrl) {
            deleteRecipeImage(imageUrl);
        }
    }

    // تضيف مكوناً إلى وصفة. لو المكون مكرر نكشف خطأ unique constraint
    // ونرمي رسالة عربية مفهومة.
    async function addIngredientToRecipe(recipeId, ingredientId, userAmount, userUnit) {
        if (!recipeId) throw new Error('رقم الوصفة مطلوب');
        if (!ingredientId) throw new Error('رقم المكون مطلوب');

        const quantity = convertToBaseUnit(userAmount, userUnit);

        const { data, error } = await window.supabaseClient
            .from('recipe_ingredients')
            .insert({
                recipe_id: recipeId,
                ingredient_id: ingredientId,
                quantity: quantity,
                display_unit: userUnit
            })
            .select()
            .single();

        if (error) {
            // رمز 23505 = مخالفة unique constraint في Postgres
            if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('duplicate'))) {
                throw new Error('هذا المكون مضاف بالفعل إلى الوصفة');
            }
            console.error('addIngredientToRecipe error:', error);
            throw new Error('تعذر إضافة المكون إلى الوصفة.');
        }
        return dbToEntry(data);
    }

    // تحذف مكوناً من وصفة
    async function removeIngredientFromRecipe(recipeId, ingredientId) {
        if (!recipeId) throw new Error('رقم الوصفة مطلوب');
        if (!ingredientId) throw new Error('رقم المكون مطلوب');

        const { error } = await window.supabaseClient
            .from('recipe_ingredients')
            .delete()
            .eq('recipe_id', recipeId)
            .eq('ingredient_id', ingredientId);

        if (error) {
            console.error('removeIngredientFromRecipe error:', error);
            throw new Error('تعذر إزالة المكون.');
        }
    }

    // تحدّث كمية مكون داخل وصفة
    async function updateIngredientInRecipe(recipeId, ingredientId, userAmount, userUnit) {
        if (!recipeId) throw new Error('رقم الوصفة مطلوب');
        if (!ingredientId) throw new Error('رقم المكون مطلوب');

        const quantity = convertToBaseUnit(userAmount, userUnit);

        const { error } = await window.supabaseClient
            .from('recipe_ingredients')
            .update({ quantity: quantity, display_unit: userUnit })
            .eq('recipe_id', recipeId)
            .eq('ingredient_id', ingredientId);

        if (error) {
            console.error('updateIngredientInRecipe error:', error);
            throw new Error('تعذر تعديل كمية المكون.');
        }
    }

    // ===== رفع صورة وصفة إلى Supabase Storage =====
    // ناخذ ملف الصورة، نضغطه، نرفعه، ونرجع الرابط العام.
    async function uploadRecipeImage(file) {
        var userId = await getCurrentUserId();
        if (!userId) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }

        // نضغط الصورة قبل الرفع عشان نوفّر في الحجم والسرعة
        var compressedBlob = await window.tasceerImageUtils.compressImage(file);

        // ننشئ اسم فريد: مجلد المستخدم / وقت + رقم عشوائي
        var randomStr = Math.random().toString(36).substring(2, 8);
        var path = userId + '/' + Date.now() + '-' + randomStr + '.jpg';

        // نرفع الصورة المضغوطة
        var uploadResult = await window.supabaseClient.storage
            .from('recipe-images')
            .upload(path, compressedBlob, { contentType: 'image/jpeg' });

        if (uploadResult.error) {
            console.error('uploadRecipeImage error:', uploadResult.error);
            throw new Error('فشل رفع الصورة. حاول مرة أخرى.');
        }

        // نجيب الرابط العام
        var urlResult = window.supabaseClient.storage
            .from('recipe-images')
            .getPublicUrl(path);

        return urlResult.data.publicUrl;
    }

    // ===== حذف صورة وصفة من Supabase Storage =====
    // نستخرج المسار من الرابط ونحذف الملف.
    // لو فشل الحذف نسجّل الخطأ بس ما نرمي استثناء (أفضل جهد).
    async function deleteRecipeImage(imageUrl) {
        try {
            // نستخرج المسار: كل شي بعد /recipe-images/
            var marker = '/recipe-images/';
            var idx = imageUrl.indexOf(marker);
            if (idx === -1) {
                console.warn('deleteRecipeImage: تعذر استخراج المسار من الرابط');
                return;
            }
            var path = decodeURIComponent(imageUrl.substring(idx + marker.length));

            var result = await window.supabaseClient.storage
                .from('recipe-images')
                .remove([path]);

            if (result.error) {
                console.error('deleteRecipeImage error:', result.error);
            }
        } catch (err) {
            console.error('deleteRecipeImage error:', err);
        }
    }

    window.tasceerRecipes = {
        getAllRecipes: getAllRecipes,
        getRecipeById: getRecipeById,
        addRecipe: addRecipe,
        updateRecipe: updateRecipe,
        deleteRecipe: deleteRecipe,
        addIngredientToRecipe: addIngredientToRecipe,
        removeIngredientFromRecipe: removeIngredientFromRecipe,
        updateIngredientInRecipe: updateIngredientInRecipe,
        uploadRecipeImage: uploadRecipeImage,
        deleteRecipeImage: deleteRecipeImage
    };
})();
