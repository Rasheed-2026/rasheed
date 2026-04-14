/*
  ============================================
  ملف الواجهة لصفحة الوصفات
  ============================================
  يربط نموذج الوصفات والقائمة بـ window.tasceerRecipes.
  كل ما يخص DOM والأحداث والتحقق من المدخلات
  يعيش هنا، وكل ما يخص البيانات في recipes.js.
  ============================================
*/

// مرجع مختصر لدوال بيانات الوصفات
const recipesApi = window.tasceerRecipes;
// مرجع مختصر لدوال بيانات المكونات (نقرأ منها فقط هنا)
const ingredientsApi = window.tasceerIngredients;

// متغير حالة: null = وضع الإضافة، غير ذلك = رقم الوصفة قيد التعديل
let editingRecipeId = null;

// تنسيق رقم: نشيل الأصفار الزائدة بعد الفاصلة (حد أقصى منزلتين)
function formatNumber(num) {
    return Number(num.toFixed(2)).toString();
}

// تختار الوحدة الأنسب لعرض كمية مكون داخل وصفة.
// المدخل: كائن المكون + الكمية المخزّنة بالوحدة الأساسية.
// نفس منطق formatPackageSize في ingredients.js لكن بشكل موحّد.
function formatQuantityForDisplay(ingredient, quantityInBaseUnit) {
    const type = ingredient.unitType;
    const q = Number(quantityInBaseUnit);

    if (type === 'piece') {
        return formatNumber(q) + ' حبة';
    }
    if (type === 'weight') {
        if (q >= 1000) {
            return formatNumber(q / 1000) + ' كيلوجرام';
        }
        return formatNumber(q) + ' جرام';
    }
    if (type === 'volume') {
        if (q >= 1000) {
            return formatNumber(q / 1000) + ' لتر';
        }
        return formatNumber(q) + ' مليلتر';
    }
    return formatNumber(q);
}

// تحويل قيمة مصدر الطاقة إلى نص عربي للعرض
function formatEnergySource(value) {
    if (value === 'electric') {
        return 'كهرباء';
    }
    if (value === 'gas') {
        return 'غاز';
    }
    if (value === 'both') {
        return 'كهرباء وغاز';
    }
    // "none" أو أي قيمة غير معروفة
    return 'بدون';
}

// === عرض قائمة الوصفات ===
function renderRecipes() {
    const listContainer = document.getElementById('recipes-list');
    const recipes = recipesApi.getAllRecipes();

    listContainer.innerHTML = '';

    if (recipes.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'لم تضف أي وصفات بعد.';
        listContainer.appendChild(empty);
        return;
    }

    // نجلب قائمة المكونات المتاحة مرة وحدة لكل عملية render
    const allIngredients = ingredientsApi.getAllIngredients();

    recipes.forEach(function (recipe) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.recipeId = recipe.id;

        const info = document.createElement('div');
        info.className = 'item-info';

        // اسم الوصفة كعنوان
        const name = document.createElement('h3');
        name.className = 'item-name';
        name.textContent = recipe.name;

        // سطر المعلومات: الحصص + وقت التحضير + وقت الطبخ
        const meta = document.createElement('div');
        meta.className = 'item-meta';
        meta.textContent =
            'عدد الحصص: ' + recipe.servings +
            ' — وقت التحضير: ' + recipe.prepTimeMinutes + ' دقيقة' +
            ' — وقت الطبخ: ' + recipe.cookTimeMinutes + ' دقيقة';

        // سطر مصدر الطاقة
        const energy = document.createElement('div');
        energy.className = 'item-meta';
        energy.textContent = 'مصدر الطاقة: ' + formatEnergySource(recipe.energySource);

        info.appendChild(name);
        info.appendChild(meta);
        info.appendChild(energy);

        // مجموعة أزرار البطاقة (تعديل + حذف)
        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-secondary';
        editBtn.textContent = 'تعديل';
        editBtn.dataset.id = recipe.id;
        editBtn.dataset.action = 'edit';
        editBtn.setAttribute('aria-label', 'تعديل ' + recipe.name);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'حذف';
        deleteBtn.dataset.id = recipe.id;
        deleteBtn.dataset.action = 'delete';
        deleteBtn.setAttribute('aria-label', 'حذف ' + recipe.name);

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(info);
        card.appendChild(actions);

        // === القسم الفرعي: مكونات الوصفة ===
        const ingSection = buildIngredientsSection(recipe, allIngredients);
        card.appendChild(ingSection);

        listContainer.appendChild(card);
    });
}


