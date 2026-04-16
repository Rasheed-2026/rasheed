/*
  ============================================
  ملف الواجهة لصفحة التسعير
  ============================================
  المسؤولية هنا فقط DOM وأحداث المستخدم:
  - اختيار وصفة وهامش ربح
  - عرض تفصيل التكلفة + سعر واحد مقترح
  - إدارة قائمة مقارنة مؤقتة في الذاكرة
  كل الحسابات تأتي من window.tasceerPricing.
  ============================================
*/

// مرجع مختصر لكل الطبقات
const recipesApi = window.tasceerRecipes;
const ingredientsApi = window.tasceerIngredients;
const pricing = window.tasceerPricing;

// === حالة الصفحة (في الذاكرة فقط — تختفي عند إعادة التحميل) ===

// قائمة المقارنة. كل عنصر يحتوي: id (UUID)، recipeId، recipeName،
// margin، breakdown، sellingPrice، perServing، hasDeletedIngredients
let comparisonList = [];

// آخر حساب أجراه المستخدم — نحتاجه عشان الـ checkbox تعرف إيش تضيف
// للمقارنة. يصير null قبل أي حساب.
let lastCalculated = null;

// حالة عرض/إخفاء قسم تفاصيل التكلفة. تبدأ false في كل حساب جديد
// عشان النتيجة تظهر نظيفة (الأرقام الكبيرة فقط)، والمستخدم يفتح
// التفاصيل بنفسه إذا حب.
let breakdownVisible = false;

// === دوال مساعدة للعرض ===

// تنسيق رقم بسيط مثل ما في recipes-main.js
function formatNumber(num) {
    return Number(num.toFixed(2)).toString();
}

// نفس دالة formatQuantityForDisplay في recipes-main.js.
// نكررها هنا عشان صفحة التسعير ما تعتمد على ملفات أخرى غير المطلوبة.
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

// اسم الوحدة الأساسية: نستخدمها في سطر تفاصيل المواد الخام
function baseUnitName(ingredient) {
    if (ingredient.unitType === 'piece') {
        return 'حبة';
    }
    if (ingredient.unitType === 'volume') {
        return 'مليلتر';
    }
    return 'جرام';
}

// جملة شارحة لسطر الطاقة حسب المصدر المختار.
// نقرأ قيم الكهرباء والغاز من الوصفة نفسها، مع fallback
// للقيم الافتراضية إذا كانت الوصفة قديمة.
function buildEnergyExplainer(recipe) {
    const source = recipe.energySource;
    const cook = Number(recipe.cookTimeMinutes) || 0;
    const kw = pricing.ELECTRIC_OVEN_KW;

    const electricityHalalas = recipe.electricityRate ?? pricing.DEFAULT_ELECTRICITY_RATE;
    const gasPrice = recipe.gasCylinderPrice ?? pricing.DEFAULT_GAS_CYLINDER_PRICE;
    const rateSAR = (Number(electricityHalalas) / 100).toFixed(2);

    if (source === 'none' || cook === 0) {
        return 'لم يتم اختيار مصدر طاقة لهذه الوصفة (أو وقت الطبخ صفر).';
    }
    if (source === 'electric') {
        return 'الفرن الكهربائي (' + kw + ' كيلوواط) × ' + cook + ' دقيقة × ' +
            'تعرفة الكهرباء (' + rateSAR + ' ريال لكل كيلوواط ساعة)';
    }
    if (source === 'gas') {
        return 'الغاز لمدة ' + cook + ' دقيقة، بناءً على سعر أسطوانة ' +
            pricing.formatSAR(gasPrice) +
            ' تدوم حوالي ' + pricing.GAS_CYLINDER_BURN_HOURS + ' ساعة';
    }
    if (source === 'both') {
        return 'نصف الوقت كهرباء (' + (cook / 2) + ' دقيقة) ونصفه غاز (' +
            (cook / 2) + ' دقيقة)';
    }
    return '';
}

// صف موحد: اسم وقيمة
function buildCostRow(label, value) {
    const row = document.createElement('div');
    row.className = 'cost-row';
    const l = document.createElement('span');
    l.className = 'cost-row__label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'cost-row__value';
    v.textContent = value;
    row.appendChild(l);
    row.appendChild(v);
    return row;
}

