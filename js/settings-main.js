/*
  ============================================
  ملف الواجهة لصفحة الإعدادات
  ============================================
  يربط نموذج الإعدادات بـ window.tasceerSettings.
  كل ما يخص DOM والأحداث هنا، وكل ما يخص
  البيانات والتحقق الأساسي في settings.js.
  ============================================
*/

// مرجع مختصر لدوال الإعدادات
const settingsApi = window.tasceerSettings;

// مرجع الحقول والأزرار لنستخدمها في أكثر من مكان
let hourlyInput;
let electricityInput;
let gasInput;
let statusBox;
let statusTimer = null;

// تملأ حقول النموذج بالقيم المحفوظة حالياً
// (أو القيم الافتراضية لو أول مرة يفتح الصفحة).
function fillFormFromSettings() {
    const current = settingsApi.getSettings();
    hourlyInput.value = current.hourlyRate;
    electricityInput.value = current.electricityRate;
    gasInput.value = current.gasCylinderPrice;
}

// تعرض رسالة في منطقة الحالة (نجاح أو خطأ)
// وتخفيها تلقائياً بعد ٤ ثواني.
function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.classList.remove('status-message--success', 'status-message--error');
    statusBox.classList.add('status-message--' + type);
    statusBox.hidden = false;

    // نلغي أي مؤقت سابق عشان ما تتداخل الرسائل
    if (statusTimer !== null) {
        clearTimeout(statusTimer);
    }
    statusTimer = setTimeout(function () {
        statusBox.hidden = true;
        statusBox.textContent = '';
        statusTimer = null;
    }, 4000);
}

// === ربط الأحداث بعد جاهزية الصفحة ===
document.addEventListener('DOMContentLoaded', function () {
    hourlyInput = document.getElementById('hourly-rate');
    electricityInput = document.getElementById('electricity-rate');
    gasInput = document.getElementById('gas-price');
    statusBox = document.getElementById('settings-status');

    const form = document.getElementById('settings-form');
    const resetBtn = document.getElementById('reset-settings-btn');

    // نعبّي الحقول بالقيم الحالية عند فتح الصفحة
    fillFormFromSettings();

    // === حفظ الإعدادات ===
    form.addEventListener('submit', function (event) {
        // نوقف السلوك الافتراضي للمتصفح فوراً
        event.preventDefault();

        const hourly = parseFloat(hourlyInput.value);
        const electricity = parseFloat(electricityInput.value);
        const gas = parseFloat(gasInput.value);

        // تحقق سريع هنا قبل ما نطلب من طبقة البيانات
        if (!(hourly > 0) || !(electricity > 0) || !(gas > 0)) {
            showStatus('كل القيم لازم تكون أرقام أكبر من صفر.', 'error');
            return;
        }

        // طبقة البيانات ترمي خطأ لو فيه شي غلط، نمسكه ونعرضه
        try {
            settingsApi.saveSettings(hourly, electricity, gas);
            showStatus('تم حفظ الإعدادات بنجاح', 'success');
        } catch (err) {
            showStatus(err.message, 'error');
        }
    });

    // === استعادة القيم الافتراضية ===
    resetBtn.addEventListener('click', function () {
        const confirmed = confirm('هل أنت متأكد من استعادة القيم الافتراضية؟');
        if (!confirmed) {
            return;
        }
        settingsApi.resetSettings();
        // نعيد قراءة الإعدادات (ستكون الافتراضيات) ونحدّث الحقول
        fillFormFromSettings();
        showStatus('تم استعادة القيم الافتراضية', 'success');
    });
});
