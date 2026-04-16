/*
  ============================================
  ملف إدارة العملاء (Supabase)
  ============================================
  كل القراءة والكتابة على جدول customers
  في Supabase. الملف ما يلمس DOM — فقط بيانات.
  ============================================
*/

(function () {
    // ===== مساعد: يرجع معرّف المستخدم الحالي من جلسة Supabase =====
    async function getCurrentUserId() {
        var data = (await window.supabaseClient.auth.getUser()).data;
        return data.user ? data.user.id : null;
    }

    // ===== تحويل صف من قاعدة البيانات إلى كائن جافاسكربت =====
    function dbToCustomer(row) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            phone: row.phone,
            notes: row.notes || null,
            createdAt: row.created_at
        };
    }

    // ===== جلب كل العملاء مرتبين أبجدياً =====
    async function getAllCustomers() {
        var result = await window.supabaseClient
            .from('customers')
            .select('*')
            .order('name', { ascending: true });

        if (result.error) {
            console.error('خطأ في جلب العملاء:', result.error);
            return [];
        }
        return (result.data || []).map(dbToCustomer);
    }

    // ===== جلب عميل واحد بالمعرّف =====
    async function getCustomerById(id) {
        var result = await window.supabaseClient
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (result.error) {
            console.error('خطأ في جلب العميل:', result.error);
            return null;
        }
        return dbToCustomer(result.data);
    }

    // ===== إضافة عميل جديد =====
    async function addCustomer(name, phone, notes) {
        // تحقق: الاسم والجوال مطلوبين
        name = (name || '').trim();
        phone = (phone || '').trim();
        notes = (notes || '').trim() || null;

        if (!name) throw new Error('اسم العميل مطلوب');
        if (!phone) throw new Error('رقم الجوال مطلوب');

        var userId = await getCurrentUserId();
        if (!userId) throw new Error('يجب تسجيل الدخول أولاً');

        var result = await window.supabaseClient
            .from('customers')
            .insert({
                user_id: userId,
                name: name,
                phone: phone,
                notes: notes
            })
            .select()
            .single();

        if (result.error) {
            // خطأ تكرار
            if (result.error.code === '23505') {
                throw new Error('يوجد عميل بنفس البيانات');
            }
            throw new Error('حصل خطأ أثناء حفظ العميل: ' + result.error.message);
        }
        return dbToCustomer(result.data);
    }

    // ===== تعديل عميل موجود =====
    async function updateCustomer(id, name, phone, notes) {
        name = (name || '').trim();
        phone = (phone || '').trim();
        notes = (notes || '').trim() || null;

        if (!name) throw new Error('اسم العميل مطلوب');
        if (!phone) throw new Error('رقم الجوال مطلوب');

        var result = await window.supabaseClient
            .from('customers')
            .update({
                name: name,
                phone: phone,
                notes: notes
            })
            .eq('id', id)
            .select()
            .single();

        if (result.error) {
            throw new Error('حصل خطأ أثناء تعديل العميل: ' + result.error.message);
        }
        return dbToCustomer(result.data);
    }

    // ===== حذف عميل =====
    async function deleteCustomer(id) {
        var result = await window.supabaseClient
            .from('customers')
            .delete()
            .eq('id', id);

        if (result.error) {
            throw new Error('حصل خطأ أثناء حذف العميل: ' + result.error.message);
        }
    }

    // ===== بحث في العملاء بالاسم أو رقم الجوال =====
    async function searchCustomers(query) {
        query = (query || '').trim();
        if (!query) return getAllCustomers();

        var result = await window.supabaseClient
            .from('customers')
            .select('*')
            .or('name.ilike.%' + query + '%,phone.ilike.%' + query + '%')
            .order('name', { ascending: true });

        if (result.error) {
            console.error('خطأ في البحث عن العملاء:', result.error);
            return [];
        }
        return (result.data || []).map(dbToCustomer);
    }

    // ===== تصدير الدوال العامة =====
    window.tasceerCustomers = {
        getAllCustomers: getAllCustomers,
        getCustomerById: getCustomerById,
        addCustomer: addCustomer,
        updateCustomer: updateCustomer,
        deleteCustomer: deleteCustomer,
        searchCustomers: searchCustomers
    };
})();