// رسالة عربية لطيفة داخل منطقة النتيجة (بديل alert)
function showInlineMessage(text) {
    const result = document.getElementById('calculation-result');
    result.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'cost-inline-message';
    msg.textContent = text;
    result.appendChild(msg);
    result.hidden = false;
}

// === تعبئة قائمة الوصفات في الـ <select> (async من Supabase) ===
async function populateRecipeSelect() {
    const select = document.getElementById('recipe-select');
    const recipes = await recipesApi.getAllRecipes();

    // نحافظ على العنصر الأول (placeholder) ونزيل الباقي
    while (select.options.length > 1) {
        select.remove(1);
    }

    recipes.forEach(function (recipe) {
        const opt = document.createElement('option');
        opt.value = recipe.id;
        opt.textContent = recipe.name;
        select.appendChild(opt);
    });

    return recipes.length;
}

// === قراءة قيمة الهامش من النموذج كرقم (نسبة مئوية) ===
// ترجع null لو القيمة غير صالحة.
function readMarginValue() {
    const marginSelect = document.getElementById('margin-select');
    const choice = marginSelect.value;

    if (choice === 'custom') {
        const input = document.getElementById('custom-margin');
        const n = Number(input.value);
        if (!(n > 0)) {
            return null;
        }
        return n;
    }

    const n = Number(choice);
    if (!(n > 0)) {
        return null;
    }
    return n;
}

