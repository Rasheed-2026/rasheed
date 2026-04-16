/*
  ============================================
  ملف JavaScript الرئيسي — صفحة المكونات
  ============================================
  يربط الواجهة مع طبقة البيانات في ingredients.js.
  بعد الهجرة إلى Supabase كل استدعاء بيانات صار async،
  فكل الدوال اللي تستدعي البيانات صارت async أيضاً.
  ============================================
*/

console.log('البرنامج جاهز');

const ingredientsApi = window.tasceerIngredients;

// null = وضع الإضافة، غير ذلك = رقم المكون قيد التعديل
let editingIngredientId = null;

function formatPrice(price) {
    return toWesternNumerals(Number(price.toFixed(2)).toString()) + ' ريال';
}

// === عرض قائمة المكونات (async لأنها تجيب من Supabase) ===
async function renderIngredients() {
    const listContainer = document.getElementById('ingredients-list');

    // مؤشر تحميل بسيط أثناء انتظار Supabase
    listContainer.innerHTML = '';
    const loading = document.createElement('p');
    loading.className = 'loading-message';
    loading.textContent = 'جاري التحميل...';
    listContainer.appendChild(loading);

    const ingredients = await ingredientsApi.getAllIngredients();

    listContainer.innerHTML = '';

    if (ingredients.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state empty-state--full';
        empty.textContent = 'لم تضف أي مكونات بعد.';
        listContainer.appendChild(empty);
        return;
    }

    ingredients.forEach(function (item) {
        const card = document.createElement('div');
        card.className = 'ingredient-card';

        const name = document.createElement('h3');
        name.className = 'ingredient-card__name';
        name.textContent = item.name;

        const info = document.createElement('p');
        info.className = 'ingredient-card__info';
        const sizeText = ingredientsApi.formatPackageSize(item.packageWeightInGrams, item.unitType);
        const priceText = formatPrice(item.packagePrice);
        info.textContent = 'العبوة: ' + sizeText + ' — ' + priceText;

        const actions = document.createElement('div');
        actions.className = 'ingredient-card__actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-secondary btn--small';
        editBtn.textContent = 'تعديل';
        editBtn.dataset.id = item.id;
        editBtn.dataset.action = 'edit';
        editBtn.setAttribute('aria-label', 'تعديل ' + item.name);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger btn--small';
        deleteBtn.textContent = 'حذف';
        deleteBtn.dataset.id = item.id;
        deleteBtn.dataset.action = 'delete';
        deleteBtn.setAttribute('aria-label', 'حذف ' + item.name);

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(name);
        card.appendChild(info);
        card.appendChild(actions);

        listContainer.appendChild(card);
    });
}

// === وضع التعديل ===

async function enterEditMode(id) {
    const ingredient = await ingredientsApi.getIngredientById(id);
    if (!ingredient) {
        return;
    }

    editingIngredientId = id;

    const display = ingredientsApi.getDisplayUnit(ingredient);

    document.getElementById('ingredient-name').value = ingredient.name;
    document.getElementById('package-amount').value = display.amount;
    document.getElementById('package-unit').value = display.unit;
    document.getElementById('package-price').value = ingredient.packagePrice;

    document.getElementById('add-form-title').textContent = 'تعديل المكون';
    document.getElementById('submit-btn').textContent = 'حفظ التعديلات';
    document.getElementById('cancel-edit-btn').hidden = false;

    const form = document.getElementById('add-ingredient-form');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
    editingIngredientId = null;
    document.getElementById('add-ingredient-form').reset();
    document.getElementById('add-form-title').textContent = 'إضافة مكون جديد';
    document.getElementById('submit-btn').textContent = 'أضف المكون';
    document.getElementById('cancel-edit-btn').hidden = true;
}

// === ربط الأحداث ===
document.addEventListener('DOMContentLoaded', function () {
    renderIngredients();

    const form = document.getElementById('add-ingredient-form');
    const listContainer = document.getElementById('ingredients-list');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    // إضافة أو تعديل مكون
    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        const name = document.getElementById('ingredient-name').value.trim();
        const amount = Number(normalizeNumericInput(document.getElementById('package-amount').value));
        const unit = document.getElementById('package-unit').value;
        const price = Number(normalizeNumericInput(document.getElementById('package-price').value));

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

        // نعطّل الزر أثناء الحفظ ليتضح للمستخدم إن فيه عملية جارية
        const submitBtn = document.getElementById('submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحفظ...';

        try {
            if (editingIngredientId === null) {
                await ingredientsApi.addIngredient(name, amount, unit, price);
                form.reset();
            } else {
                await ingredientsApi.updateIngredient(editingIngredientId, name, amount, unit, price);
                exitEditMode();
            }
            await renderIngredients();
        } catch (err) {
            alert(err.message || 'حدث خطأ غير متوقع.');
        } finally {
            submitBtn.disabled = false;
            // نرجّع النص الأصلي لو ما تغيّر عبر exitEditMode
            if (submitBtn.textContent === 'جاري الحفظ...') {
                submitBtn.textContent = originalText;
            }
        }
    });

    cancelBtn.addEventListener('click', function () {
        exitEditMode();
    });

    // أحداث التعديل والحذف عبر event delegation
    listContainer.addEventListener('click', async function (event) {
        const target = event.target;
        if (!target.matches('button[data-action]')) {
            return;
        }

        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === 'edit') {
            await enterEditMode(id);
            return;
        }

        if (action === 'delete') {
            const confirmed = confirm('هل أنت متأكد من حذف هذا المكون؟');
            if (!confirmed) return;

            try {
                if (editingIngredientId === id) {
                    exitEditMode();
                }
                await ingredientsApi.deleteIngredient(id);
                await renderIngredients();
            } catch (err) {
                alert(err.message || 'تعذر حذف المكون.');
            }
        }
    });
});
