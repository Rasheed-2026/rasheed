/*
  ============================================
  ملف JavaScript الرئيسي
  ============================================
  هذا الملف يربط الواجهة (HTML) مع منطق
  المكونات (ingredients.js). مسؤول عن:
  - عرض قائمة المكونات
  - استقبال النموذج لإضافة مكون جديد
  - حذف مكون بعد تأكيد المستخدم
  ============================================
*/

console.log('البرنامج جاهز');

// نقرأ الدوال من الكائن العام اللي عرّفناه في ingredients.js
const { getAllIngredients, addIngredient, deleteIngredient } = window.tasceerIngredients;

// === دوال مساعدة للعرض ===

// تختار الوحدة الأنسب لعرض حجم العبوة بشكل مفهوم للمستخدم
function formatPackageSize(amount, unitType) {
    if (unitType === 'piece') {
        // للقطع: نعرض العدد مع كلمة "حبة" أو "قطعة"
        return amount + ' حبة';
    }

    if (unitType === 'weight') {
        // وزن: لو أكبر من كيلو نعرضه بالكيلو، وإلا بالجرام
        if (amount >= 1000) {
            return formatNumber(amount / 1000) + ' كيلوجرام';
        }
        return formatNumber(amount) + ' جرام';
    }

    if (unitType === 'volume') {
        // حجم: لو أكبر من لتر نعرضه باللتر، وإلا بالمليلتر
        if (amount >= 1000) {
            return formatNumber(amount / 1000) + ' لتر';
        }
        return formatNumber(amount) + ' مليلتر';
    }

    return amount;
}

// تنسيق الرقم: نشيل الأصفار الزائدة بعد الفاصلة (مع حد أقصى منزلتين)
function formatNumber(num) {
    return Number(num.toFixed(2)).toString();
}

// تنسيق السعر مع كلمة "ريال"
function formatPrice(price) {
    return formatNumber(price) + ' ريال';
}

// === عرض قائمة المكونات ===

function renderIngredients() {
    const listContainer = document.getElementById('ingredients-list');
    const ingredients = getAllIngredients();

    // نفرّغ المحتوى السابق قبل ما نعيد البناء
    listContainer.innerHTML = '';

    // لو ما فيه مكونات، نعرض رسالة فاضية
    if (ingredients.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'لم تضف أي مكونات بعد.';
        listContainer.appendChild(empty);
        return;
    }

    // نبني بطاقة لكل مكون
    ingredients.forEach(function (item) {
        const card = document.createElement('div');
        card.className = 'ingredient-card';

        const info = document.createElement('div');
        info.className = 'ingredient-info';

        const name = document.createElement('div');
        name.className = 'ingredient-name';
        name.textContent = item.name;

        const meta = document.createElement('div');
        meta.className = 'ingredient-meta';
        const sizeText = formatPackageSize(item.packageWeightInGrams, item.unitType);
        const priceText = formatPrice(item.packagePrice);
        meta.textContent = 'العبوة: ' + sizeText + ' — ' + priceText;

        info.appendChild(name);
        info.appendChild(meta);

        // زر الحذف — نخزن رقم المكون في data-id عشان نعرفه عند الضغط
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'حذف';
        deleteBtn.dataset.id = item.id;
        deleteBtn.setAttribute('aria-label', 'حذف ' + item.name);

        card.appendChild(info);
        card.appendChild(deleteBtn);

        listContainer.appendChild(card);
    });
}

// === ربط الأحداث بعد ما تجهز الصفحة ===

document.addEventListener('DOMContentLoaded', function () {
    // عرض القائمة أول ما تفتح الصفحة
    renderIngredients();

    const form = document.getElementById('add-ingredient-form');
    const listContainer = document.getElementById('ingredients-list');

    // === إضافة مكون جديد ===
    form.addEventListener('submit', function (event) {
        event.preventDefault();

        // نقرأ القيم من الحقول
        const name = document.getElementById('ingredient-name').value.trim();
        const amount = Number(document.getElementById('package-amount').value);
        const unit = document.getElementById('package-unit').value;
        const price = Number(document.getElementById('package-price').value);

        // تحقق بسيط من صحة المدخلات
        if (name === '') {
            alert('من فضلك اكتب اسم المكون.');
            return;
        }
        if (!(amount > 0)) {
            alert('من فضلك أدخل حجم عبوة أكبر من صفر.');
            return;
        }
        if (!(price > 0)) {
            alert('من فضلك أدخل سعر أكبر من صفر.');
            return;
        }

        // نضيف المكون ونعيد بناء القائمة
        addIngredient(name, amount, unit, price);
        form.reset();
        renderIngredients();
    });

    // === حذف مكون عبر event delegation ===
    // نستخدم مستمع واحد على الحاوية بدل ما نضيف لكل زر
    listContainer.addEventListener('click', function (event) {
        const target = event.target;
        if (target.matches('.btn-danger')) {
            const id = target.dataset.id;
            const confirmed = confirm('هل أنت متأكد من حذف هذا المكون؟');
            if (confirmed) {
                deleteIngredient(id);
                renderIngredients();
            }
        }
    });
});
