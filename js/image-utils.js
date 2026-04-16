/*
  ============================================
  أدوات معالجة الصور
  ============================================
  هذا الملف يحتوي على دالة ضغط الصور قبل رفعها.
  الهدف: تقليل حجم الصورة عشان الرفع يكون أسرع
  والتخزين يكون أقل.
  ============================================
*/

(function () {

    /**
     * ضغط صورة وتصغير أبعادها
     * -------------------------------------------------------
     * ناخذ ملف الصورة الأصلي ونرجع Blob مضغوط بصيغة JPEG.
     *
     * @param {File} file - ملف الصورة اللي اختاره المستخدم
     * @param {number} maxDimension - أكبر بُعد مسموح (عرض أو ارتفاع). الافتراضي 800 بكسل
     * @param {number} quality - جودة JPEG من 0 إلى 1. الافتراضي 0.8
     * @returns {Promise<Blob>} - الصورة المضغوطة كـ Blob
     */
    async function compressImage(file, maxDimension, quality) {
        // القيم الافتراضية
        if (maxDimension === undefined) maxDimension = 800;
        if (quality === undefined) quality = 0.8;

        // الخطوة 1: نتأكد إن الملف فعلاً صورة
        if (!file || !file.type || !file.type.startsWith('image/')) {
            throw new Error('الملف المختار ليس صورة');
        }

        // الخطوة 2: نقرأ الملف كـ Data URL باستخدام FileReader
        var dataUrl = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(reader.result);
            };
            reader.onerror = function () {
                reject(new Error('فشل ضغط الصورة'));
            };
            reader.readAsDataURL(file);
        });

        // الخطوة 3: ننشئ عنصر Image ونحمّل فيه الـ Data URL
        var img = await new Promise(function (resolve, reject) {
            var image = new Image();
            image.onload = function () {
                resolve(image);
            };
            image.onerror = function () {
                reject(new Error('فشل ضغط الصورة'));
            };
            image.src = dataUrl;
        });

        // الخطوة 4: نحسب الأبعاد الجديدة مع الحفاظ على نسبة العرض للارتفاع
        var width = img.width;
        var height = img.height;

        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                // العرض أكبر — نصغّر بناءً عليه
                height = Math.round(height * (maxDimension / width));
                width = maxDimension;
            } else {
                // الارتفاع أكبر — نصغّر بناءً عليه
                width = Math.round(width * (maxDimension / height));
                height = maxDimension;
            }
        }

        // الخطوة 5: ننشئ Canvas بالأبعاد الجديدة ونرسم الصورة عليه
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // الخطوة 6: نحوّل Canvas إلى Blob بصيغة JPEG
        var blob = await new Promise(function (resolve, reject) {
            canvas.toBlob(function (result) {
                if (result) {
                    resolve(result);
                } else {
                    reject(new Error('فشل ضغط الصورة'));
                }
            }, 'image/jpeg', quality);
        });

        return blob;
    }

    // نجعل الدالة متاحة عبر window
    window.tasceerImageUtils = {
        compressImage: compressImage
    };

})();
