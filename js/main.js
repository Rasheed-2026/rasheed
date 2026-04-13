/*
  ============================================
  ملف JavaScript الرئيسي
  ============================================
  هذا الملف يربط الواجهة (HTML) مع منطق
  المكونات. كل عمليات البيانات (جلب، إضافة،
  حذف، تنسيق العرض) موجودة في ingredients.js،
  وهذا الملف فقط يقرأها من window.tasceerIngredients
  ويتولى DOM والأحداث.
  ============================================
*/

console.log('البرنامج جاهز');

// مرجع مختصر للدوال المعرّفة في ingredients.js
// نستخدم اسم مختلف (ingredientsApi) عشان ما يصير تعارض
// مع أي شي في النطاق العام.
const ingredientsApi = window.tasceerIngredients;

// تنسيق السعر مع كلمة "ريال" (تنسيق بسيط خاص بالعرض)
function formatPrice(price) {
    return Number(price.toFixed(2)).toString() + ' ريال';
}

// === عرض قائمة المكونات ===
function renderIngredients() {
    const listContainer = document.getElementById('ingredients-list');
    const ingredients = ingredientsApi.getAllIngredients();

    listContainer.innerHTML = '';

    if (ingredients.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'لم تضف أي مكونات بعد.';
        listContainer.appendChild(empty);
        return;
    }

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
        const sizeText = ingredientsApi.formatPackageSize(item.packageWeightInGrams, item.unitType);
        const priceText = formatPrice(item.packagePrice);
        meta.textContent = 'العبوة: ' + sizeText + ' — ' + priceText;

        info.appendChild(name);
        info.appendChild(meta);

        // زر الحذف — نخزن رقم المكون في data-id
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
    renderIngredients();

    const form = document.getElementById('add-ingredient-form');
    const listContainer = document.getElementById('ingredients-list');

    // === إضافة مكون جديد ===
    form.addEventListener('submit', function (event) {
        // نوقف السلوك الافتراضي للمتصفح فوراً قبل أي شي ثاني
        event.preventDefault();

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

        ingredientsApi.addIngredient(name, amount, unit, price);
        form.reset();
        renderIngredients();
    });

    // === حذف مكون عبر event delegation ===
    listContainer.addEventListener('click', function (event) {
        const target = event.target;
        if (target.matches('.btn-danger')) {
            const id = target.dataset.id;
            const confirmed = confirm('هل أنت متأكد من حذف هذا المكون؟');
            if (confirmed) {
                ingredientsApi.deleteIngredient(id);
                renderIngredients();
            }
        }
    });
});
