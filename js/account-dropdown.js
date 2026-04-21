/*
  ============================================
  قائمة الحساب المنسدلة — منطق الفتح والإغلاق
  ============================================
  يعمل فقط على الديسكتوب (>= 769px).
  الجوال يستخدم hamburger menu بدلاً.
  ============================================
*/

(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var dropdown = document.getElementById('account-dropdown');
        var trigger = document.getElementById('account-dropdown-btn');
        var menu = document.getElementById('account-dropdown-menu');

        // لو الصفحة ما فيها القائمة (مثلاً auth.html) نخرج بهدوء
        if (!dropdown || !trigger || !menu) {
            return;
        }

        function openMenu() {
            menu.hidden = false;
            dropdown.setAttribute('data-open', 'true');
            trigger.setAttribute('aria-expanded', 'true');
        }

        function closeMenu() {
            menu.hidden = true;
            dropdown.setAttribute('data-open', 'false');
            trigger.setAttribute('aria-expanded', 'false');
        }

        // فتح/إغلاق بالضغط على الزر
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            if (menu.hidden) {
                openMenu();
            } else {
                closeMenu();
            }
        });

        // إغلاق بالضغط خارج القائمة
        document.addEventListener('click', function (e) {
            if (!dropdown.contains(e.target)) {
                closeMenu();
            }
        });

        // إغلاق بمفتاح Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !menu.hidden) {
                closeMenu();
            }
        });
    });
})();