// === بناء نتيجة الحساب الكاملة ===
// نعيد رسم محتوى calculation-result بناءً على الكائن calculation.
function renderCalculationResult(calculation) {
    const result = document.getElementById('calculation-result');
    result.innerHTML = '';

    // تنبيه المكونات المحذوفة
    if (calculation.hasDeletedIngredients) {
        const warn = document.createElement('div');
        warn.className = 'warning-note';
        warn.textContent = 'تنبيه: بعض المكونات تم حذفها من قائمة المكونات ولم تُحسب في التكلفة.';
        result.appendChild(warn);
    }

    // === صندوق "ستكسب من كل حصة" — التشجيع العاطفي في أعلى النتيجة ===
    // الربح الإجمالي = السعر - التكلفة، والربح للحصة = الربح ÷ عدد الحصص.
    // نتعامل بدفاعية لو servings = 0 بعرض شرطة بدل رقم.
    const totalCost = calculation.breakdown.total;
    const sellingPrice = calculation.sellingPrice;
    const totalProfit = Math.round((sellingPrice - totalCost) * 100) / 100;
    const servings = Number(calculation.recipe.servings) || 0;
    const profitPerServing = servings > 0
        ? Math.round((totalProfit / servings) * 100) / 100
        : null;

    const highlight = document.createElement('div');
    highlight.className = 'profit-highlight';

    // === صورة مصغّرة للوصفة (لو موجودة) ===
    if (calculation.recipe.imageUrl) {
        var thumbWrap = document.createElement('div');
        thumbWrap.className = 'profit-highlight__thumb';
        var thumbImg = document.createElement('img');
        thumbImg.src = calculation.recipe.imageUrl;
        thumbImg.alt = calculation.recipeName;
        thumbImg.loading = 'lazy';
        thumbWrap.appendChild(thumbImg);
        highlight.appendChild(thumbWrap);
    }

    const hLabel = document.createElement('div');
    hLabel.className = 'profit-highlight__label';
    hLabel.textContent = 'ستكسب من كل حصة';
    highlight.appendChild(hLabel);

    const hAmount = document.createElement('div');
    hAmount.className = 'profit-highlight__amount';
    hAmount.textContent = profitPerServing === null ? '—' : pricing.formatSAR(profitPerServing);
    highlight.appendChild(hAmount);

    const hTotal = document.createElement('div');
    hTotal.className = 'profit-highlight__total';
    hTotal.textContent = 'ربح إجمالي للوصفة كاملة: ' + pricing.formatSAR(totalProfit);
    highlight.appendChild(hTotal);

    result.appendChild(highlight);

    // === مؤشر نسبة تكلفة المواد الخام ===
    // يستخدم سعر البيع المحسوب بناءً على الهامش الذي اختاره المستخدم.
    // يظهر دائماً (لو ما فيه بيانات حقيقية، كائن الفئة يعطينا سلوكاً معقولاً).
    const foodCostPct = pricing.calculateFoodCostPercentage(
        calculation.breakdown.materials,
        calculation.sellingPrice
    );
    const foodCategory = pricing.getFoodCostCategory(foodCostPct);

    const indicator = document.createElement('div');
    indicator.className = 'food-cost-indicator food-cost-indicator--' + foodCategory.level;

    const indLabel = document.createElement('div');
    indLabel.className = 'food-cost-indicator__title';
    indLabel.textContent = 'نسبة تكلفة المواد الخام';
    indicator.appendChild(indLabel);

    const indPct = document.createElement('div');
    indPct.className = 'food-cost-indicator__percentage';
    indPct.textContent = foodCostPct.toFixed(1) + '%';
    indicator.appendChild(indPct);

    const indCatLabel = document.createElement('div');
    indCatLabel.className = 'food-cost-indicator__label';
    indCatLabel.textContent = foodCategory.labelAr;
    indicator.appendChild(indCatLabel);

    const indExplain = document.createElement('div');
    indExplain.className = 'food-cost-indicator__explanation';
    indExplain.textContent = foodCategory.explanationAr;
    indicator.appendChild(indExplain);

    const indFoot = document.createElement('div');
    indFoot.className = 'food-cost-indicator__footnote';
    indFoot.textContent = 'هذه النسب مخصصة للأسر المنتجة، وتختلف عن معايير المطاعم التجارية.';
    indicator.appendChild(indFoot);

    result.appendChild(indicator);

    // === زر إظهار/إخفاء التفاصيل ===
    // يبدأ مغلقاً في كل حساب جديد. الحالة في breakdownVisible.
    breakdownVisible = false;
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.id = 'toggle-breakdown-btn';
    toggleBtn.className = 'btn btn-secondary toggle-details-btn';
    toggleBtn.textContent = 'عرض التفاصيل ▾';
    result.appendChild(toggleBtn);

    // حاوية التفاصيل القابلة للطي — تبدأ مخفية
    const breakdownContainer = document.createElement('div');
    breakdownContainer.id = 'breakdown-container';
    breakdownContainer.hidden = true;

    // === القسم أ: تفصيل التكلفة الفعلية (داخل الحاوية القابلة للطي) ===
    const sectionA = document.createElement('div');
    sectionA.className = 'cost-section';

    const titleA = document.createElement('h4');
    titleA.className = 'cost-section__title';
    titleA.textContent = 'كيف حسبنا التكلفة الفعلية؟';
    sectionA.appendChild(titleA);

    const breakdown = calculation.breakdown;
    const recipe = calculation.recipe;
    const entries = recipe.ingredients || [];
    // المكونات محمّلة مسبقاً ومرفقة مع كائن الحساب
    const allIngredients = calculation.allIngredients || [];

    // تكلفة المواد الخام
    sectionA.appendChild(buildCostRow('تكلفة المواد الخام', pricing.formatSAR(breakdown.materials)));

    const materialsDetails = document.createElement('div');
    materialsDetails.className = 'cost-row__details';
    entries.forEach(function (entry) {
        const ingredient = allIngredients.find(function (ing) {
            return ing.id === entry.ingredientId;
        });
        if (!ingredient) {
            const miss = document.createElement('div');
            miss.textContent = '• (مكون محذوف) — لم يُحسب';
            materialsDetails.appendChild(miss);
            return;
        }
        const contribution = (ingredient.packagePrice / ingredient.packageWeightInGrams) * Number(entry.quantity);
        const line = document.createElement('div');
        line.textContent =
            '• ' + ingredient.name + ': ' +
            formatQuantityForDisplay(ingredient, entry.quantity) +
            ' × (' + pricing.formatSAR(ingredient.packagePrice) +
            ' ÷ ' + ingredient.packageWeightInGrams + ' ' + baseUnitName(ingredient) + ')' +
            ' = ' + pricing.formatSAR(contribution);
        materialsDetails.appendChild(line);
    });
    sectionA.appendChild(materialsDetails);

    // تكلفة الطاقة
    sectionA.appendChild(buildCostRow('تكلفة الطاقة', pricing.formatSAR(breakdown.energy)));
    const energyDetails = document.createElement('div');
    energyDetails.className = 'cost-row__details';
    energyDetails.textContent = buildEnergyExplainer(recipe);
    sectionA.appendChild(energyDetails);

    // قيمة الوقت — نقرأ سعر الساعة من الوصفة (أو الافتراضي)
    sectionA.appendChild(buildCostRow('قيمة وقتك', pricing.formatSAR(breakdown.time)));
    const timeDetails = document.createElement('div');
    timeDetails.className = 'cost-row__details';
    const totalMinutes = Number(recipe.prepTimeMinutes) + Number(recipe.cookTimeMinutes);
    const hourlyRate = recipe.hourlyRate ?? pricing.DEFAULT_HOURLY_RATE;
    timeDetails.textContent =
        totalMinutes + ' دقيقة × (' + pricing.formatSAR(hourlyRate) + ' ÷ 60 دقيقة)';
    sectionA.appendChild(timeDetails);

    // === التكاليف الإضافية (تظهر فقط لو فيه قيمة > 0) ===
    const extras = breakdown.extras;
    if (extras && extras.total > 0) {
        const extrasTitle = document.createElement('div');
        extrasTitle.className = 'cost-extras-subtitle';
        extrasTitle.textContent = 'تكاليف إضافية';
        sectionA.appendChild(extrasTitle);

        const extrasDetails = document.createElement('div');
        extrasDetails.className = 'cost-row__details';
        if (extras.packaging > 0) {
            const l = document.createElement('div');
            l.textContent = '• تغليف: ' + pricing.formatSAR(extras.packaging);
            extrasDetails.appendChild(l);
        }
        if (extras.delivery > 0) {
            const l = document.createElement('div');
            l.textContent = '• توصيل: ' + pricing.formatSAR(extras.delivery);
            extrasDetails.appendChild(l);
        }
        if (extras.other > 0) {
            const l = document.createElement('div');
            l.textContent = '• أخرى: ' + pricing.formatSAR(extras.other);
            extrasDetails.appendChild(l);
        }
        sectionA.appendChild(extrasDetails);

        // سطر إجمالي التكاليف الإضافية بنفس نمط الصفوف الرئيسية
        sectionA.appendChild(buildCostRow('إجمالي التكاليف الإضافية', pricing.formatSAR(extras.total)));
    }

    // صف الإجمالي المميّز
    const totalRow = document.createElement('div');
    totalRow.className = 'cost-row cost-total';
    const totalLabel = document.createElement('span');
    totalLabel.className = 'cost-row__label';
    totalLabel.textContent = 'الإجمالي الفعلي';
    const totalValue = document.createElement('span');
    totalValue.className = 'cost-row__value';
    totalValue.textContent = pricing.formatSAR(breakdown.total);
    totalRow.appendChild(totalLabel);
    totalRow.appendChild(totalValue);
    sectionA.appendChild(totalRow);

    breakdownContainer.appendChild(sectionA);
    result.appendChild(breakdownContainer);

    // === القسم ب: بطاقة السعر المقترح (واحدة فقط) ===
    const sectionB = document.createElement('div');
    sectionB.className = 'cost-section';

    const titleB = document.createElement('h4');
    titleB.className = 'cost-section__title';
    titleB.textContent = 'السعر المقترح للبيع';
    sectionB.appendChild(titleB);

    const card = document.createElement('div');
    card.className = 'price-card price-card--recommended';

    const cardTitle = document.createElement('div');
    cardTitle.className = 'price-card__title';
    cardTitle.textContent = 'ربح ' + calculation.margin + '%';
    card.appendChild(cardTitle);

    const totalLine = document.createElement('div');
    totalLine.className = 'price-card__line';
    totalLine.textContent = 'السعر الكامل: ' + pricing.formatSAR(calculation.sellingPrice);
    card.appendChild(totalLine);

    const perLine = document.createElement('div');
    perLine.className = 'price-card__line';
    if (calculation.perServing === null) {
        perLine.textContent = 'سعر الحصة الواحدة: —';
    } else {
        perLine.textContent = 'سعر الحصة الواحدة: ' + pricing.formatSAR(calculation.perServing);
    }
    card.appendChild(perLine);

    sectionB.appendChild(card);
    result.appendChild(sectionB);

    // === القسم ج: تذييل تعليمي ===
    const footer = document.createElement('p');
    footer.className = 'educational-footer';
    footer.textContent =
        'هذه الأرقام تقديرية. عدّل قيم التسعير داخل الوصفة نفسها لتكون أدق لوضعك.';
    result.appendChild(footer);

    // === Checkbox إضافة للمقارنة + رسالة تأكيد ===
    const addRow = document.createElement('div');
    addRow.className = 'add-to-comparison';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'add-to-comparison';
    // نعيد ضبطها لـ unchecked في كل حساب جديد
    checkbox.checked = false;

    const checkboxLabel = document.createElement('label');
    checkboxLabel.htmlFor = 'add-to-comparison';
    checkboxLabel.textContent = 'أضف إلى المقارنة';

    const feedback = document.createElement('span');
    feedback.id = 'comparison-feedback';
    feedback.className = 'comparison-feedback';
    feedback.textContent = '';

    addRow.appendChild(checkbox);
    addRow.appendChild(checkboxLabel);
    addRow.appendChild(feedback);

    // زر تصدير صورة للعميل — على الطرف الآخر من نفس الصف
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.id = 'export-customer-image-btn';
    exportBtn.className = 'btn btn-secondary export-image-btn';
    exportBtn.textContent = 'صورة للعميل';
    addRow.appendChild(exportBtn);

    result.appendChild(addRow);

    result.hidden = false;
}

