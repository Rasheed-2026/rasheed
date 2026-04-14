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

// متغير حالة: null = وضع الإضافة، غير ذلك = رقم الوصفة قيد التعديل
let editingRecipeId = null;

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

    recipes.forEach(function (recipe) {
        const card = document.createElement('div');
        card.className = 'item-card';

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

        // ملاحظة مؤقتة: اختيار المكونات سيأتي في الجلسة القادمة
        const note = document.createElement('div');
        note.className = 'item-note';
        note.textContent = 'لم يتم اختيار المكونات بعد';

        card.appendChild(info);
        card.appendChild(actions);
        card.appendChild(note);

        listContainer.appendChild(card);
    });
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
            const confirmed = confirm('هل أنت متأكد من حذف هذه الوصفة؟');
            if (confirmed) {
                // لو كنا نعدّل نفس الوصفة اللي تنحذف، نخرج من وضع التعديل
                if (editingRecipeId === id) {
                    exitEditMode();
                }
                recipesApi.deleteRecipe(id);
                renderRecipes();
            }
        }
    });
});
