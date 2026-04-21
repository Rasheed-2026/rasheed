/*
  ============================================
  ملف إدارة الطلبات (Supabase)
  ============================================
  يتعامل مع جدولين: orders و order_items.
  الملف ما يلمس DOM — فقط بيانات.
  ============================================
*/

(function () {
    // ===== مساعد: يرجع معرّف المستخدم الحالي =====
    async function getCurrentUserId() {
        var data = (await window.supabaseClient.auth.getUser()).data;
        return data.user ? data.user.id : null;
    }

    // ===== الحالات المسموحة للطلب =====
    var VALID_STATUSES = ['new', 'preparing', 'ready', 'delivered'];

    // ===== تحويل صف طلب من قاعدة البيانات =====
    function dbToOrder(row) {
        if (!row) return null;
        return {
            id: row.id,
            invoiceNumber: row.invoice_number != null ? Number(row.invoice_number) : null,
            customerId: row.customer_id,
            deliveryMethod: row.delivery_method,
            deliveryDate: row.delivery_date,
            deliveryDistrict: row.delivery_district || null,
            deliveryCost: row.delivery_cost != null ? Number(row.delivery_cost) : null,
            status: row.status,
            notes: row.notes || null,
            totalPrice: Number(row.total_price || 0),
            createdAt: row.created_at
        };
    }

    // ===== تحويل صف عنصر طلب من قاعدة البيانات =====
    function dbToOrderItem(row) {
        if (!row) return null;
        return {
            id: row.id,
            orderId: row.order_id,
            recipeId: row.recipe_id || null,
            recipeName: row.recipe_name,
            quantity: Number(row.quantity),
            unitPrice: Number(row.unit_price),
            subtotal: Number(row.subtotal)
        };
    }

    // ===== جلب كل الطلبات مع عناصرها واسم العميل =====
    async function getAllOrders(statusFilter) {
        // بناء الاستعلام الأساسي مع ربط جدول العملاء وعناصر الطلب
        var query = window.supabaseClient
            .from('orders')
            .select('*, customers(name), order_items(*)');

        // فلترة حسب الحالة لو مطلوبة
        if (statusFilter && statusFilter !== 'all') {
            if (statusFilter === 'active') {
                // الطلبات الحالية = كل شي ما عدا المسلّمة
                query = query.in('status', ['new', 'preparing', 'ready']);
            } else {
                query = query.eq('status', statusFilter);
            }
        }

        // ترتيب حسب تاريخ التسليم (الأقرب أولاً) ثم تاريخ الإنشاء
        query = query
            .order('delivery_date', { ascending: true })
            .order('created_at', { ascending: false });

        var result = await query;

        if (result.error) {
            console.error('خطأ في جلب الطلبات:', result.error);
            return [];
        }

        // تحويل كل طلب مع إضافة اسم العميل وعناصره
        return (result.data || []).map(function (row) {
            var order = dbToOrder(row);
            order.customerName = row.customers ? row.customers.name : 'عميل محذوف';
            order.items = (row.order_items || []).map(dbToOrderItem);
            return order;
        });
    }

    // ===== جلب طلب واحد بالمعرّف =====
    async function getOrderById(id) {
        var result = await window.supabaseClient
            .from('orders')
            .select('*, customers(name), order_items(*)')
            .eq('id', id)
            .single();

        if (result.error) {
            console.error('خطأ في جلب الطلب:', result.error);
            return null;
        }

        var order = dbToOrder(result.data);
        order.customerName = result.data.customers ? result.data.customers.name : 'عميل محذوف';
        order.items = (result.data.order_items || []).map(dbToOrderItem);
        return order;
    }

    // ===== إنشاء طلب جديد مع عناصره =====
    // items: مصفوفة من { recipeId, recipeName, quantity, unitPrice }
    async function addOrder(customerId, deliveryMethod, deliveryDate, notes, items) {
        var userId = await getCurrentUserId();
        if (!userId) throw new Error('يجب تسجيل الدخول أولاً');

        // حساب المجموع الكلي
        var totalPrice = 0;
        var preparedItems = items.map(function (item) {
            var subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
            totalPrice += subtotal;
            return {
                recipe_id: item.recipeId || null,
                recipe_name: item.recipeName,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                subtotal: subtotal
            };
        });
        totalPrice = Math.round(totalPrice * 100) / 100;

        // إدخال الطلب أولاً
        var orderResult = await window.supabaseClient
            .from('orders')
            .insert({
                user_id: userId,
                customer_id: customerId,
                delivery_method: deliveryMethod || 'pickup',
                delivery_date: deliveryDate,
                status: 'new',
                notes: (notes || '').trim() || null,
                total_price: totalPrice
            })
            .select()
            .single();

        if (orderResult.error) {
            throw new Error('حصل خطأ أثناء حفظ الطلب: ' + orderResult.error.message);
        }

        var orderId = orderResult.data.id;

        // إدخال عناصر الطلب
        var itemsToInsert = preparedItems.map(function (item) {
            item.order_id = orderId;
            return item;
        });

        var itemsResult = await window.supabaseClient
            .from('order_items')
            .insert(itemsToInsert)
            .select();

        if (itemsResult.error) {
            console.error('خطأ في حفظ عناصر الطلب:', itemsResult.error);
        }

        // إرجاع الطلب الكامل
        return getOrderById(orderId);
    }

    // ===== تحديث حالة الطلب فقط =====
    async function updateOrderStatus(id, newStatus) {
        if (VALID_STATUSES.indexOf(newStatus) === -1) {
            throw new Error('حالة غير صالحة: ' + newStatus);
        }

        var result = await window.supabaseClient
            .from('orders')
            .update({ status: newStatus })
            .eq('id', id)
            .select()
            .single();

        if (result.error) {
            throw new Error('حصل خطأ أثناء تحديث الحالة: ' + result.error.message);
        }
        return dbToOrder(result.data);
    }

    // ===== تحديث بيانات الفاتورة (الحي وتكلفة التوصيل) =====
    // تُستدعى من نافذة تصدير الفاتورة. تحفظ الحي والتكلفة في الطلب
    // بحيث تظهر تلقائياً في المرة القادمة لنفس الطلب.
    // district و cost اختياريان — null مقبول.
    async function updateInvoiceData(id, district, cost) {
        if (!id) throw new Error('رقم الطلب مطلوب');

        // تنظيف القيم: فارغ أو مسافات فقط → null
        var cleanedDistrict = null;
        if (district !== null && district !== undefined) {
            var trimmed = String(district).trim();
            cleanedDistrict = trimmed === '' ? null : trimmed;
        }

        var cleanedCost = null;
        if (cost !== null && cost !== undefined && cost !== '') {
            var num = Number(cost);
            if (!isNaN(num) && num >= 0) {
                cleanedCost = num;
            }
        }

        var result = await window.supabaseClient
            .from('orders')
            .update({
                delivery_district: cleanedDistrict,
                delivery_cost: cleanedCost
            })
            .eq('id', id)
            .select()
            .single();

        if (result.error) {
            throw new Error('حصل خطأ أثناء حفظ بيانات الفاتورة: ' + result.error.message);
        }
        return dbToOrder(result.data);
    }

    // ===== تعديل طلب كامل (بياناته وعناصره) =====
    async function updateOrder(id, customerId, deliveryMethod, deliveryDate, notes, items) {
        // حساب المجموع الجديد
        var totalPrice = 0;
        items.forEach(function (item) {
            totalPrice += Math.round(item.quantity * item.unitPrice * 100) / 100;
        });
        totalPrice = Math.round(totalPrice * 100) / 100;

        // تحديث بيانات الطلب
        var orderResult = await window.supabaseClient
            .from('orders')
            .update({
                customer_id: customerId,
                delivery_method: deliveryMethod || 'pickup',
                delivery_date: deliveryDate,
                notes: (notes || '').trim() || null,
                total_price: totalPrice
            })
            .eq('id', id)
            .select()
            .single();

        if (orderResult.error) {
            throw new Error('حصل خطأ أثناء تعديل الطلب: ' + orderResult.error.message);
        }

        // حذف العناصر القديمة
        await window.supabaseClient
            .from('order_items')
            .delete()
            .eq('order_id', id);

        // إدخال العناصر الجديدة
        var newItems = items.map(function (item) {
            return {
                order_id: id,
                recipe_id: item.recipeId || null,
                recipe_name: item.recipeName,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                subtotal: Math.round(item.quantity * item.unitPrice * 100) / 100
            };
        });

        if (newItems.length > 0) {
            await window.supabaseClient
                .from('order_items')
                .insert(newItems)
                .select();
        }

        return getOrderById(id);
    }

    // ===== حذف طلب (CASCADE يحذف العناصر تلقائياً) =====
    async function deleteOrder(id) {
        var result = await window.supabaseClient
            .from('orders')
            .delete()
            .eq('id', id);

        if (result.error) {
            throw new Error('حصل خطأ أثناء حذف الطلب: ' + result.error.message);
        }
    }

    // ===== جلب طلبات حسب الحالة =====
    async function getOrdersByStatus(status) {
        return getAllOrders(status);
    }

    // ===== جلب الطلبات الحالية (غير المسلّمة) =====
    async function getActiveOrders() {
        return getAllOrders('active');
    }

    // ===== تصدير الدوال العامة =====
    window.tasceerOrders = {
        getAllOrders: getAllOrders,
        getOrderById: getOrderById,
        addOrder: addOrder,
        updateOrderStatus: updateOrderStatus,
        updateInvoiceData: updateInvoiceData,
        updateOrder: updateOrder,
        deleteOrder: deleteOrder,
        getOrdersByStatus: getOrdersByStatus,
        getActiveOrders: getActiveOrders
    };
})();