// === رسم قسم المقارنة ===
function renderComparisonSection() {
    const section = document.getElementById('comparison-section');
    section.innerHTML = '';

    if (comparisonList.length === 0) {
        section.hidden = true;
        return;
    }

    // رأس القسم: عنوان + زر مسح
    const header = document.createElement('div');
    header.className = 'comparison-header';

    const h2 = document.createElement('h2');
    h2.id = 'comparison-title';
    h2.textContent = 'المقارنة';
    header.appendChild(h2);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn btn-secondary';
    clearBtn.dataset.action = 'clear-comparison';
    clearBtn.textContent = 'مسح المقارنة';
    header.appendChild(clearBtn);

    section.appendChild(header);

    // شبكة البطاقات
    const grid = document.createElement('div');
    grid.className = 'comparison-grid';

    comparisonList.forEach(function (item) {
        const card = document.createElement('div');
        card.className = 'comparison-card';

        const name = document.createElement('div');
        name.className = 'comparison-card__name';
        name.textContent = item.recipeName;
        card.appendChild(name);

        const margin = document.createElement('div');
        margin.className = 'comparison-card__line';
        margin.textContent = 'ربح ' + item.margin + '%';
        card.appendChild(margin);

        const cost = document.createElement('div');
        cost.className = 'comparison-card__line';
        cost.textContent = 'التكلفة الفعلية: ' + pricing.formatSAR(item.breakdown.total);
        card.appendChild(cost);

        const price = document.createElement('div');
        price.className = 'comparison-card__line';
        price.textContent = 'السعر المقترح: ' + pricing.formatSAR(item.sellingPrice);
        card.appendChild(price);

        const per = document.createElement('div');
        per.className = 'comparison-card__line';
        if (item.perServing === null) {
            per.textContent = 'سعر الحصة: —';
        } else {
            per.textContent = 'سعر الحصة: ' + pricing.formatSAR(item.perServing);
        }
        card.appendChild(per);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-small';
        remove.dataset.action = 'remove-comparison';
        remove.dataset.id = item.id;
        remove.textContent = 'إزالة';
        card.appendChild(remove);

        grid.appendChild(card);
    });

    section.appendChild(grid);
    section.hidden = false;
}