// يبني قسم مكونات الوصفة داخل البطاقة:
// عنوان + قائمة المكونات الحالية + نموذج مصغّر للإضافة
function buildIngredientsSection(recipe, allIngredients) {
    const section = document.createElement('div');
    section.className = 'recipe-ingredients';

    const heading = document.createElement('h4');
    heading.className = 'recipe-ingredients__title';
    heading.textContent = 'المكونات';
    section.appendChild(heading);

    // قائمة المكونات المضافة لهذه الوصفة
    const list = document.createElement('div');
    list.className = 'recipe-ingredients__list';

    const entries = recipe.ingredients || [];

    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'recipe-ingredients__empty';
        empty.textContent = 'لم تضف مكونات لهذه الوصفة بعد.';
        list.appendChild(empty);
    } else {
        entries.forEach(function (entry) {
            const row = document.createElement('div');
            row.className = 'recipe-ingredients__row';

            const label = document.createElement('span');
            label.className = 'recipe-ingredients__label';

            // نبحث عن المكون الأصلي. لو انحذف، نعرض ملاحظة بالأحمر
            const ingredient = ingredientsApi.getIngredientById(entry.ingredientId);
            if (!ingredient) {
                const missing = document.createElement('span');
                missing.className = 'recipe-ingredients__missing';
                missing.textContent = '(مكون محذوف)';
                label.appendChild(missing);
            } else {
                const name = document.createElement('strong');
                name.textContent = ingredient.name;
                label.appendChild(name);

                const qty = document.createElement('span');
                qty.className = 'recipe-ingredients__qty';
                qty.textContent = ' — ' + formatQuantityForDisplay(ingredient, entry.quantity);
                label.appendChild(qty);
            }

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-small';
            removeBtn.textContent = 'إزالة';
            removeBtn.dataset.action = 'remove-ingredient';
            removeBtn.dataset.ingredientId = entry.ingredientId;

            row.appendChild(label);
            row.appendChild(removeBtn);
            list.appendChild(row);
        });
    }

    section.appendChild(list);

    // نموذج مصغّر للإضافة. لو ما فيه مكونات محفوظة أصلاً،
    // نعرض رسالة توجيهية بدل النموذج.
    if (allIngredients.length === 0) {
        const noIng = document.createElement('p');
        noIng.className = 'recipe-ingredients__empty';
        noIng.textContent = 'لا توجد مكونات محفوظة. أضف مكونات أولاً من شاشة المكونات.';
        section.appendChild(noIng);
        return section;
    }

    const miniForm = document.createElement('div');
    miniForm.className = 'recipe-ingredients__form';

    // قائمة اختيار المكون
    const selectIng = document.createElement('select');
    selectIng.className = 'recipe-ingredients__select';
    selectIng.dataset.field = 'ingredient';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'اختر مكوناً';
    placeholder.disabled = true;
    placeholder.selected = true;
    selectIng.appendChild(placeholder);
    allIngredients.forEach(function (ing) {
        const opt = document.createElement('option');
        opt.value = ing.id;
        opt.textContent = ing.name;
        selectIng.appendChild(opt);
    });

    // حقل الكمية
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.className = 'recipe-ingredients__amount';
    amountInput.placeholder = 'الكمية';
    amountInput.min = '0';
    amountInput.step = 'any';
    amountInput.dataset.field = 'amount';

    // قائمة الوحدة
    const unitSelect = document.createElement('select');
    unitSelect.className = 'recipe-ingredients__unit';
    unitSelect.dataset.field = 'unit';
    const units = [
        { value: 'g', label: 'جرام' },
        { value: 'kg', label: 'كيلوجرام' },
        { value: 'ml', label: 'مليلتر' },
        { value: 'l', label: 'لتر' },
        { value: 'piece', label: 'حبة / قطعة' }
    ];
    units.forEach(function (u) {
        const opt = document.createElement('option');
        opt.value = u.value;
        opt.textContent = u.label;
        unitSelect.appendChild(opt);
    });

    // زر الإضافة
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-secondary';
    addBtn.textContent = 'إضافة';
    addBtn.dataset.action = 'add-ingredient';

    miniForm.appendChild(selectIng);
    miniForm.appendChild(amountInput);
    miniForm.appendChild(unitSelect);
    miniForm.appendChild(addBtn);

    section.appendChild(miniForm);
    return section;
}

// === تبديل النموذج بين الإضافة والتعديل ===

