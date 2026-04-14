/*
  ============================================
  ملف إدارة الإعدادات
  ============================================
  يحفظ ويجلب إعدادات التسعير العامة للمستخدم
  (قيمة ساعة العمل، تعرفة الكهرباء، سعر
  أسطوانة الغاز) من ذاكرة المتصفح. ما يلمس
  DOM. التحقق من المدخلات يتم هنا ويرمي
  أخطاء واضحة بالعربي إذا القيم غير صحيحة.
  ============================================
*/

(function () {
    // مفتاح مستقل عن المكونات والوصفات
    const STORAGE_KEY = 'tasceer_settings';

    // القيم الافتراضية: نستخدمها لو ما فيه شي محفوظ،
    // أو عند استعادة الإعدادات الأصلية.
    const DEFAULTS = {
        hourlyRate: 25,      // ريال لكل ساعة عمل
        electricityRate: 18, // هللة لكل كيلوواط ساعة
        gasCylinderPrice: 25 // ريال لأسطوانة الغاز المنزلي
    };

    // ترجع كائن الإعدادات الحالي. لو ما فيه شي محفوظ،
    // ترجع نسخة من القيم الافتراضية. ما ترجع null أبداً.
    function getSettings() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {
                hourlyRate: DEFAULTS.hourlyRate,
                electricityRate: DEFAULTS.electricityRate,
                gasCylinderPrice: DEFAULTS.gasCylinderPrice
            };
        }
        try {
            const parsed = JSON.parse(raw);
            // نضمن أن كل الحقول موجودة حتى لو الملف قديم
            return {
                hourlyRate: Number(parsed.hourlyRate) || DEFAULTS.hourlyRate,
                electricityRate: Number(parsed.electricityRate) || DEFAULTS.electricityRate,
                gasCylinderPrice: Number(parsed.gasCylinderPrice) || DEFAULTS.gasCylinderPrice
            };
        } catch (e) {
            // لو البيانات تالفة، نرجع الافتراضيات بدل ما نكسر البرنامج
            return {
                hourlyRate: DEFAULTS.hourlyRate,
                electricityRate: DEFAULTS.electricityRate,
                gasCylinderPrice: DEFAULTS.gasCylinderPrice
            };
        }
    }

    // تحفظ القيم الثلاث بعد ما تتحقق أنها أرقام موجبة.
    // لو أي قيمة غير صحيحة، ترمي خطأ برسالة واضحة بالعربي.
    function saveSettings(hourlyRate, electricityRate, gasCylinderPrice) {
        const h = Number(hourlyRate);
        const e = Number(electricityRate);
        const g = Number(gasCylinderPrice);

        if (!(h > 0)) {
            throw new Error('قيمة ساعة العمل لازم تكون رقم أكبر من صفر.');
        }
        if (!(e > 0)) {
            throw new Error('تعرفة الكهرباء لازم تكون رقم أكبر من صفر.');
        }
        if (!(g > 0)) {
            throw new Error('سعر أسطوانة الغاز لازم يكون رقم أكبر من صفر.');
        }

        const settings = {
            hourlyRate: h,
            electricityRate: e,
            gasCylinderPrice: g,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        return settings;
    }

    // تمسح الإعدادات المحفوظة، فتعود getSettings
    // لإرجاع القيم الافتراضية في المرة القادمة.
    function resetSettings() {
        localStorage.removeItem(STORAGE_KEY);
    }

    // نعرض الدوال على كائن عام في window
    window.tasceerSettings = {
        getSettings: getSettings,
        saveSettings: saveSettings,
        resetSettings: resetSettings
    };
})();
