// حارس الصفحات: يتأكد إن المستخدم مسجّل دخول قبل ما يفتح أي صفحة محمية.
// لو ما فيه جلسة → نحوّله لصفحة تسجيل الدخول.
// كمان يراقب حالة الدخول: لو المستخدم ضغط "تسجيل الخروج" في أي مكان،
// يحوّله تلقائياً لصفحة الدخول.

(async function checkAuth() {
    try {
        const { data } = await window.supabaseClient.auth.getSession();
        if (!data.session) {
            window.location.href = 'auth.html';
            return;
        }
    } catch (err) {
        // في حال حصل خطأ، نحوّل للدخول كإجراء احتياطي
        window.location.href = 'auth.html';
    }
})();

// نستمع لتغيّر حالة الدخول — لو سجّل المستخدم خروج نرجّعه لصفحة الدخول
window.supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        window.location.href = 'auth.html';
    }
});

// ربط زر "تسجيل الخروج" لو موجود في الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await window.supabaseClient.auth.signOut();
            // onAuthStateChange بيتكفّل بالتحويل
        });
    }

    // قائمة الهامبرغر للجوال: فتح/إغلاق القائمة
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navMenu = document.getElementById('nav-menu');

    if (hamburgerBtn && navMenu) {
        hamburgerBtn.addEventListener('click', function () {
            navMenu.classList.toggle('nav-menu--open');
        });

        // إغلاق القائمة عند الضغط على أي رابط أو زر داخلها
        navMenu.querySelectorAll('a, button').forEach(function (el) {
            el.addEventListener('click', function () {
                navMenu.classList.remove('nav-menu--open');
            });
        });

        // إغلاق القائمة عند الضغط خارجها
        document.addEventListener('click', function (e) {
            if (!navMenu.contains(e.target) && e.target !== hamburgerBtn) {
                navMenu.classList.remove('nav-menu--open');
            }
        });
    }
});