// يحوّل النموذج إلى وضع التعديل ويعبّيه بقيم الوصفة
function enterEditMode(id) {
    const recipe = recipesApi.getRecipeById(id);
    if (!recipe) {
        return;
    }

    editingRecipeId = id;

    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-servings').value = recipe.servings;
    document.getElementById('recipe-prep-time').value = recipe.prepTimeMinutes;
    document.getElementById('recipe-cook-time').value = recipe.cookTimeMinutes;
    document.getElementById('recipe-energy').value = recipe.energySource;

    document.getElementById('recipe-form-title').textContent = 'تعديل الوصفة';
    document.getElementById('recipe-submit-btn').textContent = 'حفظ التعديلات';
    document.getElementById('recipe-cancel-btn').hidden = false;

    // نمرّر المستخدم لأعلى النموذج عشان يشوفه على الجوال
    const form = document.getElementById('add-recipe-form');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// يرجّع النموذج لوضع الإضافة ويفرّغه
function exitEditMode() {
    editingRecipeId = null;
    document.getElementById('add-recipe-form').reset();
    document.getElementById('recipe-form-title').textContent = 'إضافة وصفة جديدة';
    document.getElementById('recipe-submit-btn').textContent = 'أضف الوصفة';
    document.getElementById('recipe-cancel-btn').hidden = true;
}

// === ربط الأحداث بعد ما تجهز الصفحة ===
document.addEventListener('DOMContentLoaded', function () {
    renderRecipes();

    const form = document.getElementById('add-recipe-form');
    const listContainer = document.getElementById('recipes-list');
    const cancelBtn = document.getElementById('recipe-cancel-btn');

    // === إضافة أو تعديل وصفة ===
    form.addEventListener('submit', function (event) {
        // نوقف السلوك الافتراضي للمتصفح فوراً
        event.preventDefault();

        const name = document.getElementById('recipe-name').value.trim();
        const servings = Number(document.getElementById('recipe-servings').value);
        const prepTime = Number(document.getElementById('recipe-prep-time').value);
        const cookTime = Number(document.getElementById('recipe-cook-time').value);
        const energySource = document.getElementById('recipe-energy').value;

        // تحقق بسيط من صحة المدخلات
        if (name === '') {
            alert('من فضلك اكتب اسم الوصفة.');
            return;
        }
        if (!(servings >= 1)) {
            alert('عدد الحصص لازم يكون 1 أو أكثر.');
            return;
        }
        if (!(prepTime >= 0)) {
            alert('وقت التحضير لازم يكون صفر أو أكثر.');
            return;
        }
        if (!(cookTime >= 0)) {
            alert('وقت الطبخ لازم يكون صفر أو أكثر.');
            return;
        }

        // نقرر: هل نضيف أو نعدّل بناءً على المتغير editingRecipeId
        if (editingRecipeId === null) {
            recipesApi.addRecipe(name, servings, prepTime, cookTime, energySource);
            form.reset();
        } else {
            recipesApi.updateRecipe(editingRecipeId, name, servings, prepTime, cookTime, energySource);
            exitEditMode();
        }

        renderRecipes();
    });

    // زر إلغاء التعديل
    cancelBtn.addEventListener('click', function () {
        exitEditMode();
    });

    // === أحداث البطاقات عبر event delegation ===
    listContainer.addEventListener('click', function (event) {
        const target = event.target;
        if (!target.matches('button[data-action]')) {
            return;
        }

        const action = target.dataset.action;

        // نحصل على بطاقة الوصفة الأم لأي زر داخلها
        const card = target.closest('.item-card');
        const recipeId = card ? card.dataset.recipeId : null;

        // === تعديل الوصفة (من الأزرار الرئيسية) ===
        if (action === 'edit') {
            enterEditMode(target.dataset.id);
            return;
        }

        // === حذف الوصفة بالكامل ===
        if (action === 'delete') {
            const id = target.dataset.id;
            const confirmed = confirm('هل أنت متأكد من حذف هذه الوصفة؟');
            if (confirmed) {
                // لو كنا نعدّل نفس الوصفة اللي تنحذف، نخرج من وضع التعديل
                if (editingRecipeId === id) {
                    exitEditMode();
                }
                recipesApi.deleteRecipe(id);
                renderRecipes();
            }
            return;
        }

        // === إضافة مكون إلى هذه الوصفة ===
        if (action === 'add-ingredient') {
            if (!recipeId) {
                return;
            }
            // نقرأ المدخلات من نفس البطاقة فقط (مو من بطاقة ثانية)
            const selectIng = card.querySelector('select[data-field="ingredient"]');
            const amountInput = card.querySelector('input[data-field="amount"]');
            const unitSelect = card.querySelector('select[data-field="unit"]');

            const ingredientId = selectIng ? selectIng.value : '';
            const amount = amountInput ? Number(amountInput.value) : 0;
            const unit = unitSelect ? unitSelect.value : 'g';

            if (!ingredientId) {
                alert('من فضلك اختر مكوناً من القائمة.');
                return;
            }
            if (!(amount > 0)) {
                alert('من فضلك أدخل كمية أكبر من صفر.');
                return;
            }

            // قاعدة: ما نسمح بتكرار نفس المكون داخل نفس الوصفة
            const recipe = recipesApi.getRecipeById(recipeId);
            const alreadyAdded = (recipe && recipe.ingredients || []).some(function (entry) {
                return entry.ingredientId === ingredientId;
            });
            if (alreadyAdded) {
                alert('هذا المكون مضاف بالفعل إلى الوصفة. احذفه أولاً إذا أردت تغييره.');
                return;
            }

            recipesApi.addIngredientToRecipe(recipeId, ingredientId, amount, unit);
            renderRecipes();
            return;
        }

        // === إزالة مكون من هذه الوصفة ===
        if (action === 'remove-ingredient') {
            if (!recipeId) {
                return;
            }
            const ingredientId = target.dataset.ingredientId;
            if (!ingredientId) {
                return;
            }
            const confirmed = confirm('هل تريد إزالة هذا المكون من الوصفة؟');
            if (confirmed) {
                recipesApi.removeIngredientFromRecipe(recipeId, ingredientId);
                renderRecipes();
            }
            return;
        }
    });
});
