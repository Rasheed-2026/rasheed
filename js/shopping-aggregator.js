/*
  ============================================
  ملف تجميع قائمة التسوق
  ============================================
  ياخذ مصفوفة الاختيارات (وصفة + كم مرة نسويها)
  ويرجع قائمة موحّدة بالمكونات مع الكميات
  الإجمالية والتكاليف، كلها بالوحدة الأساسية.

  ملف متزامن ١٠٠٪ — لا يلمس Supabase. الواجهة
  تجيب الوصفات والمكونات مسبقاً (async) ثم تمرّرها
  هنا. هذا يحافظ على فصل واضح: البيانات في طبقة
  الواجهة، والحساب هنا.
  ============================================
*/

(function () {
    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    function baseUnitLabelFor(unitType) {
        if (unitType === 'weight') return 'جرام';
        if (unitType === 'volume') return 'مليلتر';
        if (unitType === 'piece') return 'حبة';
        return '';
    }

    // aggregateShoppingList(selections, allRecipes, allIngredients)
    //   - selections: [{ recipeId, quantity }]
    //   - allRecipes: مصفوفة كل وصفات المستخدم (محمّلة مسبقاً)
    //   - allIngredients: مصفوفة كل المكونات (محمّلة مسبقاً)
    function aggregateShoppingList(selections, allRecipes, allIngredients) {
        const warnings = [];
        const totalsByIngredient = new Map();
        const recipes = allRecipes || [];
        const ingredients = allIngredients || [];

        // دوال بحث محلية بدل استدعاءات async
        function findRecipe(id) {
            return recipes.find(function (r) { return r.id === id; });
        }
        function findIngredient(id) {
            return ingredients.find(function (i) { return i.id === id; });
        }

        (selections || []).forEach(function (sel) {
            const recipe = findRecipe(sel.recipeId);
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
            const ingredient = findIngredient(acc.ingredientId);
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
