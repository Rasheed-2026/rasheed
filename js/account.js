/*
  ============================================
  ملف بيانات الحساب (Supabase)
  ============================================
  يغلّف كل التعامل مع جدول user_profiles وما
  يخص Supabase Auth. طبقة الواجهة في
  account-main.js تستدعي هذه الدوال فقط ولا
  تلمس Supabase مباشرة.
  ============================================
*/

(function () {

    async function getCurrentUserId() {
        const { data } = await window.supabaseClient.auth.getUser();
        return data.user ? data.user.id : null;
    }

    // ترجع البريد الإلكتروني للمستخدم الحالي
    async function getUserEmail() {
        const { data } = await window.supabaseClient.auth.getUser();
        return data.user ? data.user.email : null;
    }

    // ترجع بيانات المتجر للمستخدم الحالي.
    // لو ما في صف محفوظ بعد، نرجع كائن فاضي بدل null
    // عشان طبقة الواجهة ما تحتاج تتعامل مع null.
    async function getProfile() {
        const userId = await getCurrentUserId();
        if (!userId) {
            return { storeName: null, storeLogoUrl: null, storePhone: null };
        }

        const { data, error } = await window.supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('getProfile error:', error);
            return { storeName: null, storeLogoUrl: null, storePhone: null };
        }

        if (!data) {
            return { storeName: null, storeLogoUrl: null, storePhone: null };
        }

        return {
            storeName: data.store_name || null,
            storeLogoUrl: data.store_logo_url || null,
            storePhone: data.store_phone || null
        };
    }

    // تحفظ بيانات المتجر. نستخدم upsert لأن الصف قد يكون
    // موجوداً أو غير موجود — upsert يضيف أو يعدل بنفس المكالمة.
    // أي قيمة فارغة أو مسافات فقط تتحول null.
    async function saveProfile(storeName, storeLogoUrl, storePhone) {
        const userId = await getCurrentUserId();
        if (!userId) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }

        function cleanString(value) {
            if (value === null || value === undefined) return null;
            var trimmed = String(value).trim();
            return trimmed === '' ? null : trimmed;
        }

        var row = {
            user_id: userId,
            store_name: cleanString(storeName),
            store_logo_url: cleanString(storeLogoUrl),
            store_phone: cleanString(storePhone)
        };

        const { data, error } = await window.supabaseClient
            .from('user_profiles')
            .upsert(row, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) {
            console.error('saveProfile error:', error);
            throw new Error('تعذر حفظ البيانات. حاول مرة أخرى.');
        }

        return {
            storeName: data.store_name || null,
            storeLogoUrl: data.store_logo_url || null,
            storePhone: data.store_phone || null
        };
    }

    // ===== رفع لوجو المتجر إلى Supabase Storage =====
    // نضغط الصورة ثم نرفعها في مجلد المستخدم.
    async function uploadStoreLogo(file) {
        var userId = await getCurrentUserId();
        if (!userId) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }

        var compressedBlob = await window.tasceerImageUtils.compressImage(file);

        var randomStr = Math.random().toString(36).substring(2, 8);
        var path = userId + '/' + Date.now() + '-' + randomStr + '.jpg';

        var uploadResult = await window.supabaseClient.storage
            .from('store-logos')
            .upload(path, compressedBlob, { contentType: 'image/jpeg' });

        if (uploadResult.error) {
            console.error('uploadStoreLogo error:', uploadResult.error);
            throw new Error('فشل رفع اللوجو. حاول مرة أخرى.');
        }

        var urlResult = window.supabaseClient.storage
            .from('store-logos')
            .getPublicUrl(path);

        return urlResult.data.publicUrl;
    }

    // ===== حذف لوجو المتجر من Supabase Storage =====
    // فشل صامت — لو الحذف فشل نسجّل الخطأ فقط ولا نرمي استثناء،
    // لأن الحذف عملية تنظيف ثانوية ما يجب تفشّل حفظ البيانات.
    async function deleteStoreLogo(imageUrl) {
        try {
            var marker = '/store-logos/';
            var idx = imageUrl.indexOf(marker);
            if (idx === -1) {
                console.warn('deleteStoreLogo: تعذر استخراج المسار من الرابط');
                return;
            }
            var path = decodeURIComponent(imageUrl.substring(idx + marker.length));

            var result = await window.supabaseClient.storage
                .from('store-logos')
                .remove([path]);

            if (result.error) {
                console.error('deleteStoreLogo error:', result.error);
            }
        } catch (err) {
            console.error('deleteStoreLogo error:', err);
        }
    }

    window.tasceerAccount = {
        getProfile: getProfile,
        saveProfile: saveProfile,
        getUserEmail: getUserEmail,
        uploadStoreLogo: uploadStoreLogo,
        deleteStoreLogo: deleteStoreLogo
    };
})();
