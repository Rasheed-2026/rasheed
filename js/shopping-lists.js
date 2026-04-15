/*
  ============================================
  ملف إدارة القوائم المحفوظة (Supabase)
  ============================================
  القوائم المحفوظة في جدول shopping_lists.
  حقل selections مخزّن كـ JSONB في القاعدة،
  فنقدر نمرّر المصفوفة مباشرة بدون JSON.stringify.
  ============================================
*/

(function () {
    async function getCurrentUserId() {
        const { data } = await window.supabaseClient.auth.getUser();
        return data.user ? data.user.id : null;
    }

    // يحوّل صف القاعدة إلى كائن التطبيق
    function dbToList(row) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            selections: row.selections || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // ترجع كل القوائم المحفوظة للمستخدم الحالي
    async function getAllSavedLists() {
        const userId = await getCurrentUserId();
        if (!userId) return [];

        const { data, error } = await window.supabaseClient
            .from('shopping_lists')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('getAllSavedLists error:', error);
            return [];
        }
        return (data || []).map(dbToList);
    }

    // ترجع قائمة محفوظة واحدة
    async function getSavedListById(id) {
        if (!id) return null;
        const { data, error } = await window.supabaseClient
            .from('shopping_lists')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            if (error && error.code !== 'PGRST116') {
                console.error('getSavedListById error:', error);
            }
            return null;
        }
        return dbToList(data);
    }

    // تحفظ قائمة جديدة باسم + مصفوفة اختيارات
    async function saveList(name, selections) {
        const trimmed = (name || '').trim();
        if (!trimmed) {
            throw new Error('اسم القائمة مطلوب');
        }

        const userId = await getCurrentUserId();
        if (!userId) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }

        // ننسخ المصفوفة بشكل نظيف قبل الحفظ
        const normalized = (selections || []).map(function (s) {
            return { recipeId: s.recipeId, quantity: Number(s.quantity) };
        });

        const { data, error } = await window.supabaseClient
            .from('shopping_lists')
            .insert({
                user_id: userId,
                name: trimmed,
                selections: normalized
            })
            .select()
            .single();

        if (error) {
            console.error('saveList error:', error);
            throw new Error('تعذر حفظ القائمة. حاول مرة أخرى.');
        }
        return dbToList(data);
    }

    // تحذف قائمة محفوظة حسب الرقم
    async function deleteSavedList(id) {
        if (!id) throw new Error('رقم القائمة مطلوب');

        const { error } = await window.supabaseClient
            .from('shopping_lists')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('deleteSavedList error:', error);
            throw new Error('تعذر حذف القائمة. حاول مرة أخرى.');
        }
    }

    window.tasceerShoppingLists = {
        getAllSavedLists: getAllSavedLists,
        getSavedListById: getSavedListById,
        saveList: saveList,
        deleteSavedList: deleteSavedList
    };
})();
