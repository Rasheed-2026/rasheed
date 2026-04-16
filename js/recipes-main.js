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

// === حالة صورة الوصفة ===
// selectedImageFile: ملف الصورة اللي اختاره المستخدم (قبل الرفع)
// existingImageUrl: لو نعدّل وصفة عندها صورة، نحفظ رابطها هنا
// shouldRemoveImage: لو المستخدم ضغط زر الإزالة أثناء التعديل
let selectedImageFile = null;
let existingImageUrl = null;
let shouldRemoveImage = false;

// حالة فتح/إغلاق قسم المكونات لكل وصفة.
// المفتاح = id الوصفة، القيمة = true (مفتوح) أو false/غير موجود (مغلق).
// في الذاكرة فقط — عند إعادة تحميل الصفحة كل الأقسام تبدأ مغلقة.
const openIngredientsByRecipe = {};

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

// === عرض قائمة الوصفات (async — يجيب من Supabase) ===
async function renderRecipes() {
    const listContainer = document.getElementById('recipes-list');

    // مؤشر تحميل أثناء الانتظار
    listContainer.innerHTML = '';
    const loading = document.createElement('p');
    loading.className = 'loading-message';
    loading.textContent = 'جاري التحميل...';
    listContainer.appendChild(loading);

    // نجيب الوصفات والمكونات بالتوازي لتسريع العرض
    const [recipes, allIngredients] = await Promise.all([
        recipesApi.getAllRecipes(),
        ingredientsApi.getAllIngredients()
    ]);

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
        card.dataset.recipeId = recipe.id;

        // === صورة الوصفة في أعلى البطاقة ===
        if (recipe.imageUrl) {
            var imgWrap = document.createElement('div');
            imgWrap.className = 'recipe-card__image';
            var imgEl = document.createElement('img');
            imgEl.src = recipe.imageUrl;
            imgEl.alt = recipe.name;
            imgEl.loading = 'lazy';
            imgWrap.appendChild(imgEl);
            card.appendChild(imgWrap);
        } else {
            var placeholder = document.createElement('div');
            placeholder.className = 'recipe-card__image recipe-card__image--placeholder';
            placeholder.textContent = '🍰';
            card.appendChild(placeholder);
        }

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

        // سطر قيم التسعير الخاصة بالوصفة.
        // قرار: للوصفات القديمة (ما عندها الحقول الجديدة)
        // نعرض القيم الافتراضية بصمت بدون أي علامة.
        // السبب: هي فعلاً القيم اللي سيستخدمها الحساب، فلا
        // داعي لإضافة ضوضاء بصرية. عند تعديل الوصفة سترى
        // القيم نفسها معبّأة في النموذج.
        const defaults = window.tasceerPricing;
        const hr = recipe.hourlyRate ?? defaults.DEFAULT_HOURLY_RATE;
        const er = recipe.electricityRate ?? defaults.DEFAULT_ELECTRICITY_RATE;
        const gp = recipe.gasCylinderPrice ?? defaults.DEFAULT_GAS_CYLINDER_PRICE;
        const pricingLine = document.createElement('div');
        pricingLine.className = 'item-meta item-meta--pricing';
        pricingLine.textContent =
            'قيم التسعير: ساعة العمل ' + hr + ' ريال' +
            ' — الكهرباء ' + er + ' هللة' +
            ' — الغاز ' + gp + ' ريال';

        info.appendChild(name);

        // سعر البيع — يظهر فقط لو محدد
        if (recipe.sellingPrice) {
            const sellingLine = document.createElement('div');
            sellingLine.className = 'item-meta item-meta--selling-price';
            sellingLine.textContent = 'سعر البيع: ' + recipe.sellingPrice.toFixed(2) + ' ريال';
            info.appendChild(sellingLine);
        }

        info.appendChild(meta);
        info.appendChild(energy);
        info.appendChild(pricingLine);

        // سطر التكاليف الإضافية — يظهر فقط إذا كانت قيمة واحدة على الأقل > 0
        const extrasText = formatExtraCostsLine(recipe);
        if (extrasText !== null) {
            const extrasLine = document.createElement('div');
            extrasLine.className = 'item-meta item-meta--pricing';
            extrasLine.textContent = extrasText;
            info.appendChild(extrasLine);
        }

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

        // === القسم الفرعي: مكونات الوصفة (قابل للطي) ===
        const isOpen = openIngredientsByRecipe[recipe.id] === true;

        // زر التبديل بديل العنوان القديم
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn btn-secondary toggle-ingredients-btn';
        toggleBtn.dataset.action = 'toggle-ingredients';
        toggleBtn.dataset.recipeId = recipe.id;
        // السهم في نهاية النص يتبدّل حسب حالة الفتح
        toggleBtn.textContent = 'المكونات ' + (isOpen ? '▴' : '▾');
        card.appendChild(toggleBtn);

        const ingSection = buildIngredientsSection(recipe, allIngredients);
        ingSection.hidden = !isOpen;
        card.appendChild(ingSection);

        listContainer.appendChild(card);
    });
}


