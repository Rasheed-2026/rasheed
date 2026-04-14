/*
  ============================================
  ملف تجميع قائمة التسوق
  ============================================
  ياخذ مصفوفة الاختيارات (وصفة + كم مرة نسويها)
  ويرجع قائمة موحّدة بالمكونات مع الكميات
  الإجمالية والتكاليف، كلها بالوحدة الأساسية
  (جرام / مليلتر / حبة) بدون أي تحويل لـ كيلو/لتر.
  ============================================
*/

(function () {
    // تقرّب الرقم إلى منزلتين عشريتين بأمان
    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    // ترجع عنوان الوحدة الأساسية للعرض حسب نوع المكون
    function baseUnitLabelFor(unitType) {
        if (unitType === 'weight') return 'جرام';
        if (unitType === 'volume') return 'مليلتر';
        if (unitType === 'piece') return 'حبة';
        return '';
    }

    // الدالة الرئيسية: تاخذ selections وتجمع كل شي.
    // الخطوات:
    //   1) نمر على كل اختيار ونجيب الوصفة.
    //   2) لو الوصفة محذوفة، نتخطاها ونضيف تحذير.
    //   3) نضرب كمية كل مكون × عدد مرات الوصفة.
    //   4) نجمع على ingredientId في Map.
    //   5) نحوّل الـMap إلى قائمة بها اسم المكون والتكلفة.
    //   6) لو مكون محذوف، نحط علامة isDeleted=true ونجعل cost=0.
    function aggregateShoppingList(selections) {
        const warnings = [];
        const totalsByIngredient = new Map();

        (selections || []).forEach(function (sel) {
            const recipe = window.tasceerRecipes.getRecipeById(sel.recipeId);
            if (!recipe) {
                warnings.push('وصفة محذوفة — تم تخطيها');
                return;
            }

            const recipeQty = Number(sel.quantity) || 0;
            const entries = recipe.ingredients || [];
            entries.forEach(function (entry) {
                const addQty = Number(entry.quantity) * recipeQty;
                const existing = totalsByIngredient.get(entry.ingredientId);
                if (existing) {
                    existing.totalQuantity += addQty;
                } else {
                    totalsByIngredient.set(entry.ingredientId, {
                        ingredientId: entry.ingredientId,
                        totalQuantity: addQty
                    });
                }
            });
        });

        const items = [];
        let totalCost = 0;

        totalsByIngredient.forEach(function (acc) {
            const ingredient = window.tasceerIngredients.getIngredientById(acc.ingredientId);
            if (!ingredient) {
                warnings.push('مكون محذوف داخل إحدى الوصفات');
                items.push({
                    ingredientId: acc.ingredientId,
                    name: '(مكون محذوف)',
                    totalQuantity: round2(acc.totalQuantity),
                    unitType: 'weight',
                    baseUnitLabel: 'جرام',
                    cost: 0,
                    isDeleted: true
                });
                return;
            }

            // التكلفة = (سعر العبوة / وزن العبوة) × الكمية الإجمالية
            const pricePerBaseUnit = ingredient.packagePrice / ingredient.packageWeightInGrams;
            const rawCost = pricePerBaseUnit * acc.totalQuantity;
            const cost = round2(rawCost);
            totalCost += rawCost;

            items.push({
                ingredientId: acc.ingredientId,
                name: ingredient.name,
                totalQuantity: round2(acc.totalQuantity),
                unitType: ingredient.unitType,
                baseUnitLabel: baseUnitLabelFor(ingredient.unitType),
                cost: cost,
                isDeleted: false
            });
        });

        return {
            items: items,
            totalCost: round2(totalCost),
            warnings: warnings
        };
    }

    window.tasceerShoppingAggregator = {
        aggregateShoppingList: aggregateShoppingList
    };
})();
