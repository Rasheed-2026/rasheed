/*
  ============================================
  ملف واجهة صفحة قائمة التسوق
  ============================================
  يربط بين طبقات البيانات وبين شاشة
  shopping.html: يعرض الوصفات المختارة،
  يحسب قائمة التسوق المجمّعة، وينسخ/يحفظ
  القوائم.

  الحالة (currentSelections) تبقى في الذاكرة
  فقط — لا نحفظها في localStorage. فقط القوائم
  اللي يحفظها المستخدم صراحة تُخزّن.
  ============================================
*/

(function () {
    // الحالة الجارية: مصفوفة من { recipeId, quantity }
    let currentSelections = [];

    // بيانات محمّلة من Supabase ومُحتفظ بها في الذاكرة لتجنب إعادة
    // الجلب مع كل عملية رسم. نحدّثها يدوياً بعد كل عملية حفظ.
    let cachedRecipes = [];
    let cachedIngredients = [];

    // مراجع لعناصر الصفحة — نملأها عند DOMContentLoaded
    let recipeSelect;
    let quantityInput;
    let addRecipeBtn;
    let selectedSection;
    let selectedList;
    let clearBtn;
    let resultSection;
    let itemsList;
    let warningsBox;
    let totalBox;
    let copyBtn;
    let saveBtn;
    let feedbackEl;
    let savedSection;
    let savedContainer;
    let addRecipeSection;
    let noRecipesMessage;

    document.addEventListener('DOMContentLoaded', async function () {
        // نجيب كل العناصر مرة وحدة
        recipeSelect = document.getElementById('recipe-select');
        quantityInput = document.getElementById('recipe-quantity');
        addRecipeBtn = document.getElementById('add-recipe-btn');
        selectedSection = document.getElementById('selected-recipes-section');
        selectedList = document.getElementById('selected-recipes-list');
        clearBtn = document.getElementById('clear-selections-btn');
        resultSection = document.getElementById('shopping-result-section');
        itemsList = document.getElementById('shopping-items-list');
        warningsBox = document.getElementById('shopping-warnings');
        totalBox = document.getElementById('shopping-total');
        copyBtn = document.getElementById('copy-list-btn');
        saveBtn = document.getElementById('save-list-btn');
        feedbackEl = document.getElementById('shopping-feedback');
        savedSection = document.getElementById('saved-lists-section');
        savedContainer = document.getElementById('saved-lists-container');
        addRecipeSection = document.getElementById('add-recipe-section');
        noRecipesMessage = document.getElementById('no-recipes-message');

        // مؤشر تحميل بسيط في قسم الوصفات المختارة ريثما تصل البيانات
        selectedList.innerHTML = '<p class="loading-message">جاري التحميل...</p>';
        selectedSection.hidden = false;

        // نجيب الوصفات والمكونات والقوائم المحفوظة بالتوازي
        const [recipes, ingredients] = await Promise.all([
            window.tasceerRecipes.getAllRecipes(),
            window.tasceerIngredients.getAllIngredients()
        ]);
        cachedRecipes = recipes;
        cachedIngredients = ingredients;

        // نخفي مؤشر التحميل
        selectedList.innerHTML = '';
        selectedSection.hidden = true;

        // حالة فاضية: لا وصفات إطلاقاً
        if (recipes.length === 0) {
            addRecipeSection.hidden = true;
            noRecipesMessage.hidden = false;
            // مع ذلك نعرض القوائم المحفوظة لو وجدت
            await renderSavedLists();
            return;
        }

        populateRecipeSelect(recipes);
        wireEvents();
        await renderSavedLists();
    });

    // تعبئة القائمة المنسدلة بكل الوصفات
    function populateRecipeSelect(recipes) {
        // نحافظ على الخيار الأول (اختر وصفة) ونضيف البقية
        recipes.forEach(function (r) {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name;
            recipeSelect.appendChild(opt);
        });
    }

    // ربط كل الأحداث مرة وحدة
    function wireEvents() {
        addRecipeBtn.addEventListener('click', handleAddRecipe);
        clearBtn.addEventListener('click', handleClearSelections);
        selectedList.addEventListener('click', handleSelectedListClick);
        copyBtn.addEventListener('click', handleCopyList);
        saveBtn.addEventListener('click', handleSaveList);
        savedContainer.addEventListener('click', handleSavedListsClick);
    }

    // === المعالجات ===

    // إضافة وصفة للقائمة الحالية (أو زيادة كميتها لو موجودة)
    function handleAddRecipe() {
        const recipeId = recipeSelect.value;
        if (!recipeId) {
            alert('اختر وصفة أولاً');
            return;
        }
        const qty = Number(quantityInput.value);
        if (!(qty >= 1)) {
            alert('الكمية لازم تكون رقم ١ أو أكثر');
            return;
        }

        const existing = currentSelections.find(function (s) {
            return s.recipeId === recipeId;
        });
        if (existing) {
            existing.quantity += qty;
        } else {
            currentSelections.push({ recipeId: recipeId, quantity: qty });
        }

        // إعادة ضبط الحقول
        recipeSelect.value = '';
        quantityInput.value = '1';

        renderSelectedRecipes();
        renderShoppingResult();
    }

    // مسح كل الوصفات المختارة
    function handleClearSelections() {
        if (currentSelections.length === 0) {
            return;
        }
        const ok = confirm('هل تريد مسح كل الوصفات المختارة؟');
        if (!ok) return;
        currentSelections = [];
        renderSelectedRecipes();
        renderShoppingResult();
    }

    // حذف وصفة واحدة من القائمة عبر تفويض النقر
    function handleSelectedListClick(e) {
        const btn = e.target.closest('[data-action="remove-selection"]');
        if (!btn) return;
        const recipeId = btn.getAttribute('data-recipe-id');
        currentSelections = currentSelections.filter(function (s) {
            return s.recipeId !== recipeId;
        });
        renderSelectedRecipes();
        renderShoppingResult();
    }

    // نسخ قائمة التسوق كنص إلى الحافظة
    function handleCopyList() {
        if (currentSelections.length === 0) {
            alert('لا توجد قائمة لنسخها');
            return;
        }
        const result = window.tasceerShoppingAggregator.aggregateShoppingList(
            currentSelections, cachedRecipes, cachedIngredients
        );
        const lines = ['قائمة التسوق:'];
        result.items.forEach(function (item) {
            const qtyText = item.totalQuantity + ' ' + item.baseUnitLabel;
            if (item.isDeleted) {
                lines.push('- (مكون محذوف): ' + qtyText);
            } else {
                lines.push('- ' + item.name + ': ' + qtyText + ' — ' + item.cost.toFixed(2) + ' ريال');
            }
        });
        lines.push('الإجمالي: ' + result.totalCost.toFixed(2) + ' ريال');
        const text = lines.join('\n');

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                showFeedback('تم النسخ');
            }).catch(function () {
                alert('تعذر النسخ. النص:\n\n' + text);
            });
        } else {
            alert('النسخ غير مدعوم. النص:\n\n' + text);
        }
    }

    // حفظ القائمة الحالية باسم
    async function handleSaveList() {
        if (currentSelections.length === 0) {
            alert('لا توجد وصفات لحفظها');
            return;
        }
        const name = prompt('اسم القائمة:');
        if (name === null) return;
        if (!name.trim()) {
            alert('اسم القائمة مطلوب');
            return;
        }
        try {
            await window.tasceerShoppingLists.saveList(name, currentSelections);
            await renderSavedLists();
            showFeedback('تم حفظ القائمة');
        } catch (err) {
            alert(err.message || 'تعذر الحفظ');
        }
    }

    // التعامل مع أزرار الاستعادة والحذف داخل بطاقات القوائم المحفوظة
    async function handleSavedListsClick(e) {
        const loadBtn = e.target.closest('[data-action="load-saved"]');
        const delBtn = e.target.closest('[data-action="delete-saved"]');

        if (loadBtn) {
            const id = loadBtn.getAttribute('data-list-id');
            const ok = confirm('هل تريد استعادة هذه القائمة؟ سيتم استبدال الوصفات المختارة الحالية.');
            if (!ok) return;
            const saved = await window.tasceerShoppingLists.getSavedListById(id);
            if (!saved) return;
            currentSelections = (saved.selections || []).map(function (s) {
                return { recipeId: s.recipeId, quantity: Number(s.quantity) };
            });
            renderSelectedRecipes();
            renderShoppingResult();
            return;
        }

        if (delBtn) {
            const id = delBtn.getAttribute('data-list-id');
            const ok = confirm('هل تريد حذف هذه القائمة؟');
            if (!ok) return;
            try {
                await window.tasceerShoppingLists.deleteSavedList(id);
                await renderSavedLists();
            } catch (err) {
                alert(err.message || 'تعذر حذف القائمة.');
            }
        }
    }

    // === الرسم ===

    // يعرض الوصفات المختارة حالياً. يخفي القسم لو فاضي.
    function renderSelectedRecipes() {
        if (currentSelections.length === 0) {
            selectedSection.hidden = true;
            selectedList.innerHTML = '';
            return;
        }
        selectedSection.hidden = false;
        selectedList.innerHTML = '';

        currentSelections.forEach(function (sel) {
            // نقرأ من الكاش المحمّلة في بداية الصفحة بدلاً من استدعاء async
            const recipe = cachedRecipes.find(function (r) { return r.id === sel.recipeId; });
            const row = document.createElement('div');
            row.className = 'shopping-selected-row';

            const info = document.createElement('div');
            info.className = 'shopping-selected-row__info';
            const name = recipe ? recipe.name : '(وصفة محذوفة)';
            info.textContent = name + ' × ' + sel.quantity;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-small';
            removeBtn.textContent = 'إزالة';
            removeBtn.setAttribute('data-action', 'remove-selection');
            removeBtn.setAttribute('data-recipe-id', sel.recipeId);

            row.appendChild(info);
            row.appendChild(removeBtn);
            selectedList.appendChild(row);
        });
    }

    // يعرض قائمة التسوق المجمّعة. يخفي القسم لو الاختيار فاضي.
    function renderShoppingResult() {
        if (currentSelections.length === 0) {
            resultSection.hidden = true;
            itemsList.innerHTML = '';
            warningsBox.innerHTML = '';
            totalBox.textContent = '';
            return;
        }
        resultSection.hidden = false;

        const result = window.tasceerShoppingAggregator.aggregateShoppingList(
            currentSelections, cachedRecipes, cachedIngredients
        );

        // التحذيرات (تكرارات نشيلها)
        warningsBox.innerHTML = '';
        const uniqueWarnings = Array.from(new Set(result.warnings));
        uniqueWarnings.forEach(function (w) {
            const note = document.createElement('div');
            note.className = 'warning-note';
            note.textContent = w;
            warningsBox.appendChild(note);
        });

        // قائمة المكونات
        itemsList.innerHTML = '';
        if (result.items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'لا توجد مكونات في الوصفات المختارة.';
            itemsList.appendChild(empty);
        } else {
            result.items.forEach(function (item) {
                const row = document.createElement('div');
                row.className = 'shopping-item-row';
                if (item.isDeleted) {
                    row.classList.add('shopping-item-row--deleted');
                }

                const nameEl = document.createElement('div');
                nameEl.className = 'shopping-item-row__name';
                nameEl.textContent = item.name;

                const metaEl = document.createElement('div');
                metaEl.className = 'shopping-item-row__meta';

                const qtyEl = document.createElement('span');
                qtyEl.className = 'shopping-item-row__qty';
                qtyEl.textContent = item.totalQuantity + ' ' + item.baseUnitLabel;

                const costEl = document.createElement('span');
                costEl.className = 'shopping-item-row__cost';
                costEl.textContent = item.isDeleted ? '—' : (item.cost.toFixed(2) + ' ريال');

                metaEl.appendChild(qtyEl);
                metaEl.appendChild(costEl);

                row.appendChild(nameEl);
                row.appendChild(metaEl);
                itemsList.appendChild(row);
            });
        }

        // الإجمالي
        totalBox.textContent = 'إجمالي تكلفة التسوق: ' + result.totalCost.toFixed(2) + ' ريال';
    }

    // يعرض بطاقات القوائم المحفوظة. يخفي القسم لو فاضي.
    async function renderSavedLists() {
        const lists = await window.tasceerShoppingLists.getAllSavedLists();
        if (lists.length === 0) {
            savedSection.hidden = true;
            savedContainer.innerHTML = '';
            return;
        }
        savedSection.hidden = false;
        savedContainer.innerHTML = '';

        lists.forEach(function (list) {
            const card = document.createElement('div');
            card.className = 'saved-list-card';

            const info = document.createElement('div');
            info.className = 'saved-list-card__info';

            const nameEl = document.createElement('div');
            nameEl.className = 'saved-list-card__name';
            nameEl.textContent = list.name;

            const meta = document.createElement('div');
            meta.className = 'saved-list-card__meta';
            const dateStr = formatDate(list.createdAt);
            const count = (list.selections || []).length;
            meta.textContent = dateStr + ' • ' + count + ' وصفة';

            info.appendChild(nameEl);
            info.appendChild(meta);

            const actions = document.createElement('div');
            actions.className = 'saved-list-card__actions';

            const loadBtn = document.createElement('button');
            loadBtn.type = 'button';
            loadBtn.className = 'btn btn-small';
            loadBtn.textContent = 'استعادة';
            loadBtn.setAttribute('data-action', 'load-saved');
            loadBtn.setAttribute('data-list-id', list.id);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-danger';
            delBtn.textContent = 'حذف';
            delBtn.setAttribute('data-action', 'delete-saved');
            delBtn.setAttribute('data-list-id', list.id);

            actions.appendChild(loadBtn);
            actions.appendChild(delBtn);

            card.appendChild(info);
            card.appendChild(actions);
            savedContainer.appendChild(card);
        });
    }

    // تنسيق التاريخ بصيغة YYYY-MM-DD (بسيطة ومفهومة)
    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    // رسالة قصيرة تختفي بعد ثانيتين
    let feedbackTimer = null;
    function showFeedback(msg) {
        feedbackEl.textContent = msg;
        feedbackEl.classList.add('shopping-feedback--visible');
        if (feedbackTimer) clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(function () {
            feedbackEl.classList.remove('shopping-feedback--visible');
            feedbackEl.textContent = '';
        }, 2000);
    }
})();