// === الدالة الرئيسية: حساب الوصفة المختارة (async) ===
// ترجع كائن الحساب أو null إذا فيه خطأ.
async function performCalculation() {
    const recipeSelect = document.getElementById('recipe-select');
    const recipeId = recipeSelect.value;

    if (!recipeId) {
        alert('من فضلك اختر وصفة من القائمة.');
        return null;
    }

    const margin = readMarginValue();
    if (margin === null) {
        alert('من فضلك أدخل نسبة ربح صحيحة أكبر من صفر.');
        return null;
    }

    // نجيب الوصفة مع مكوناتها وكل المكونات دفعة واحدة بالتوازي
    const [recipe, allIngredients] = await Promise.all([
        recipesApi.getRecipeById(recipeId),
        ingredientsApi.getAllIngredients()
    ]);

    if (!recipe) {
        alert('الوصفة غير موجودة.');
        return null;
    }

    // شروط مسبقة
    const entries = recipe.ingredients || [];
    if (entries.length === 0) {
        showInlineMessage(
            'لا يمكن حساب التكلفة بدون مكونات. أضف مكوناً واحداً على الأقل للوصفة من شاشة الوصفات.'
        );
        return null;
    }
    if (!(Number(recipe.servings) > 0)) {
        showInlineMessage('عدد الحصص غير صحيح في الوصفة. عدّلها أولاً.');
        return null;
    }

    // نمرر allIngredients لطبقة الحسابات المتزامنة
    const breakdown = pricing.calculateTotalCost(recipe, allIngredients);

    // نفحص المكونات المحذوفة عبر البحث في القائمة المحمّلة
    const hasDeletedIngredients = entries.some(function (entry) {
        return !allIngredients.find(function (ing) { return ing.id === entry.ingredientId; });
    });

    const sellingPrice = Math.round(breakdown.total * (1 + margin / 100) * 100) / 100;
    const perServing = recipe.servings > 0
        ? Math.round((sellingPrice / recipe.servings) * 100) / 100
        : null;

    return {
        recipeId: recipe.id,
        recipeName: recipe.name,
        recipe: recipe,
        allIngredients: allIngredients,
        margin: margin,
        breakdown: breakdown,
        sellingPrice: sellingPrice,
        perServing: perServing,
        hasDeletedIngredients: hasDeletedIngredients
    };
}

