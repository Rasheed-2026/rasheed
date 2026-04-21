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

    // ===== متغيرات حالة الفاتورة =====
    // نخزّن الطلب والبروفايل والجوال بين فتح النافذة والتصدير
    var currentInvoiceOrder = null;
    var currentInvoiceCustomerPhone = null;
    var currentInvoiceProfile = null;

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

        // تنظيف إدخال رقم الجوال: تحويل الأرقام العربية إلى إنجليزية وقصر الطول على ١٠
        const phoneInput = document.getElementById('customer-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', function () {
                let cleaned = this.value;
                const arabicIndic = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
                arabicIndic.forEach((d, i) => {
                    cleaned = cleaned.split(d).join(String(i));
                });
                this.value = cleaned.replace(/[^\d]/g, '').slice(0, 10);
            });
        }

        // ============================================
        // Flatpickr: منتقي تاريخ عربي بأرقام لاتينية
        // القيمة المخزنة في الحقل الأصلي تبقى ISO (YYYY-MM-DD) للتوافق مع قاعدة البيانات
        // ============================================
        if (deliveryDateInput && typeof flatpickr !== 'undefined') {
            flatpickr(deliveryDateInput, {
                locale: 'ar',
                dateFormat: 'Y-m-d',
                altInput: true,
                altFormat: 'j F Y',
                disableMobile: true,
                minDate: 'today',
                position: 'auto'
            });
        }

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
        if (deliveryDateInput._flatpickr) {
            deliveryDateInput._flatpickr.setDate(tomorrow, false);
        } else {
            deliveryDateInput.value = formatDateForInput(tomorrow);
        }

        // تحميل الطلبات
        await loadAndRenderOrders();

        // ربط الأحداث
        wireEvents();

        // ربط أحداث نافذة الفاتورة
        var invoiceModal = document.getElementById('invoice-modal');
        if (invoiceModal) {
            var invoiceCancel = document.getElementById('invoice-cancel');
            var invoiceExport = document.getElementById('invoice-export');
            var invoiceBackdrop = invoiceModal.querySelector('.modal__backdrop');

            invoiceCancel.addEventListener('click', closeInvoiceModal);
            invoiceBackdrop.addEventListener('click', closeInvoiceModal);
            invoiceExport.addEventListener('click', exportInvoice);

            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && !invoiceModal.hidden) {
                    closeInvoiceModal();
                }
            });
        }
    });

    // ===== تعبئة قائمة العملاء =====
    function populateCustomerSelect() {
        // نحافظ على الخيار الأول
        customerSelect.innerHTML = '<option value="">اختر عميل</option>';
        allCustomers.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name + ' — ' + toWesternNumerals(c.phone);
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
    // نستخدم 'ar-EG-u-nu-latn' عشان نحصل على أسماء الأشهر بالعربي
    // مع الأرقام الغربية (0-9). ثم نلف النتيجة في toWesternNumerals
    // كحماية إضافية لأي متصفح قد يتجاهل خيار الأرقام.
    function formatDateArabic(dateStr) {
        if (!dateStr) return '';
        try {
            var date = new Date(dateStr + 'T00:00:00');
            var formatted = date.toLocaleDateString('ar-EG-u-nu-latn', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            return toWesternNumerals(formatted);
        } catch (e) {
            return toWesternNumerals(dateStr);
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
        if (!/^05\d{8}$/.test(phone)) {
            alert('رقم الجوال لازم يكون ١٠ أرقام ويبدأ بـ 05.');
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
        var quantity = Number(normalizeNumericInput(quantityInput.value));
        var unitPrice = Number(normalizeNumericInput(priceInput.value));

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
                    item.recipeName + ' × ' + toWesternNumerals(item.quantity) +
                    ' — <strong>' + toWesternNumerals(item.subtotal.toFixed(2)) + ' ريال</strong>' +
                    ' <span class="order-item-row__unit-price">(' + toWesternNumerals(item.unitPrice.toFixed(2)) + ' للوحدة)</span>' +
                '</span>' +
                '<button class="btn btn--danger btn--small" data-action="remove-item" data-index="' + index + '">حذف</button>';
            orderItemsList.appendChild(row);
        });

        total = Math.round(total * 100) / 100;
        orderTotalAmount.textContent = toWesternNumerals(total.toFixed(2));
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
        if (deliveryDateInput._flatpickr) {
            deliveryDateInput._flatpickr.setDate(tomorrow, false);
        } else {
            deliveryDateInput.value = formatDateForInput(tomorrow);
        }

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
                return item.recipeName + ' × ' + toWesternNumerals(item.quantity) +
                    ' — ' + toWesternNumerals(item.subtotal.toFixed(2)) + ' ريال';
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
                '<div class="order-card__total">الإجمالي: ' + toWesternNumerals(order.totalPrice.toFixed(2)) + ' ريال</div>' +
                notesHtml +
                '<div class="order-card__status">' +
                    '<span class="status-badge status-badge--' + order.status + '">' +
                    STATUS_LABELS[order.status] + '</span>' +
                '</div>' +
                '<div class="order-card__actions">' +
                    nextStatusHtml +
                    '<button class="btn btn-secondary order-card__invoice-btn btn--small" data-action="invoice" data-order-id="' +
                    order.id + '">فاتورة</button>' +
                    '<button class="btn btn--danger btn--small" data-action="delete-order" data-id="' +
                    order.id + '">حذف</button>' +
                '</div>';

            ordersList.appendChild(card);
        });
    }

    // ===== التعامل مع أحداث قائمة الطلبات =====
    async function handleOrdersListClick(e) {
        // فتح نافذة الفاتورة
        var invoiceBtn = e.target.closest('[data-action="invoice"]');
        if (invoiceBtn) {
            var invoiceOrderId = invoiceBtn.dataset.orderId;
            await openInvoiceModal(invoiceOrderId);
            return;
        }

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

    // ===== فتح نافذة الفاتورة =====
    // نجلب الطلب وبيانات المتجر، ثم نعبّي الحقول ونعرض النافذة
    async function openInvoiceModal(orderId) {
        var order = await window.tasceerOrders.getOrderById(orderId);
        if (!order) {
            alert('الطلب غير موجود.');
            return;
        }

        // جلب بيانات المتجر (مع fallback لو غير متوفرة)
        var profile = { storeName: null, storeLogoUrl: null, storePhone: null };
        try {
            if (window.tasceerAccount) {
                profile = await window.tasceerAccount.getProfile();
            }
        } catch (err) {
            console.warn('تعذر جلب بيانات المتجر:', err);
        }

        // تعبئة قسم معلومات المتجر في النافذة
        var hasStoreData = false;
        var storeNameWrap = document.getElementById('invoice-store-name-wrap');
        var storeLogoWrap = document.getElementById('invoice-store-logo-wrap');
        var storePhoneWrap = document.getElementById('invoice-store-phone-wrap');
        var storeEmpty = document.getElementById('invoice-store-empty');
        var storeHint = document.getElementById('invoice-store-hint');

        if (profile.storeName) {
            document.getElementById('invoice-store-name-display').textContent = profile.storeName;
            storeNameWrap.hidden = false;
            document.getElementById('invoice-show-store-name').checked = true;
            hasStoreData = true;
        } else {
            storeNameWrap.hidden = true;
        }

        if (profile.storeLogoUrl) {
            storeLogoWrap.hidden = false;
            document.getElementById('invoice-show-store-logo').checked = true;
            hasStoreData = true;
        } else {
            storeLogoWrap.hidden = true;
        }

        if (profile.storePhone) {
            document.getElementById('invoice-store-phone-display').textContent = profile.storePhone;
            storePhoneWrap.hidden = false;
            document.getElementById('invoice-show-store-phone').checked = true;
            hasStoreData = true;
        } else {
            storePhoneWrap.hidden = true;
        }

        storeEmpty.hidden = hasStoreData;
        storeHint.hidden = !hasStoreData;

        // معلومات العميل
        document.getElementById('invoice-customer-name').textContent = order.customerName || '—';

        // جلب جوال العميل من customers.js (fallback: '—')
        var customerPhone = '—';
        try {
            if (window.tasceerCustomers && window.tasceerCustomers.getCustomerById) {
                var customer = await window.tasceerCustomers.getCustomerById(order.customerId);
                if (customer && customer.phone) {
                    customerPhone = customer.phone;
                }
            }
        } catch (err) {
            console.warn('تعذر جلب بيانات العميل:', err);
        }
        document.getElementById('invoice-customer-phone').textContent = customerPhone;

        var deliveryMethodLabel = order.deliveryMethod === 'delivery' ? 'توصيل' : 'استلام';
        document.getElementById('invoice-delivery-method').textContent = deliveryMethodLabel;

        // حقول التوصيل (للتوصيل فقط — تأخذ قيم محفوظة لو موجودة)
        var deliveryFields = document.getElementById('invoice-delivery-fields');
        var districtInput = document.getElementById('invoice-district');
        var deliveryCostInput = document.getElementById('invoice-delivery-cost');

        if (order.deliveryMethod === 'delivery') {
            deliveryFields.hidden = false;
            districtInput.value = order.deliveryDistrict || '';
            deliveryCostInput.value = order.deliveryCost != null ? String(order.deliveryCost) : '';
        } else {
            deliveryFields.hidden = true;
            districtInput.value = '';
            deliveryCostInput.value = '';
        }

        // رسالة الشكر (نرجعها للقيمة الافتراضية كل مرة)
        document.getElementById('invoice-thank-you').value = 'شكراً لطلبك';

        // نحفظ الطلب والبروفايل لاستخدامهما عند التصدير
        currentInvoiceOrder = order;
        currentInvoiceCustomerPhone = customerPhone;
        currentInvoiceProfile = profile;

        // فتح النافذة
        document.getElementById('invoice-modal').hidden = false;
    }

    // ===== تصدير الفاتورة كصورة PNG =====
    async function exportInvoice() {
        if (!currentInvoiceOrder) return;
        if (typeof html2canvas !== 'function') {
            alert('مكتبة إنشاء الصورة لم تُحمّل. تحقق من اتصالك بالإنترنت.');
            return;
        }

        var exportBtn = document.getElementById('invoice-export');
        var originalText = exportBtn.textContent;
        exportBtn.disabled = true;
        exportBtn.textContent = 'جاري الإنشاء...';

        try {
            var order = currentInvoiceOrder;
            var profile = currentInvoiceProfile;

            // قراءة القيم من النافذة
            var showStoreName = document.getElementById('invoice-show-store-name').checked;
            var showStoreLogo = document.getElementById('invoice-show-store-logo').checked;
            var showStorePhone = document.getElementById('invoice-show-store-phone').checked;
            var district = document.getElementById('invoice-district').value.trim();
            var deliveryCostRaw = document.getElementById('invoice-delivery-cost').value.trim();
            var thankYouMessage = document.getElementById('invoice-thank-you').value.trim() || 'شكراً لطلبك';

            var deliveryCost = 0;
            if (deliveryCostRaw !== '') {
                var parsed = parseFloat(normalizeNumericInput(deliveryCostRaw));
                if (!isNaN(parsed) && parsed >= 0) {
                    deliveryCost = parsed;
                }
            }

            // حفظ الحي والتكلفة في الطلب (لو توصيل) — عشان تظهر في المرة القادمة
            if (order.deliveryMethod === 'delivery') {
                try {
                    await window.tasceerOrders.updateInvoiceData(
                        order.id,
                        district || null,
                        deliveryCost > 0 ? deliveryCost : null
                    );
                } catch (err) {
                    console.warn('تعذر حفظ بيانات الفاتورة:', err);
                    // لا نوقف التصدير — بس نسجل الخطأ
                }
            }

            // === تعبئة قالب الفاتورة ===
            var template = document.getElementById('invoice-template');

            // الهيدر
            var header = document.getElementById('invoice-template-header');
            var logoImg = document.getElementById('invoice-template-logo');
            var storeNameEl = document.getElementById('invoice-template-store-name');
            var storePhoneEl = document.getElementById('invoice-template-store-phone');

            var showHeader = false;

            if (showStoreLogo && profile.storeLogoUrl) {
                logoImg.src = profile.storeLogoUrl;
                logoImg.hidden = false;
                showHeader = true;
            } else {
                logoImg.hidden = true;
            }

            if (showStoreName && profile.storeName) {
                storeNameEl.textContent = profile.storeName;
                storeNameEl.hidden = false;
                showHeader = true;
            } else {
                storeNameEl.hidden = true;
                storeNameEl.textContent = '';
            }

            if (showStorePhone && profile.storePhone) {
                storePhoneEl.textContent = profile.storePhone;
                storePhoneEl.hidden = false;
                showHeader = true;
            } else {
                storePhoneEl.hidden = true;
                storePhoneEl.textContent = '';
            }

            header.hidden = !showHeader;

            // رقم الفاتورة + التاريخ
            var invNumber = 'INV-' + String(order.id).padStart(4, '0');
            document.getElementById('invoice-template-number').textContent = invNumber;

            var orderDate = order.deliveryDate || order.createdAt;
            var dateDisplay = '';
            if (orderDate) {
                try {
                    var d = new Date(orderDate);
                    var day = String(d.getDate()).padStart(2, '0');
                    var month = String(d.getMonth() + 1).padStart(2, '0');
                    var year = d.getFullYear();
                    dateDisplay = day + '/' + month + '/' + year;
                } catch (e) {
                    dateDisplay = String(orderDate);
                }
            }
            document.getElementById('invoice-template-date').textContent = 'التاريخ: ' + dateDisplay;

            // بيانات العميل
            document.getElementById('invoice-template-customer-name').textContent = order.customerName || '—';
            document.getElementById('invoice-template-customer-phone').textContent = currentInvoiceCustomerPhone || '—';
            document.getElementById('invoice-template-delivery-method').textContent =
                order.deliveryMethod === 'delivery' ? 'توصيل' : 'استلام';

            var districtLine = document.getElementById('invoice-template-district-line');
            if (order.deliveryMethod === 'delivery' && district) {
                document.getElementById('invoice-template-district').textContent = district;
                districtLine.hidden = false;
            } else {
                districtLine.hidden = true;
            }

            // جدول الأصناف
            var tbody = document.getElementById('invoice-template-items-body');
            tbody.innerHTML = '';
            var items = order.items || [];
            var subtotal = 0;
            items.forEach(function (item) {
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + item.recipeName + '</td>' +
                    '<td>' + toWesternNumerals(String(item.quantity)) + '</td>' +
                    '<td>' + toWesternNumerals(item.unitPrice.toFixed(2)) + ' ريال</td>' +
                    '<td>' + toWesternNumerals(item.subtotal.toFixed(2)) + ' ريال</td>';
                tbody.appendChild(tr);
                subtotal += item.subtotal;
            });

            // الإجماليات
            var subtotalRow = document.getElementById('invoice-template-subtotal-row');
            var deliveryRow = document.getElementById('invoice-template-delivery-row');

            if (deliveryCost > 0) {
                document.getElementById('invoice-template-subtotal').textContent =
                    toWesternNumerals(subtotal.toFixed(2)) + ' ريال';
                document.getElementById('invoice-template-delivery-cost').textContent =
                    toWesternNumerals(deliveryCost.toFixed(2)) + ' ريال';
                subtotalRow.hidden = false;
                deliveryRow.hidden = false;
            } else {
                subtotalRow.hidden = true;
                deliveryRow.hidden = true;
            }

            var grandTotal = Math.round((subtotal + deliveryCost) * 100) / 100;
            document.getElementById('invoice-template-grand-total').textContent =
                toWesternNumerals(grandTotal.toFixed(2)) + ' ريال';

            // رسالة الشكر
            document.getElementById('invoice-template-thank-you').textContent = thankYouMessage;

            // التصدير إلى PNG: نظهر القالب خارج الشاشة مؤقتاً
            template.style.position = 'fixed';
            template.style.left = '-9999px';
            template.style.top = '0';
            template.style.display = 'block';

            var canvas = await html2canvas(template, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: false
            });

            // إرجاع القالب لحالته المخفية
            template.style.position = '';
            template.style.left = '';
            template.style.top = '';
            template.style.display = '';

            canvas.toBlob(function (blob) {
                if (!blob) {
                    alert('حصل خطأ أثناء إنشاء الفاتورة.');
                    return;
                }
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'فاتورة-' + invNumber + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

                // إغلاق النافذة بعد التصدير
                closeInvoiceModal();
            }, 'image/png');

        } catch (err) {
            console.error('exportInvoice error:', err);
            alert('حصل خطأ أثناء تصدير الفاتورة. حاولي مرة أخرى.');
        } finally {
            exportBtn.disabled = false;
            exportBtn.textContent = originalText;
        }
    }

    // ===== إغلاق نافذة الفاتورة =====
    function closeInvoiceModal() {
        document.getElementById('invoice-modal').hidden = true;
        currentInvoiceOrder = null;
    }

    // ===== مساعد: حماية النص من HTML =====
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

})();
