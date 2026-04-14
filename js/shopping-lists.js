/*
  ============================================
  ملف إدارة القوائم المحفوظة (قائمة التسوق)
  ============================================
  هذا الملف مسؤول عن قراءة وحفظ وحذف
  القوائم المحفوظة في localStorage.
  لا يلمس DOM ولا يحسب أي شي — فقط بيانات.

  شكل القائمة المحفوظة:
    - id: نص فريد
    - name: اسم القائمة (عربي)
    - selections: [{ recipeId, quantity }]
    - createdAt / updatedAt: تاريخ ISO

  ملاحظة مهمة: لا نخزن المكونات المجمّعة ولا
  التكاليف. نعيد حسابها عند الاستعادة عشان تعكس
  أي تعديل على الأسعار أو الوصفات.
  ============================================
*/

(function () {
    const STORAGE_KEY = 'tasceer_shopping_lists';

    // دالة داخلية: تكتب كامل قائمة القوائم المحفوظة في localStorage
    function persistLists(lists) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    }

    // ترجع كل القوائم المحفوظة. لو ما فيه شي أو البيانات تالفة، ترجع قائمة فاضية.
    function getAllSavedLists() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            return [];
        }
    }

    // ترجع قائمة محفوظة واحدة حسب رقمها، أو null لو ما لقيناها
    function getSavedListById(id) {
        if (!id) {
            return null;
        }
        const lists = getAllSavedLists();
        const found = lists.find(function (item) {
            return item.id === id;
        });
        return found || null;
    }

    // تحفظ قائمة جديدة باسم مع مصفوفة الاختيارات.
    // نتحقق من أن الاسم غير فاضي بعد trim.
    function saveList(name, selections) {
        const trimmed = (name || '').trim();
        if (!trimmed) {
            throw new Error('اسم القائمة مطلوب');
        }

        const now = new Date().toISOString();
        const newList = {
            id: crypto.randomUUID(),
            name: trimmed,
            // ننسخ المصفوفة عشان ما نربط المرجع مع الحالة الجارية
            selections: (selections || []).map(function (s) {
                return { recipeId: s.recipeId, quantity: Number(s.quantity) };
            }),
            createdAt: now,
            updatedAt: now
        };

        const lists = getAllSavedLists();
        lists.push(newList);
        persistLists(lists);
        return newList;
    }

    // تحذف قائمة محفوظة حسب الرقم
    function deleteSavedList(id) {
        if (!id) {
            throw new Error('رقم القائمة مطلوب');
        }
        const lists = getAllSavedLists();
        const filtered = lists.filter(function (item) {
            return item.id !== id;
        });
        persistLists(filtered);
    }

    window.tasceerShoppingLists = {
        getAllSavedLists: getAllSavedLists,
        getSavedListById: getSavedListById,
        saveList: saveList,
        deleteSavedList: deleteSavedList
    };
})();