// === تصدير صورة للعميل ===
// نفتح نافذة مخصصة بدل prompt، ثم نملأ القالب ونصدّر.

// فتح نافذة التصدير
function handleExportCustomerImage() {
    if (!lastCalculated) {
        alert('لا توجد نتيجة حساب لتصديرها.');
        return;
    }
    if (typeof html2canvas !== 'function') {
        alert('مكتبة إنشاء الصورة لم تُحمّل. تحقق من اتصالك بالإنترنت.');
        return;
    }

    var modal = document.getElementById('customer-image-modal');
    var messageInput = document.getElementById('customer-message');
    var includeImageField = document.getElementById('include-image-field');
    var includeImageCheckbox = document.getElementById('include-recipe-image');

    // نعيد ضبط الرسالة
    messageInput.value = 'شكراً لطلبك';

    // لو الوصفة عندها صورة: نظهر الخيار ونفعّله
    // لو ما عندها: نخفيه
    if (lastCalculated.recipe.imageUrl) {
        includeImageField.hidden = false;
        includeImageCheckbox.checked = true;
    } else {
        includeImageField.hidden = true;
        includeImageCheckbox.checked = false;
    }

    modal.hidden = false;
}

// تنفيذ التصدير الفعلي بعد تأكيد المستخدم
function executeCustomerImageExport(message, includeImage) {
    var template = document.getElementById('customer-image-template');
    if (!template) {
        alert('قالب الصورة غير موجود.');
        return;
    }

    var nameEl = template.querySelector('.customer-image-template__recipe-name');
    var priceEl = template.querySelector('.customer-image-template__price-value');
    var perEl = template.querySelector('.customer-image-template__per-serving-value');
    var servingsNoteEl = template.querySelector('.customer-image-template__servings-note');
    var msgEl = template.querySelector('.customer-image-template__message');
    var templateImgWrap = document.getElementById('customer-image-template-image');
    var templateImg = document.getElementById('customer-image-template-img');

    nameEl.textContent = lastCalculated.recipeName;
    priceEl.textContent = pricing.formatSAR(lastCalculated.sellingPrice);
    if (lastCalculated.perServing === null) {
        perEl.textContent = '—';
    } else {
        perEl.textContent = pricing.formatSAR(lastCalculated.perServing);
    }
    var servings = Number(lastCalculated.recipe.servings) || 0;
    servingsNoteEl.textContent = servings > 0 ? '(' + servings + ' حصة)' : '';
    msgEl.textContent = message;

    // === صورة الوصفة داخل القالب ===
    if (includeImage && lastCalculated.recipe.imageUrl) {
        templateImg.src = lastCalculated.recipe.imageUrl;
        templateImg.alt = lastCalculated.recipeName;
        templateImgWrap.hidden = false;
    } else {
        templateImgWrap.hidden = true;
        templateImg.src = '';
    }

    // نرسم القالب ونحوّله إلى ملف PNG ونحمّله
    // useCORS: true عشان صور Supabase الخارجية ما تسبب مشاكل
    html2canvas(template, { backgroundColor: null, scale: 2, useCORS: true, allowTaint: false }).then(function (canvas) {
        canvas.toBlob(function (blob) {
            if (!blob) {
                alert('حدث خطأ أثناء إنشاء الصورة. حاول مرة أخرى.');
                return;
            }
            var url = URL.createObjectURL(blob);
            var safeName = sanitizeFilename(lastCalculated.recipeName);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'تسعير-' + safeName + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () {
                URL.revokeObjectURL(url);
            }, 1000);
        }, 'image/png');
    }).catch(function (err) {
        console.error('html2canvas error:', err);
        // لو فشل بسبب الصورة، نحاول بدونها
        if (includeImage && lastCalculated.recipe.imageUrl) {
            console.warn('إعادة المحاولة بدون صورة الوصفة...');
            templateImgWrap.hidden = true;
            templateImg.src = '';
            html2canvas(template, { backgroundColor: null, scale: 2 }).then(function (canvas) {
                canvas.toBlob(function (blob) {
                    if (!blob) {
                        alert('حدث خطأ أثناء إنشاء الصورة.');
                        return;
                    }
                    var url = URL.createObjectURL(blob);
                    var safeName = sanitizeFilename(lastCalculated.recipeName);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'تسعير-' + safeName + '.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                }, 'image/png');
            }).catch(function () {
                alert('حدث خطأ أثناء إنشاء الصورة. حاول مرة أخرى.');
            });
        } else {
            alert('حدث خطأ أثناء إنشاء الصورة. حاول مرة أخرى.');
        }
    });
}

// تنظيف اسم الملف: نحذف الأحرف اللي قد تكسر أسماء الملفات
// ونستبدل المسافات بشرطات، عشان اسم التحميل يكون سليماً.
function sanitizeFilename(name) {
    const safe = String(name || 'وصفة')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '-')
        .trim();
    return safe || 'وصفة';
}

