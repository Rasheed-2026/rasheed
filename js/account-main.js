/*
  ============================================
  ملف الواجهة لصفحة حسابي
  ============================================
  يربط نموذج بيانات المتجر بـ window.tasceerAccount.
  كل ما يخص DOM والأحداث والتحقق يعيش هنا،
  وكل ما يخص البيانات في account.js.
  ============================================
*/

const accountApi = window.tasceerAccount;

// === حالة اللوجو ===
// selectedLogoFile: ملف جديد اختاره المستخدم (ما رفعناه بعد)
// existingLogoUrl: رابط اللوجو المحفوظ حالياً (لو فيه)
// shouldRemoveLogo: المستخدم ضغط إزالة على لوجو موجود
let selectedLogoFile = null;
let existingLogoUrl = null;
let shouldRemoveLogo = false;

// تعبئة الصفحة عند تحميلها أول مرة
async function loadAccountData() {
    const emailEl = document.getElementById('account-email');
    const nameInput = document.getElementById('store-name');
    const phoneInput = document.getElementById('store-phone');

    emailEl.textContent = 'جاري التحميل...';
    nameInput.disabled = true;
    phoneInput.disabled = true;

    try {
        // نجيب الإيميل والبيانات بالتوازي لتسريع التحميل
        const [email, profile] = await Promise.all([
            accountApi.getUserEmail(),
            accountApi.getProfile()
        ]);

        emailEl.textContent = email || '—';
        nameInput.value = profile.storeName || '';
        phoneInput.value = profile.storePhone || '';

        existingLogoUrl = profile.storeLogoUrl || null;
        showLogoState();
    } catch (err) {
        console.error('loadAccountData error:', err);
        emailEl.textContent = '—';
    } finally {
        nameInput.disabled = false;
        phoneInput.disabled = false;
    }
}

// يظهر معاينة اللوجو لو فيه رابط محفوظ، أو يظهر زر الاختيار لو ما فيه.
function showLogoState() {
    const preview = document.getElementById('account-logo-preview');
    const previewImg = document.getElementById('account-logo-preview-img');
    const uploadLabel = document.getElementById('account-logo-label');

    if (existingLogoUrl) {
        previewImg.src = existingLogoUrl;
        preview.hidden = false;
        uploadLabel.hidden = true;
    } else {
        preview.hidden = true;
        uploadLabel.hidden = false;
    }
}

// رسالة نجاح تختفي بعد 3 ثواني
function showFeedback(message) {
    const fb = document.getElementById('account-feedback');
    fb.textContent = message;
    fb.classList.add('account-feedback--visible');
    setTimeout(function () {
        fb.classList.remove('account-feedback--visible');
    }, 3000);
}

document.addEventListener('DOMContentLoaded', function () {
    loadAccountData();

    const form = document.getElementById('account-form');
    const submitBtn = document.getElementById('account-submit-btn');
    const logoInput = document.getElementById('account-logo');
    const logoRemoveBtn = document.getElementById('account-logo-remove');
    const phoneInput = document.getElementById('store-phone');

    // تنظيف رقم الجوال أثناء الكتابة: تحويل الأرقام الهندية
    // إلى غربية، إزالة أي شي غير رقم، وتحديد الطول بـ 10.
    if (phoneInput) {
        phoneInput.addEventListener('input', function () {
            let cleaned = this.value;
            const arabicIndic = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
            arabicIndic.forEach(function (d, i) {
                cleaned = cleaned.split(d).join(String(i));
            });
            this.value = cleaned.replace(/[^\d]/g, '').slice(0, 10);
        });
    }

    // === اختيار ملف لوجو ===
    logoInput.addEventListener('change', function () {
        var file = logoInput.files[0];
        if (!file) return;

        var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.indexOf(file.type) === -1) {
            alert('الملف المختار ليس صورة مدعومة. اختر صورة بصيغة JPEG أو PNG أو WebP.');
            logoInput.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('حجم الصورة كبير جداً (أكثر من 5 ميجا). اختر صورة أصغر.');
            logoInput.value = '';
            return;
        }

        selectedLogoFile = file;
        shouldRemoveLogo = false;

        var reader = new FileReader();
        reader.onload = function () {
            var previewImg = document.getElementById('account-logo-preview-img');
            previewImg.src = reader.result;
            document.getElementById('account-logo-preview').hidden = false;
            document.getElementById('account-logo-label').hidden = true;
        };
        reader.readAsDataURL(file);
    });

    // === إزالة اللوجو ===
    logoRemoveBtn.addEventListener('click', function () {
        selectedLogoFile = null;
        logoInput.value = '';
        document.getElementById('account-logo-preview').hidden = true;
        document.getElementById('account-logo-label').hidden = false;

        // لو فيه لوجو محفوظ، نعلّم إننا نبغى نحذفه عند الحفظ
        if (existingLogoUrl) {
            shouldRemoveLogo = true;
        }
    });

    // === حفظ التغييرات ===
    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        const storeName = document.getElementById('store-name').value.trim();
        const storePhone = document.getElementById('store-phone').value.trim();

        // التحقق من رقم الجوال — اختياري، لكن لو فيه قيمة لازم تطابق الصيغة
        if (storePhone !== '' && !/^05\d{8}$/.test(storePhone)) {
            alert('رقم جوال المتجر لازم يبدأ بـ 05 ويكون 10 أرقام.');
            return;
        }

        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحفظ...';

        try {
            // === معالجة اللوجو ===
            // logoUrlForSave: الرابط النهائي اللي نحفظه في قاعدة البيانات
            var logoUrlForSave = existingLogoUrl;

            if (selectedLogoFile) {
                // الحالة أ: لوجو جديد — نرفعه ونحذف القديم (لو فيه)
                logoUrlForSave = await accountApi.uploadStoreLogo(selectedLogoFile);
                if (existingLogoUrl) {
                    accountApi.deleteStoreLogo(existingLogoUrl);
                }
            } else if (shouldRemoveLogo) {
                // الحالة ب: المستخدم مسح اللوجو الحالي
                if (existingLogoUrl) {
                    accountApi.deleteStoreLogo(existingLogoUrl);
                }
                logoUrlForSave = null;
            }
            // الحالة ج: ما لمس اللوجو = نحتفظ بـ existingLogoUrl كما هو

            await accountApi.saveProfile(
                storeName || null,
                logoUrlForSave,
                storePhone || null
            );

            // إعادة ضبط الحالة بعد النجاح
            existingLogoUrl = logoUrlForSave;
            selectedLogoFile = null;
            shouldRemoveLogo = false;
            logoInput.value = '';
            showLogoState();

            showFeedback('تم الحفظ ✅');
        } catch (err) {
            alert(err.message || 'تعذر حفظ البيانات.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
});
