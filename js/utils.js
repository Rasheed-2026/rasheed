/*
  ============================================
  أدوات مساعدة عامة
  ============================================
  دوال مشت��كة تُحمّل قبل كل الملفات الأخرى.
  ============================================
*/

/**
 * تحويل الأرقام الهندية (٠١٢٣٤٥٦٧٨٩) إلى أرقام غربية (0123456789)
 * بعض المتصفحات على الجوال تحوّل الأرقام تلقائياً للهندية
 * لما تكون اللغة عربية، ��هذي الدالة تصلح العرض.
 */
function toWesternNumerals(str) {
    if (!str && str !== 0) return str;
    return String(str).replace(/[٠-٩]/g, function (match) {
        return '٠١٢٣٤٥٦٧٨٩'.indexOf(match);
    });
}

/**
 * تنظيف المدخلات الرقمية ��� يحول الأرقام الهندية للغربية
 * نستخدمها قبل parseFloat أو parseInt على قيم الحقول
 * عشان لو المستخدم كتب "٨٠" تتحول لـ "80"
 */
function normalizeNumericInput(value) {
    if (!value && value !== 0) return value;
    return String(value)
        .replace(/[٠-٩]/g, function (match) {
            return '٠١٢٣٤٥٦٧٨٩'.indexOf(match);
        })
        .replace(/٫/g, '.'); // فاصلة عشرية عربية → غربية
}

window.toWesternNumerals = toWesternNumerals;
window.normalizeNumericInput = normalizeNumericInput;
