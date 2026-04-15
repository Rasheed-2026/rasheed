/*
  ============================================
  ملف إدارة المكونات (Supabase)
  ============================================
  كل القراءة والكتابة الآن على جدول ingredients
  في Supabase عبر window.supabaseClient. كل دوال
  البيانات صارت async وترجع Promises.
  الملف ما يلمس DOM — فقط بيانات + تنسيق عرض.
  ============================================
*/

(function () {
    // ===== مساعد: يرجع معرّف المستخدم الحالي من جلسة Supabase =====
    async function getCurrentUserId() {
        const { data } = await window.supabaseClient.auth.getUser();
        return data.user ? data.user.id : null;
    }

    // ===== تحويل صف من قاعدة البيانات إلى كائن جافاسكربت =====
    // الأعمدة في القاعدة snake_case، والتطبيق يستخدم camelCase.
    // أي تعديل هنا ينعكس على كل الصفحات، فلازم يكون دقيق.
    function dbToIngredient(row) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            packageWeightInGrams: Number(row.package_weight_in_grams),
            unitType: row.unit_type,
            packagePrice: Number(row.package_price),
            createdAt: row.created_at
        };
    }

    // ===== مساعد: يحوّل الكمية والوحدة إلى الوحدة الأساسية =====
    // نستخدم نفس المنطق السابق: كيلو→جرام، لتر→مل، والبقية كما هي.
    function toBaseUnit(packageAmount, unit) {
        let value = Number(packageAmount);
        let unitType = 'weight';

        if (unit === 'g') {
            unitType = 'weight';
        } else if (unit === 'kg') {
            value = value * 1000;
            unitType = 'weight';
        } else if (unit === 'ml') {
            unitType = 'volume';
        } else if (unit === 'l') {
            value = value * 1000;
            unitType = 'volume';
        } else if (unit === 'piece') {
            unitType = 'piece';
        }

        return { value: value, unitType: unitType };
    }

    // ترجع كل المكونات الخاصة بالمستخدم الحالي.
    // لو حصل أي خطأ، نعرضه في الكونسول ونرجع مصفوفة فاضية
    // عشان ما نكسر الصفحة.
    async function getAllIngredients() {
        const userId = await getCurrentUserId();
        if (!userId) return [];

        const { data, error } = await window.supabaseClient
            .from('ingredients')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('getAllIngredients error:', error);
            return [];
        }
        return (data || []).map(dbToIngredient);
    }

    // ترجع مكون واحد حسب رقمه التعريفي، أو null لو ما وجدته.
    async function getIngredientById(id) {
        if (!id) return null;
        const { data, error } = await window.supabaseClient
            .from('ingredients')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            if (error && error.code !== 'PGRST116') {
                console.error('getIngredientById error:', error);
            }
            return null;
        }
        return dbToIngredient(data);
    }

    // تضيف مكون جديد. ترجع المكون بعد حفظه (بالصيغة camelCase).
    // ترمي خطأ برسالة عربية لو فشل الإدخال.
    async function addIngredient(name, packageAmount, unit, price) {
        const userId = await getCurrentUserId();
        if (!userId) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }

        const base = toBaseUnit(packageAmount, unit);

        const { data, error } = await window.supabaseClient
            .from('ingredients')
            .insert({
                user_id: userId,
                name: name.trim(),
                package_weight_in_grams: base.value,
                unit_type: base.unitType,
                package_price: Number(price)
            })
            .select()
            .single();

        if (error) {
            console.error('addIngredient error:', error);
            throw new Error('تعذر حفظ المكون. حاول مرة أخرى.');
        }
        return dbToIngredient(data);
    }

    // تعدّل مكون موجود. تستخدم نفس منطق تحويل الوحدات.
    async function updateIngredient(id, name, packageAmount, unit, price) {
        const base = toBaseUnit(packageAmount, unit);

        const { data, error } = await window.supabaseClient
            .from('ingredients')
            .update({
                name: name.trim(),
                package_weight_in_grams: base.value,
                unit_type: base.unitType,
                package_price: Number(price)
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('updateIngredient error:', error);
            throw new Error('تعذر تعديل المكون. حاول مرة أخرى.');
        }
        return dbToIngredient(data);
    }

    // تحذف مكون حسب رقمه التعريفي.
    async function deleteIngredient(id) {
        const { error } = await window.supabaseClient
            .from('ingredients')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('deleteIngredient error:', error);
            throw new Error('تعذر حذف المكون. حاول مرة أخرى.');
        }
    }

    // === دوال تنسيق العرض (تبقى متزامنة — لا تلمس البيانات) ===

    function formatNumber(num) {
        return Number(num.toFixed(2)).toString();
    }

    // ترجع الكمية والوحدة المناسبة لعرض المكون
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

    // نعرض كل الدوال على كائن عام في window
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