// يبني قسم مكونات الوصفة داخل البطاقة:
// عنوان + قائمة المكونات الحالية + نموذج مصغّر للإضافة
function buildIngredientsSection(recipe, allIngredients) {
    const section = document.createElement('div');
    section.className = 'recipe-ingredients';

    // العنوان القديم أُزيل — زر التبديل أعلى القسم يؤدي دوره.

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

            // نبحث عن المكون الأصلي في القائمة المحمّلة مسبقاً.
            // لو انحذف، نعرض ملاحظة بالأحمر.
            const ingredient = allIngredients.find(function (ing) {
                return ing.id === entry.ingredientId;
            });
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

// يعبّي حقول التسعير الثلاثة بقيم معينة (دوال مساعدة صغيرة)
function fillPricingInputs(hourlyRate, electricityRate, gasCylinderPrice) {
    document.getElementById('recipe-hourly-rate').value = hourlyRate;
    document.getElementById('recipe-electricity-rate').value = electricityRate;
    document.getElementById('recipe-gas-price').value = gasCylinderPrice;
}

// يعبّي الحقول بالقيم الافتراضية (وضع الإضافة أو بعد الإلغاء)
function fillPricingInputsWithDefaults() {
    const d = window.tasceerPricing;
    fillPricingInputs(d.DEFAULT_HOURLY_RATE, d.DEFAULT_ELECTRICITY_RATE, d.DEFAULT_GAS_CYLINDER_PRICE);
}

// يعبّي حقول التكاليف الإضافية الثلاثة بقيم معينة
function fillExtraCostInputs(packaging, delivery, other) {
    document.getElementById('recipe-packaging-cost').value = packaging;
    document.getElementById('recipe-delivery-cost').value = delivery;
    document.getElementById('recipe-other-cost').value = other;
}

// التكاليف الإضافية تبدأ بصفر افتراضياً
function fillExtraCostInputsWithDefaults() {
    fillExtraCostInputs(0, 0, 0);
}

// تكوّن سطر التكاليف الإضافية لعرضه في بطاقة الوصفة.
// نتجاهل الحقول التي قيمتها صفر. لو الكل صفر نرجع null
// عشان طبقة العرض ما تضيف السطر أصلاً.
function formatExtraCostsLine(recipe) {
    const pkg = Number(recipe.packagingCost ?? 0);
    const del = Number(recipe.deliveryCost ?? 0);
    const oth = Number(recipe.otherCost ?? 0);
    const parts = [];
    if (pkg > 0) {
        parts.push('تغليف ' + pkg + ' ريال');
    }
    if (del > 0) {
        parts.push('توصيل ' + del + ' ريال');
    }
    if (oth > 0) {
        parts.push('أخرى ' + oth + ' ريال');
    }
    if (parts.length === 0) {
        return null;
    }
    return 'تكاليف إضافية: ' + parts.join(' — ');
}

// يحوّل النموذج إلى وضع التعديل ويعبّيه بقيم الوصفة
async function enterEditMode(id) {
    const recipe = await recipesApi.getRecipeById(id);
    if (!recipe) {
        return;
    }

    editingRecipeId = id;

    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-servings').value = recipe.servings;
    document.getElementById('recipe-prep-time').value = recipe.prepTimeMinutes;
    document.getElementById('recipe-cook-time').value = recipe.cookTimeMinutes;
    document.getElementById('recipe-energy').value = recipe.energySource;

    // قيم التسعير: إذا الوصفة قديمة وما عندها الحقول،
    // نستخدم القيم الافتراضية المعروضة من pricing.js
    const d = window.tasceerPricing;
    fillPricingInputs(
        recipe.hourlyRate ?? d.DEFAULT_HOURLY_RATE,
        recipe.electricityRate ?? d.DEFAULT_ELECTRICITY_RATE,
        recipe.gasCylinderPrice ?? d.DEFAULT_GAS_CYLINDER_PRICE
    );

    // سعر البيع: نعبّيه لو موجود
    document.getElementById('recipe-selling-price').value =
        recipe.sellingPrice ? recipe.sellingPrice : '';

    // التكاليف الإضافية: للوصفات القديمة نعرض 0
    fillExtraCostInputs(
        recipe.packagingCost ?? 0,
        recipe.deliveryCost ?? 0,
        recipe.otherCost ?? 0
    );

    // === حالة الصورة أثناء التعديل ===
    selectedImageFile = null;
    shouldRemoveImage = false;
    existingImageUrl = recipe.imageUrl || null;

    var preview = document.getElementById('recipe-image-preview');
    var previewImg = document.getElementById('recipe-image-preview-img');
    var uploadLabel = document.getElementById('recipe-image-label');

    if (existingImageUrl) {
        // نعرض الصورة الحالية كمعاينة
        previewImg.src = existingImageUrl;
        preview.hidden = false;
        uploadLabel.hidden = true;
    } else {
        preview.hidden = true;
        uploadLabel.hidden = false;
    }

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
    // بعد reset() نرجع القيم الافتراضية للحقول الثلاثة
    fillPricingInputsWithDefaults();
    fillExtraCostInputsWithDefaults();

    // نعيد ضبط حالة الصورة
    resetImageState();

    document.getElementById('recipe-form-title').textContent = 'إضافة وصفة جديدة';
    document.getElementById('recipe-submit-btn').textContent = 'أضف الوصفة';
    document.getElementById('recipe-cancel-btn').hidden = true;
}

// يعيد ضبط كل حالة الصورة (بعد الحفظ أو الإلغاء)
function resetImageState() {
    selectedImageFile = null;
    existingImageUrl = null;
    shouldRemoveImage = false;
    var preview = document.getElementById('recipe-image-preview');
    var uploadLabel = document.getElementById('recipe-image-label');
    var fileInput = document.getElementById('recipe-image');
    if (preview) preview.hidden = true;
    if (uploadLabel) uploadLabel.hidden = false;
    if (fileInput) fileInput.value = '';
}

// === ربط الأحداث بعد ما تجهز الصفحة ===
document.addEventListener('DOMContentLoaded', function () {
    renderRecipes();
    // تعبئة أولية للحقول الثلاثة بالقيم الافتراضية
    fillPricingInputsWithDefaults();
    fillExtraCostInputsWithDefaults();

    const form = document.getElementById('add-recipe-form');
    const listContainer = document.getElementById('recipes-list');
    const cancelBtn = document.getElementById('recipe-cancel-btn');

    // === أحداث صورة الوصفة ===
    var imageInput = document.getElementById('recipe-image');
    var imageRemoveBtn = document.getElementById('recipe-image-remove');

    // عند اختيار ملف صورة
    imageInput.addEventListener('change', function () {
        var file = imageInput.files[0];
        if (!file) return;

        // نتحقق إن الملف صورة بصيغة مدعومة
        var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.indexOf(file.type) === -1) {
            alert('الملف المختار ليس صورة مدعومة. اختر صورة بصيغة JPEG أو PNG أو WebP.');
            imageInput.value = '';
            return;
        }

        // نتحقق من الحجم (5 ميجا كحد أقصى قبل الضغط)
        if (file.size > 5 * 1024 * 1024) {
            alert('حجم الصورة كبير جداً (أكثر من 5 ميجا). اختر صورة أصغر.');
            imageInput.value = '';
            return;
        }

        selectedImageFile = file;
        shouldRemoveImage = false;

        // نعرض معاينة الصورة
        var reader = new FileReader();
        reader.onload = function () {
            var previewImg = document.getElementById('recipe-image-preview-img');
            previewImg.src = reader.result;
            document.getElementById('recipe-image-preview').hidden = false;
            document.getElementById('recipe-image-label').hidden = true;
        };
        reader.readAsDataURL(file);
    });

    // عند الضغط على زر إزالة الصورة
    imageRemoveBtn.addEventListener('click', function () {
        selectedImageFile = null;
        imageInput.value = '';
        document.getElementById('recipe-image-preview').hidden = true;
        document.getElementById('recipe-image-label').hidden = false;

        // لو نعدّل وصفة وعندها صورة سابقة، نسجّل إننا نبغى نحذفها
        if (editingRecipeId !== null && existingImageUrl) {
            shouldRemoveImage = true;
        }
    });

    // === إضافة أو تعديل وصفة ===
    form.addEventListener('submit', async function (event) {
        // نوقف السلوك الافتراضي للمتصفح فوراً
        event.preventDefault();

        const name = document.getElementById('recipe-name').value.trim();
        const servings = Number(document.getElementById('recipe-servings').value);
        const prepTime = Number(document.getElementById('recipe-prep-time').value);
        const cookTime = Number(document.getElementById('recipe-cook-time').value);
        const energySource = document.getElementById('recipe-energy').value;

        // قيم التسعير الجديدة — نستخدم parseFloat للسماح بكسور عشرية
        const hourlyRate = parseFloat(document.getElementById('recipe-hourly-rate').value);
        const electricityRate = parseFloat(document.getElementById('recipe-electricity-rate').value);
        const gasCylinderPrice = parseFloat(document.getElementById('recipe-gas-price').value);

        // التكاليف الإضافية: الصفر مسموح
        const packagingCost = parseFloat(document.getElementById('recipe-packaging-cost').value);
        const deliveryCost = parseFloat(document.getElementById('recipe-delivery-cost').value);
        const otherCost = parseFloat(document.getElementById('recipe-other-cost').value);

        // سعر البيع — اختياري
        const sellingPrice = parseFloat(document.getElementById('recipe-selling-price').value) || null;

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
        if (!(hourlyRate > 0)) {
            alert('قيمة ساعة العمل لازم تكون رقم أكبر من صفر.');
            return;
        }
        if (!(electricityRate > 0)) {
            alert('تعرفة الكهرباء لازم تكون رقم أكبر من صفر.');
            return;
        }
        if (!(gasCylinderPrice > 0)) {
            alert('سعر أسطوانة الغاز لازم يكون رقم أكبر من صفر.');
            return;
        }
        if (!(packagingCost >= 0)) {
            alert('تكلفة التغليف لازم تكون رقم صفر أو أكثر.');
            return;
        }
        if (!(deliveryCost >= 0)) {
            alert('تكلفة التوصيل لازم تكون رقم صفر أو أكثر.');
            return;
        }
        if (!(otherCost >= 0)) {
            alert('التكاليف الأخرى لازم تكون رقم صفر أو أكثر.');
            return;
        }

        const submitBtn = document.getElementById('recipe-submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحفظ...';

        try {
            // === معالجة الصورة ===
            // imageUrlForSave:
            //   undefined = ما نلمس الصورة الحالية (في التعديل)
            //   null     = نحذف الصورة
            //   string   = رابط صورة جديدة
            var imageUrlForSave = undefined;

            if (selectedImageFile) {
                // الحالة أ: المستخدم اختار صورة جديدة — نرفعها
                imageUrlForSave = await recipesApi.uploadRecipeImage(selectedImageFile);
                // لو فيه صورة قديمة، نحذفها من Storage
                if (existingImageUrl) {
                    recipesApi.deleteRecipeImage(existingImageUrl);
                }
            } else if (shouldRemoveImage) {
                // الحالة ب: المستخدم ضغط إزالة — نمسح الصورة
                imageUrlForSave = null;
                if (existingImageUrl) {
                    recipesApi.deleteRecipeImage(existingImageUrl);
                }
            }
            // الحالة ج: ما لمس الصورة = imageUrlForSave يبقى undefined

            if (editingRecipeId === null) {
                // إضافة وصفة جديدة
                await recipesApi.addRecipe(name, servings, prepTime, cookTime, energySource,
                    hourlyRate, electricityRate, gasCylinderPrice,
                    packagingCost, deliveryCost, otherCost,
                    imageUrlForSave !== undefined ? imageUrlForSave : null,
                    sellingPrice);
                form.reset();
                fillPricingInputsWithDefaults();
                fillExtraCostInputsWithDefaults();
                resetImageState();
            } else {
                // تعديل وصفة موجودة
                await recipesApi.updateRecipe(editingRecipeId, name, servings, prepTime, cookTime, energySource,
                    hourlyRate, electricityRate, gasCylinderPrice,
                    packagingCost, deliveryCost, otherCost,
                    imageUrlForSave,
                    sellingPrice);
                exitEditMode();
            }
            await renderRecipes();
        } catch (err) {
            alert(err.message || 'تعذر حفظ الوصفة.');
        } finally {
            submitBtn.disabled = false;
            if (submitBtn.textContent === 'جاري الحفظ...') {
                submitBtn.textContent = originalText;
            }
        }
    });

    // زر إلغاء التعديل
    cancelBtn.addEventListener('click', function () {
        exitEditMode();
    });

    // === أحداث البطاقات عبر event delegation ===
    listContainer.addEventListener('click', async function (event) {
        const target = event.target;
        if (!target.matches('button[data-action]')) {
            return;
        }

        const action = target.dataset.action;

        // نحصل على بطاقة الوصفة الأم لأي زر داخلها
        const card = target.closest('.item-card');
        const recipeId = card ? card.dataset.recipeId : null;

        // === تبديل ظهور قسم المكونات ===
        if (action === 'toggle-ingredients') {
            const id = target.dataset.recipeId;
            if (!id) {
                return;
            }
            openIngredientsByRecipe[id] = !openIngredientsByRecipe[id];
            await renderRecipes();
            return;
        }

        // === تعديل الوصفة ===
        if (action === 'edit') {
            await enterEditMode(target.dataset.id);
            return;
        }

        // === حذف الوصفة بالكامل ===
        if (action === 'delete') {
            const id = target.dataset.id;
            const confirmed = confirm('هل أنت متأكد من حذف هذه الوصفة؟');
            if (!confirmed) return;
            try {
                if (editingRecipeId === id) {
                    exitEditMode();
                }
                delete openIngredientsByRecipe[id];
                await recipesApi.deleteRecipe(id);
                await renderRecipes();
            } catch (err) {
                alert(err.message || 'تعذر حذف الوصفة.');
            }
            return;
        }

        // === إضافة مكون إلى هذه الوصفة ===
        if (action === 'add-ingredient') {
            if (!recipeId) return;

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

            // القيد الفريد في القاعدة يمنع التكرار — نعرض رسالة
            // مفهومة لو رجع خطأ 23505.
            try {
                await recipesApi.addIngredientToRecipe(recipeId, ingredientId, amount, unit);
                openIngredientsByRecipe[recipeId] = true;
                await renderRecipes();
            } catch (err) {
                alert(err.message || 'تعذر إضافة المكون.');
            }
            return;
        }

        // === إزالة مكون من هذه الوصفة ===
        if (action === 'remove-ingredient') {
            if (!recipeId) return;
            const ingredientId = target.dataset.ingredientId;
            if (!ingredientId) return;

            const confirmed = confirm('هل تريد إزالة هذا المكون من الوصفة؟');
            if (!confirmed) return;
            try {
                await recipesApi.removeIngredientFromRecipe(recipeId, ingredientId);
                openIngredientsByRecipe[recipeId] = true;
                await renderRecipes();
            } catch (err) {
                alert(err.message || 'تعذر إزالة المكون.');
            }
            return;
        }
    });
});
