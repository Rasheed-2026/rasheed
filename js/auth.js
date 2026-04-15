// منطق صفحة تسجيل الدخول / إنشاء الحساب.
// يستخدم window.supabaseClient اللي انهيّأ في supabase-client.js.

document.addEventListener('DOMContentLoaded', async () => {
    // ١. لو المستخدم مسجّل دخول أصلاً، نحوّله مباشرة للتطبيق
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    if (sessionData.session) {
        window.location.href = 'index.html';
        return;
    }

    // عناصر الصفحة
    const loginTab = document.querySelector('[data-tab="login"]');
    const signupTab = document.querySelector('[data-tab="signup"]');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const messageBox = document.getElementById('auth-message');

    // ٢. التبديل بين تبويب الدخول وتبويب إنشاء الحساب
    function showTab(tab) {
        clearMessage();
        if (tab === 'login') {
            loginTab.classList.add('auth-tab--active');
            signupTab.classList.remove('auth-tab--active');
            loginForm.hidden = false;
            signupForm.hidden = true;
        } else {
            signupTab.classList.add('auth-tab--active');
            loginTab.classList.remove('auth-tab--active');
            signupForm.hidden = false;
            loginForm.hidden = true;
        }
    }

    loginTab.addEventListener('click', () => showTab('login'));
    signupTab.addEventListener('click', () => showTab('signup'));

    // دوال مساعدة لعرض الرسائل (خطأ / نجاح)
    function showError(text) {
        messageBox.textContent = text;
        messageBox.className = 'auth-message auth-message--error';
    }
    function showSuccess(text) {
        messageBox.textContent = text;
        messageBox.className = 'auth-message auth-message--success';
    }
    function clearMessage() {
        messageBox.textContent = '';
        messageBox.className = 'auth-message';
    }

    // زر في حالة تحميل: نبدّل نصه ونعطّله، وبعدها نرجّعه
    function setLoading(button, loading, originalText) {
        if (loading) {
            button.dataset.originalText = originalText || button.textContent;
            button.textContent = 'جاري...';
            button.disabled = true;
        } else {
            button.textContent = button.dataset.originalText || originalText;
            button.disabled = false;
        }
    }

    // ٣. معالج تسجيل الدخول
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessage();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showError('الرجاء إدخال البريد الإلكتروني وكلمة المرور.');
            return;
        }

        const btn = loginForm.querySelector('button[type="submit"]');
        setLoading(btn, true, 'تسجيل الدخول');

        const { error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        setLoading(btn, false, 'تسجيل الدخول');

        if (error) {
            if (error.message && error.message.includes('Invalid login credentials')) {
                showError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
            } else if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
                showError('لم يتم تفعيل البريد الإلكتروني بعد. تحقق من بريدك.');
            } else {
                showError('حدث خطأ. حاول مرة أخرى.');
            }
            return;
        }

        // نجاح الدخول → للصفحة الرئيسية
        window.location.href = 'index.html';
    });

    // ٤. معالج إنشاء الحساب
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessage();

        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-password-confirm').value;

        if (!email || !password) {
            showError('الرجاء تعبئة جميع الحقول.');
            return;
        }
        if (password.length < 6) {
            showError('كلمة المرور يجب أن تكون ٦ أحرف على الأقل.');
            return;
        }
        if (password !== confirm) {
            showError('كلمات المرور غير متطابقة');
            return;
        }

        const btn = signupForm.querySelector('button[type="submit"]');
        setLoading(btn, true, 'إنشاء حساب');

        const { error } = await window.supabaseClient.auth.signUp({ email, password });

        setLoading(btn, false, 'إنشاء حساب');

        if (error) {
            if (error.message && error.message.toLowerCase().includes('already registered')) {
                showError('هذا البريد الإلكتروني مسجل بالفعل');
            } else if (error.message && error.message.toLowerCase().includes('user already')) {
                showError('هذا البريد الإلكتروني مسجل بالفعل');
            } else {
                showError('حدث خطأ. حاول مرة أخرى.');
            }
            return;
        }

        showSuccess('تم إنشاء الحساب بنجاح! تحقق من بريدك الإلكتروني لتفعيل الحساب، ثم سجّل الدخول.');
    });
});
