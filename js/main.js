/*
  ============================================
  ملف JavaScript الرئيسي
  ============================================
  هذا الملف يربط الواجهة (HTML) مع منطق
  المكونات. كل عمليات البيانات (جلب، إضافة،
  تعديل، حذف، تنسيق العرض) موجودة في
  ingredients.js، وهذا الملف فقط يقرأها من
  window.tasceerIngredients ويتولى DOM والأحداث.
  ============================================
*/

console.log('البرنامج جاهز');

// مرجع مختصر للدوال المعرّفة في ingredients.js
const ingredientsApi = window.tasceerIngredients;

// متغير حالة وحيد: لو null = وضع الإضافة، لو فيه id = وضع التعديل
let editingIngredientId = null;

// تنسيق السعر مع كلمة "ريال"
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
        card.className = 'item-card';

        const info = document.createElement('div');
        info.className = 'item-info';

        const name = document.createElement('div');
        name.className = 'item-name';
        name.textContent = item.name;

        const meta = document.createElement('div');
        meta.className = 'item-meta';
        const sizeText = ingredientsApi.formatPackageSize(item.packageWeightInGrams, item.unitType);
        const priceText = formatPrice(item.packagePrice);
        meta.textContent = 'العبوة: ' + sizeText + ' — ' + priceText;

        info.appendChild(name);
        info.appendChild(meta);

        // مجموعة أزرار البطاقة (تعديل + حذف)
        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-secondary';
        editBtn.textContent = 'تعديل';
        editBtn.dataset.id = item.id;
        editBtn.dataset.action = 'edit';
        editBtn.setAttribute('aria-label', 'تعديل ' + item.name);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'حذف';
        deleteBtn.dataset.id = item.id;
        deleteBtn.dataset.action = 'delete';
        deleteBtn.setAttribute('aria-label', 'حذف ' + item.name);

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(info);
        card.appendChild(actions);

        listContainer.appendChild(card);
    });
}

// === تبديل النموذج بين وضع الإضافة ووضع التعديل ===

// يحوّل النموذج إلى وضع التعديل ويعبّيه بقيم المكون
function enterEditMode(id) {
    const ingredient = ingredientsApi.getIngredientById(id);
    if (!ingredient) {
        return;
    }

    editingIngredientId = id;

    // نستعيد الوحدة بنفس منطق العرض في البطاقة
    const display = ingredientsApi.getDisplayUnit(ingredient);

    document.getElementById('ingredient-name').value = ingredient.name;
    document.getElementById('package-amount').value = display.amount;
    document.getElementById('package-unit').value = display.unit;
    document.getElementById('package-price').value = ingredient.packagePrice;

    document.getElementById('add-form-title').textContent = 'تعديل المكون';
    document.getElementById('submit-btn').textContent = 'حفظ التعديلات';
    document.getElementById('cancel-edit-btn').hidden = false;

    // نمرّر المستخدم لأعلى النموذج عشان يشوفه على الجوال
    const form = document.getElementById('add-ingredient-form');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// يرجّع النموذج لوضع الإضافة ويفرّغه
function exitEditMode() {
    editingIngredientId = null;
    document.getElementById('add-ingredient-form').reset();
    document.getElementById('add-form-title').textContent = 'إضافة مكون جديد';
    document.getElementById('submit-btn').textContent = 'أضف المكون';
    document.getElementById('cancel-edit-btn').hidden = true;
}

// === ربط الأحداث بعد ما تجهز الصفحة ===
document.addEventListener('DOMContentLoaded', function () {
    renderIngredients();

    const form = document.getElementById('add-ingredient-form');
    const listContainer = document.getElementById('ingredients-list');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    // === إضافة أو تعديل مكون ===
    form.addEventListener('submit', function (event) {
        // نوقف السلوك الافتراضي للمتصفح فوراً
        event.preventDefault();

        const name = document.getElementById('ingredient-name').value.trim();
        const amount = Number(document.getElementById('package-amount').value);
        const unit = document.getElementById('package-unit').value;
        const price = Number(document.getElementById('package-price').value);

        // تحقق بسيط من صحة المدخلات (نفس منطق الإضافة)
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

        // نقرر: هل نضيف أو نعدّل بناءً على المتغير editingIngredientId
        if (editingIngredientId === null) {
            ingredientsApi.addIngredient(name, amount, unit, price);
            form.reset();
        } else {
            ingredientsApi.updateIngredient(editingIngredientId, name, amount, unit, price);
            exitEditMode();
        }

        renderIngredients();
    });

    // زر إلغاء التعديل
    cancelBtn.addEventListener('click', function () {
        exitEditMode();
    });

    // === أحداث التعديل والحذف عبر event delegation ===
    listContainer.addEventListener('click', function (event) {
        const target = event.target;
        if (!target.matches('button[data-action]')) {
            return;
        }

        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === 'edit') {
            enterEditMode(id);
            return;
        }

        if (action === 'delete') {
            const confirmed = confirm('هل أنت متأكد من حذف هذا المكون؟');
            if (confirmed) {
                // لو كنا نعدّل نفس المكون اللي ينحذف، نخرج من وضع التعديل
                if (editingIngredientId === id) {
                    exitEditMode();
                }
                ingredientsApi.deleteIngredient(id);
                renderIngredients();
            }
        }
    });
});
