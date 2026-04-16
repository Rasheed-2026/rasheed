/*
  ============================================
  ملف واجهة صفحة الطلبات
  ============================================
  يربط بين طبقات البيانات (customers.js, orders.js,
  recipes.js, ingredients.js, pricing.js) وبين
  شاشة orders.html.
  ============================================
*/

(function () {
    // ===== الحالة الجارية =====
    // عناصر الطلب الحالي قيد الإنشاء
    var currentOrderItems = []; // { recipeId, recipeName, quantity, unitPrice, subtotal }
    var allRecipes = [];        // كاش الوصفات
    var allCustomers = [];      // كاش العملاء
    var allIngredients = [];    // كاش المكونات
    var editingOrderId = null;  // لو نعدل طلب موجود

    // ===== تسميات الحالات بالعربي =====
    var STATUS_LABELS = {
        'new': '🔵 جديد',
        'preparing': '🟡 قيد التحضير',
        'ready': '🟢 جاهز',
        'delivered': '✅ تم التسليم'
    };

    // ===== الحالة التالية في مسار الطلب =====
    var NEXT_STATUS = {
        'new': 'preparing',
        'preparing': 'ready',
        'ready': 'delivered'
    };

    // ===== أسماء أزرار الانتقال للحالة التالية =====
    var NEXT_STATUS_LABEL = {
        'new': 'بدأت التحضير',
        'preparing': 'جاهز',
        'ready': 'تم التسليم'
    };

    // ===== مراجع عناصر الصفحة =====
    var customerSelect, addNewCustomerBtn, newCustomerForm;
    var customerNameInput, customerPhoneInput, customerNotesInput;
    var saveNewCustomerBtn, cancelNewCustomerBtn;
    var deliveryDateInput, deliveryMethodSelect;
    var recipeSelect, quantityInput, priceInput, addOrderItemBtn;
    var orderItemsList, orderTotalEl, orderTotalAmount;
    var orderNotesInput, saveOrderBtn;
    var orderFilterBtns, ordersList;
    var generateShoppingBtn;

    // ===== الفلتر الحالي =====
    var currentFilter = 'active';

    document.addEventListener('DOMContentLoaded', async function () {
        // جلب مراجع العناصر
        customerSelect = document.getElementById('customer-select');
        addNewCustomerBtn = document.getElementById('add-new-customer-btn');
        newCustomerForm = document.getElementById('new-customer-form');
        customerNameInput = document.getElementById('customer-name');
        customerPhoneInput = document.getElementById('customer-phone');
        customerNotesInput = document.getElementById('customer-notes');
        saveNewCustomerBtn = document.getElementById('save-new-customer-btn');
        cancelNewCustomerBtn = document.getElementById('cancel-new-customer-btn');
        deliveryDateInput = document.getElementById('delivery-date');
        deliveryMethodSelect = document.getElementById('delivery-method');
        recipeSelect = document.getElementById('order-recipe-select');
        quantityInput = document.getElementById('order-recipe-quantity');
        priceInput = document.getElementById('order-recipe-price');
        addOrderItemBtn = document.getElementById('add-order-item-btn');
        orderItemsList = document.getElementById('order-items-list');
        orderTotalEl = document.getElementById('order-total');
        orderTotalAmount = document.getElementById('order-total-amount');
        orderNotesInput = document.getElementById('order-notes');
        saveOrderBtn = document.getElementById('save-order-btn');
        orderFilterBtns = document.querySelectorAll('.order-filter');
        ordersList = document.getElementById('orders-list');
        generateShoppingBtn = document.getElementById('generate-shopping-from-orders');

        // مؤشر تحميل
        ordersList.innerHTML = '<p class="loading-message">جاري التحميل...</p>';

        // تحميل البيانات بالتوازي
        var results = await Promise.all([
            window.tasceerCustomers.getAllCustomers(),
            window.tasceerRecipes.getAllRecipes(),
            window.tasceerIngredients.getAllIngredients()
        ]);

        allCustomers = results[0];
        allRecipes = results[1];
        allIngredients = results[2];

        // تعبئة القوائم المنسدلة
        populateCustomerSelect();
        populateRecipeSelect();

        // تعيين تاريخ التسليم الافتراضي = بكرة
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        deliveryDateInput.value = formatDateForInput(tomorrow);

        // تحميل الطلبات
        await loadAndRenderOrders();

        // ربط الأحداث
        wireEvents();
    });

    // ===== تعبئة قائمة العملاء =====
    function populateCustomerSelect() {
        // نحافظ على الخيار الأول
        customerSelect.innerHTML = '<option value="">اختر عميل</option>';
        allCustomers.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name + ' — ' + c.phone;
            customerSelect.appendChild(opt);
        });
    }

    // ===== تعبئة قائمة الوصفات =====
    // نعرض فقط الوصفات اللي فيها مكونات (عشان نقدر نحسب السعر)
    function populateRecipeSelect() {
        recipeSelect.innerHTML = '<option value="">اختر وصفة</option>';
        allRecipes.forEach(function (r) {
            // نتحقق إن الوصفة فيها مكونات
            if (r.ingredients && r.ingredients.length > 0) {
                var opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.name;
                recipeSelect.appendChild(opt);
            }
        });
    }

    // ===== حساب السعر المقترح لوصفة (تكلفة + 30% ربح) =====
    function calculateSuggestedPrice(recipe) {
        if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) return 0;
        var costResult = window.tasceerPricing.calculateTotalCost(recipe, allIngredients);
        // سعر مقترح = التكلفة + 30% ربح
        var suggested = costResult.total * 1.3;
        return Math.round(suggested * 100) / 100;
    }

    // ===== تنسيق تاريخ لحقل input[type=date] =====
    function formatDateForInput(date) {
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    // ===== تنسيق تاريخ للعرض بالعربي =====
    function formatDateArabic(dateStr) {
        if (!dateStr) return '';
        try {
            var date = new Date(dateStr + 'T00:00:00');
            return date.toLocaleDateString('ar-SA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    }

    // ===== ربط كل الأحداث =====
    function wireEvents() {
        // زر إضافة عميل جديد
        addNewCustomerBtn.addEventListener('click', function () {
            newCustomerForm.hidden = false;
            customerNameInput.focus();
        });

        // حفظ عميل جديد
        saveNewCustomerBtn.addEventListener('click', handleSaveNewCustomer);

        // إلغاء إضافة عميل
        cancelNewCustomerBtn.addEventListener('click', function () {
            newCustomerForm.hidden = true;
            customerNameInput.value = '';
            customerPhoneInput.value = '';
            customerNotesInput.value = '';
        });

        // عند اختيار وصفة — نحسب السعر المقترح
        recipeSelect.addEventListener('change', function () {
            var recipeId = recipeSelect.value;
            if (!recipeId) {
                priceInput.value = '';
                return;
            }
            var recipe = allRecipes.find(function (r) { return r.id === recipeId; });
            if (recipe) {
                var suggested = calculateSuggestedPrice(recipe);
                priceInput.value = suggested > 0 ? suggested : '';
            }
        });

        // إضافة عنصر للطلب
        addOrderItemBtn.addEventListener('click', handleAddOrderItem);

        // حذف عنصر من الطلب (تفويض الحدث)
        orderItemsList.addEventListener('click', function (e) {
            var removeBtn = e.target.closest('[data-action="remove-item"]');
            if (removeBtn) {
                var index = Number(removeBtn.dataset.index);
                currentOrderItems.splice(index, 1);
                renderOrderItems();
            }
        });

        // حفظ الطلب
        saveOrderBtn.addEventListener('click', handleSaveOrder);

        // أزرار الفلترة
        orderFilterBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                // تحديث الزر النشط
                orderFilterBtns.forEach(function (b) { b.classList.remove('order-filter--active'); });
                btn.classList.add('order-filter--active');
                currentFilter = btn.dataset.status;
                loadAndRenderOrders();
            });
        });

        // أحداث قائمة الطلبات (تفويض الحدث)
        ordersList.addEventListener('click', handleOrdersListClick);

        // إنشاء قائمة تسوق من الطلبات
        if (generateShoppingBtn) {
            generateShoppingBtn.addEventListener('click', handleGenerateShopping);
        }
    }

    // ===== حفظ عميل جديد =====
    async function handleSaveNewCustomer() {
        var name = customerNameInput.value.trim();
        var phone = customerPhoneInput.value.trim();
        var notes = customerNotesInput.value.trim();

        if (!name) {
            alert('اكتب اسم العميل');
            customerNameInput.focus();
            return;
        }
        if (!phone) {
            alert('اكتب رقم الجوال');
            customerPhoneInput.focus();
            return;
        }

        saveNewCustomerBtn.disabled = true;
        saveNewCustomerBtn.textContent = 'جاري الحفظ...';

        try {
            var newCustomer = await window.tasceerCustomers.addCustomer(name, phone, notes);
            allCustomers.push(newCustomer);
            // ترتيب أبجدي
            allCustomers.sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); });
            populateCustomerSelect();

            // اختيار العميل الجديد تلقائياً
            customerSelect.value = newCustomer.id;

            // مسح وإخفاء النموذج
            customerNameInput.value = '';
            customerPhoneInput.value = '';
            customerNotesInput.value = '';
            newCustomerForm.hidden = true;
        } catch (err) {
            alert(err.message);
        } finally {
            saveNewCustomerBtn.disabled = false;
            saveNewCustomerBtn.textContent = 'حفظ العميل';
        }
    }

    // ===== إضافة وصفة للطلب =====
    function handleAddOrderItem() {
        var recipeId = recipeSelect.value;
        var quantity = Number(quantityInput.value);
        var unitPrice = Number(priceInput.value);

        if (!recipeId) {
            alert('اختر وصفة');
            return;
        }
        if (!quantity || quantity < 1) {
            alert('أدخل كمية صحيحة');
            return;
        }
        if (!unitPrice || unitPrice <= 0) {
            alert('أدخل سعر صحيح');
            return;
        }

        var recipe = allRecipes.find(function (r) { return r.id === recipeId; });
        if (!recipe) return;

        // نتحقق لو الوصفة مضافة مسبقاً — نزيد الكمية
        var existing = currentOrderItems.find(function (item) { return item.recipeId === recipeId; });
        if (existing) {
            existing.quantity += quantity;
            existing.unitPrice = unitPrice; // نحدّث السعر بالأخير
            existing.subtotal = Math.round(existing.quantity * existing.unitPrice * 100) / 100;
        } else {
            currentOrderItems.push({
                recipeId: recipeId,
                recipeName: recipe.name,
                quantity: quantity,
                unitPrice: unitPrice,
                subtotal: Math.round(quantity * unitPrice * 100) / 100
            });
        }

        // إعادة تعيين حقول الإدخال
        recipeSelect.value = '';
        quantityInput.value = '1';
        priceInput.value = '';

        renderOrderItems();
    }

    // ===== رسم عناصر الطلب في النموذج =====
    function renderOrderItems() {
        orderItemsList.innerHTML = '';

        if (currentOrderItems.length === 0) {
            orderTotalEl.hidden = true;
            return;
        }

        var total = 0;
        currentOrderItems.forEach(function (item, index) {
            total += item.subtotal;

            var row = document.createElement('div');
            row.className = 'order-item-row';
            row.innerHTML =
                '<span class="order-item-row__info">' +
                    item.recipeName + ' × ' + item.quantity +
                    ' — <strong>' + item.subtotal.toFixed(2) + ' ريال</strong>' +
                    ' <span class="order-item-row__unit-price">(' + item.unitPrice.toFixed(2) + ' للوحدة)</span>' +
                '</span>' +
                '<button class="btn btn--danger btn--small" data-action="remove-item" data-index="' + index + '">حذف</button>';
            orderItemsList.appendChild(row);
        });

        total = Math.round(total * 100) / 100;
        orderTotalAmount.textContent = total.toFixed(2);
        orderTotalEl.hidden = false;
    }

    // ===== حفظ الطلب =====
    async function handleSaveOrder() {
        var customerId = customerSelect.value;
        var deliveryDate = deliveryDateInput.value;
        var deliveryMethod = deliveryMethodSelect.value;
        var notes = orderNotesInput.value.trim();

        // تحقق من المدخلات
        if (!customerId) {
            alert('اختر عميل');
            return;
        }
        if (currentOrderItems.length === 0) {
            alert('أضف وصفة واحدة على الأقل');
            return;
        }
        if (!deliveryDate) {
            alert('حدد تاريخ التسليم');
            return;
        }

        saveOrderBtn.disabled = true;
        saveOrderBtn.textContent = 'جاري الحفظ...';

        try {
            if (editingOrderId) {
                // تعديل طلب موجود
                await window.tasceerOrders.updateOrder(
                    editingOrderId, customerId, deliveryMethod, deliveryDate, notes, currentOrderItems
                );
                editingOrderId = null;
            } else {
                // طلب جديد
                await window.tasceerOrders.addOrder(
                    customerId, deliveryMethod, deliveryDate, notes, currentOrderItems
                );
            }

            // مسح النموذج
            clearOrderForm();

            // إعادة تحميل الطلبات
            await loadAndRenderOrders();
        } catch (err) {
            alert(err.message);
        } finally {
            saveOrderBtn.disabled = false;
            saveOrderBtn.textContent = 'حفظ الطلب';
        }
    }

    // ===== مسح نموذج الطلب =====
    function clearOrderForm() {
        customerSelect.value = '';
        currentOrderItems = [];
        orderItemsList.innerHTML = '';
        orderTotalEl.hidden = true;
        orderNotesInput.value = '';
        recipeSelect.value = '';
        quantityInput.value = '1';
        priceInput.value = '';
        editingOrderId = null;

        // إعادة تعيين التاريخ لبكرة
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        deliveryDateInput.value = formatDateForInput(tomorrow);

        saveOrderBtn.textContent = 'حفظ الطلب';
    }

    // ===== تحميل وعرض الطلبات =====
    async function loadAndRenderOrders() {
        ordersList.innerHTML = '<p class="loading-message">جاري التحميل...</p>';

        var orders = await window.tasceerOrders.getAllOrders(currentFilter);
        renderOrders(orders);
    }

    // ===== رسم بطاقات الطلبات =====
    function renderOrders(orders) {
        ordersList.innerHTML = '';

        if (orders.length === 0) {
            ordersList.innerHTML = '<p class="empty-state">لا توجد طلبات' +
                (currentFilter === 'active' ? ' حالية' : '') + '</p>';
            return;
        }

        orders.forEach(function (order) {
            var card = document.createElement('div');
            card.className = 'order-card order-card--' + order.status;
            card.dataset.orderId = order.id;

            // بناء HTML العناصر
            var itemsHtml = order.items.map(function (item) {
                return item.recipeName + ' × ' + item.quantity +
                    ' — ' + item.subtotal.toFixed(2) + ' ريال';
            }).join('<br>');

            // أيقونة طريقة التسليم
            var deliveryIcon = order.deliveryMethod === 'delivery' ? '🚗 توصيل' : '🏠 استلام';

            // زر الحالة التالية
            var nextStatusHtml = '';
            if (NEXT_STATUS[order.status]) {
                nextStatusHtml =
                    '<button class="btn btn--primary btn--small" data-action="change-status" data-id="' +
                    order.id + '" data-status="' + NEXT_STATUS[order.status] + '">' +
                    NEXT_STATUS_LABEL[order.status] + '</button>';
            }

            // ملاحظات لو موجودة
            var notesHtml = order.notes
                ? '<div class="order-card__notes">📝 ' + escapeHtml(order.notes) + '</div>'
                : '';

            card.innerHTML =
                '<div class="order-card__header">' +
                    '<div class="order-card__customer">' +
                        '<strong>' + escapeHtml(order.customerName) + '</strong>' +
                        '<span class="order-card__delivery-method">' + deliveryIcon + '</span>' +
                    '</div>' +
                    '<div class="order-card__date">' + formatDateArabic(order.deliveryDate) + '</div>' +
                '</div>' +
                '<div class="order-card__items">' + itemsHtml + '</div>' +
                '<div class="order-card__total">الإجمالي: ' + order.totalPrice.toFixed(2) + ' ريال</div>' +
                notesHtml +
                '<div class="order-card__status">' +
                    '<span class="status-badge status-badge--' + order.status + '">' +
                    STATUS_LABELS[order.status] + '</span>' +
                '</div>' +
                '<div class="order-card__actions">' +
                    nextStatusHtml +
                    '<button class="btn btn--danger btn--small" data-action="delete-order" data-id="' +
                    order.id + '">حذف</button>' +
                '</div>';

            ordersList.appendChild(card);
        });
    }

    // ===== التعامل مع أحداث قائمة الطلبات =====
    async function handleOrdersListClick(e) {
        // تغيير الحالة
        var statusBtn = e.target.closest('[data-action="change-status"]');
        if (statusBtn) {
            var orderId = statusBtn.dataset.id;
            var newStatus = statusBtn.dataset.status;
            statusBtn.disabled = true;
            statusBtn.textContent = 'جاري التحديث...';
            try {
                await window.tasceerOrders.updateOrderStatus(orderId, newStatus);
                await loadAndRenderOrders();
            } catch (err) {
                alert(err.message);
                statusBtn.disabled = false;
            }
            return;
        }

        // حذف طلب
        var deleteBtn = e.target.closest('[data-action="delete-order"]');
        if (deleteBtn) {
            var id = deleteBtn.dataset.id;
            if (!confirm('هل تريد حذف هذا الطلب؟')) return;
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'جاري الحذف...';
            try {
                await window.tasceerOrders.deleteOrder(id);
                await loadAndRenderOrders();
            } catch (err) {
                alert(err.message);
                deleteBtn.disabled = false;
            }
        }
    }

    // ===== إنشاء قائمة تسوق من الطلبات الحالية =====
    async function handleGenerateShopping() {
        generateShoppingBtn.disabled = true;
        generateShoppingBtn.textContent = 'جاري التحميل...';

        try {
            var activeOrders = await window.tasceerOrders.getActiveOrders();
            if (activeOrders.length === 0) {
                alert('لا توجد طلبات حالية لإنشاء قائمة تسوق منها');
                return;
            }

            // تجميع الوصفات والكميات من كل الطلبات
            var recipeMap = {};
            activeOrders.forEach(function (order) {
                order.items.forEach(function (item) {
                    if (item.recipeId) {
                        if (recipeMap[item.recipeId]) {
                            recipeMap[item.recipeId].quantity += item.quantity;
                        } else {
                            recipeMap[item.recipeId] = {
                                recipeId: item.recipeId,
                                quantity: item.quantity
                            };
                        }
                    }
                });
            });

            // تحويل لمصفوفة بنفس شكل currentSelections في صفحة التسوق
            var selections = [];
            Object.keys(recipeMap).forEach(function (key) {
                selections.push(recipeMap[key]);
            });

            if (selections.length === 0) {
                alert('لا توجد وصفات صالحة في الطلبات الحالية');
                return;
            }

            // حفظ في localStorage ونفتح صفحة التسوق
            localStorage.setItem('tasceer_orders_to_shopping', JSON.stringify(selections));
            window.location.href = 'shopping.html';
        } catch (err) {
            alert('حصل خطأ: ' + err.message);
        } finally {
            generateShoppingBtn.disabled = false;
            generateShoppingBtn.textContent = '🛒 أنشئ قائمة تسوق من الطلبات الحالية';
        }
    }

    // ===== مساعد: حماية النص من HTML =====
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

})();