// === ربط الأحداث بعد تجهيز الصفحة ===
document.addEventListener('DOMContentLoaded', async function () {
    // مؤشر تحميل أثناء جلب الوصفات من Supabase
    const resultArea = document.getElementById('calculation-result');
    resultArea.hidden = false;
    resultArea.innerHTML = '<p class="loading-message">جاري التحميل...</p>';

    const count = await populateRecipeSelect();

    // نخفي رسالة التحميل بعد جلب القائمة
    resultArea.innerHTML = '';
    resultArea.hidden = true;

    // لا توجد وصفات: نعطل النموذج ونعرض رسالة
    if (count === 0) {
        const form = document.getElementById('pricing-form');
        const controls = form.querySelectorAll('select, input, button');
        controls.forEach(function (el) {
            el.disabled = true;
        });
        showInlineMessage('لا توجد وصفات محفوظة. أضف وصفة أولاً من شاشة الوصفات.');
        return;
    }

    const marginSelect = document.getElementById('margin-select');
    const customField = document.getElementById('custom-margin-field');
    const customInput = document.getElementById('custom-margin');

    // إظهار/إخفاء حقل النسبة المخصصة
    marginSelect.addEventListener('change', function () {
        if (marginSelect.value === 'custom') {
            customField.hidden = false;
        } else {
            customField.hidden = true;
            customInput.value = '';
        }
    });

    // === تنفيذ الحساب عند الضغط على زر احسب ===
    const form = document.getElementById('pricing-form');
    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        // نعرض مؤشر تحميل قصير أثناء جلب الوصفة والمكونات
        const resultEl = document.getElementById('calculation-result');
        resultEl.innerHTML = '<p class="loading-message">جاري الحساب...</p>';
        resultEl.hidden = false;

        const calc = await performCalculation();
        if (!calc) {
            // لو مؤشر التحميل ما زال معروضاً (يعني alert ظهر لا showInlineMessage)
            // نمسحه ونخفي القسم.
            if (resultEl.innerHTML.indexOf('loading-message') !== -1) {
                resultEl.innerHTML = '';
                resultEl.hidden = true;
            }
            return;
        }
        lastCalculated = calc;
        renderCalculationResult(calc);
    });

    // === أحداث منطقة النتيجة (delegated) ===
    const resultSection = document.getElementById('calculation-result');

    // زر إظهار/إخفاء التفاصيل — نتعامل معه بـ delegation
    // لأنه يُعاد بناؤه في كل حساب جديد.
    resultSection.addEventListener('click', function (event) {
        const target = event.target;
        if (target && target.id === 'export-customer-image-btn') {
            handleExportCustomerImage();
            return;
        }
        if (target && target.id === 'toggle-breakdown-btn') {
            const container = document.getElementById('breakdown-container');
            if (!container) {
                return;
            }
            breakdownVisible = !breakdownVisible;
            container.hidden = !breakdownVisible;
            target.textContent = breakdownVisible
                ? 'إخفاء التفاصيل ▴'
                : 'عرض التفاصيل ▾';
        }
    });

    resultSection.addEventListener('change', function (event) {
        const target = event.target;
        if (target.id !== 'add-to-comparison') {
            return;
        }
        if (!lastCalculated) {
            return;
        }

        if (target.checked) {
            // إضافة عنصر جديد للقائمة
            comparisonList.push({
                id: crypto.randomUUID(),
                recipeId: lastCalculated.recipeId,
                recipeName: lastCalculated.recipeName,
                margin: lastCalculated.margin,
                breakdown: lastCalculated.breakdown,
                sellingPrice: lastCalculated.sellingPrice,
                perServing: lastCalculated.perServing,
                hasDeletedIngredients: lastCalculated.hasDeletedIngredients
            });

            // رسالة تأكيد قصيرة ثم تختفي بعد ثانيتين
            const feedback = document.getElementById('comparison-feedback');
            if (feedback) {
                feedback.textContent = 'تمت الإضافة إلى المقارنة';
                feedback.classList.add('comparison-feedback--visible');
                setTimeout(function () {
                    feedback.classList.remove('comparison-feedback--visible');
                    // نفرّغ النص بعد انتهاء التلاشي
                    setTimeout(function () {
                        feedback.textContent = '';
                    }, 300);
                }, 2000);
            }
        } else {
            // عند إلغاء التحديد: نحذف آخر عنصر يطابق الوصفة + الهامش الحاليين
            for (let i = comparisonList.length - 1; i >= 0; i--) {
                if (
                    comparisonList[i].recipeId === lastCalculated.recipeId &&
                    comparisonList[i].margin === lastCalculated.margin
                ) {
                    comparisonList.splice(i, 1);
                    break;
                }
            }
        }

        renderComparisonSection();
    });

    // === أحداث قسم المقارنة (delegated) — إزالة أو مسح كل ===
    const comparisonSection = document.getElementById('comparison-section');
    comparisonSection.addEventListener('click', function (event) {
        const target = event.target;
        if (!target.matches('button[data-action]')) {
            return;
        }
        const action = target.dataset.action;

        if (action === 'remove-comparison') {
            const id = target.dataset.id;
            comparisonList = comparisonList.filter(function (item) {
                return item.id !== id;
            });
            renderComparisonSection();
            return;
        }

        if (action === 'clear-comparison') {
            const ok = confirm('هل تريد مسح كل المقارنة؟');
            if (ok) {
                comparisonList = [];
                renderComparisonSection();
            }
            return;
        }
    });

    // === أحداث نافذة تصدير صورة العميل ===
    var modal = document.getElementById('customer-image-modal');
    var modalBackdrop = modal.querySelector('.modal__backdrop');
    var cancelBtn = document.getElementById('customer-image-cancel');
    var confirmBtn = document.getElementById('customer-image-confirm');

    // إغلاق النافذة
    function closeModal() {
        modal.hidden = true;
    }

    cancelBtn.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    // إغلاق بمفتاح Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });

    // تأكيد التصدير
    confirmBtn.addEventListener('click', function () {
        var messageInput = document.getElementById('customer-message');
        var includeCheckbox = document.getElementById('include-recipe-image');

        var message = (messageInput.value || '').trim() || 'شكراً لطلبك';
        var includeImage = includeCheckbox.checked;

        closeModal();
        executeCustomerImageExport(message, includeImage);
    });
});
