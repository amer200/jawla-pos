// renderer.js - النسخة النهائية المطورة لنظام جولة

// --- 1. تعريف العناصر ---
const categoryForm = document.getElementById('categoryForm');
const productForm = document.getElementById('productForm');
const userForm = document.getElementById('userForm');
const productCategorySelect = document.getElementById('productCategory');
const inventoryTable = document.getElementById('inventoryTableBody');
const employeeBalancesTable = document.getElementById('employeeBalancesTable');
const searchInput = document.getElementById('searchInput'); // البحث

// مودال التعديل
const editProductModalEl = document.getElementById('editProductModal');
const editModal = editProductModalEl ? new bootstrap.Modal(editProductModalEl) : null;
const saveEditBtn = document.getElementById('save-edit-btn');

// الإحصائيات
const totalPurchaseValueEl = document.getElementById('totalPurchaseValue');
const totalExpectedProfitEl = document.getElementById('totalExpectedProfit');
const totalItemsCountEl = document.getElementById('totalItemsCount');

// متغير لحفظ المنتجات مؤقتاً لعملية البحث السريع
let allProducts = [];

// --- ٢. وظائف جلب البيانات ---

async function loadCategories() {
    try {
        const categories = await window.api.getCategories();
        if (productCategorySelect) {
            productCategorySelect.innerHTML = categories.map(c =>
                `<option value="${c.id}">${c.name}</option>`
            ).join('');
        }
    } catch (err) { console.error("❌ خطأ تحميل الأقسام:", err); }
}

async function loadInventory() {
    try {
        allProducts = await window.api.getAllProducts();
        renderTable(allProducts);
        updateStats(allProducts);
    } catch (err) { console.error("❌ خطأ تحميل المخزن:", err); }
}

// دالة رسم الجدول (فصلناها عشان نستخدمها في البحث)
function renderTable(products) {
    if (!inventoryTable) return;
    inventoryTable.innerHTML = products.map(p => `
        <tr>
            <td><small class="text-muted">${p.barcode}</small></td>
            <td><span class="badge bg-info text-dark">${p.category_name || 'عام'}</span></td>
            <td class="fw-bold">${p.name}</td>
            <td><span class="badge ${p.qty < 5 ? 'bg-danger' : 'bg-light text-dark'}">${p.qty}</span></td>
            <td>${Number(p.purchase_price).toFixed(2)}</td>
            <td>${Number(p.sell_price).toFixed(2)}</td>
            <td class="text-success fw-bold">${(p.sell_price - p.purchase_price).toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="openEditModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="handleDelete(${p.id})">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn btn-sm btn-dark" onclick="printBarcodeLabel('${p.barcode}', '${p.name}', ${p.sell_price})">
                    <i class="fas fa-print"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function loadEmployees() {
    try {
        const balances = await window.api.getEmployeesBalances();
        if (employeeBalancesTable) {
            employeeBalancesTable.innerHTML = balances.map(b => `
                <tr>
                    <td>${b.username}</td>
                    <td class="fw-bold text-primary">${(b.currentBalance || 0).toFixed(2)} ج.م</td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="handleSettle(${b.id})">تصفية العهدة</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (err) { console.error("❌ خطأ تحميل الموظفين:", err); }
}

function updateStats(products) {
    let totalP = 0,
        totalPr = 0;
    products.forEach(p => {
        totalP += (p.purchase_price * p.qty);
        totalPr += ((p.sell_price - p.purchase_price) * p.qty);
    });
    if (totalPurchaseValueEl) totalPurchaseValueEl.innerText = totalP.toFixed(2) + ' ج.م';
    if (totalExpectedProfitEl) totalExpectedProfitEl.innerText = totalPr.toFixed(2) + ' ج.م';
    if (totalItemsCountEl) totalItemsCountEl.innerText = products.length;
}

// --- ٣. البحث الذكي ---
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allProducts.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.barcode.toLowerCase().includes(term)
        );
        renderTable(filtered);
    });
}

// --- ٤. العمليات (Actions) ---

window.openEditModal = (product) => {
    document.getElementById('edit-id').value = product.id;
    document.getElementById('edit-name').value = product.name;
    document.getElementById('edit-qty').value = product.qty;
    document.getElementById('edit-purchase').value = product.purchase_price;
    document.getElementById('edit-sell').value = product.sell_price;
    if (editModal) editModal.show();
};

if (saveEditBtn) {
    saveEditBtn.addEventListener('click', async() => {
        const product = {
            id: document.getElementById('edit-id').value,
            name: document.getElementById('edit-name').value,
            qty: parseInt(document.getElementById('edit-qty').value) || 0,
            purchase_price: parseFloat(document.getElementById('edit-purchase').value) || 0,
            sell_price: parseFloat(document.getElementById('edit-sell').value) || 0
        };

        // محاولة التعديل
        try {
            const result = await window.api.updateProduct(product);
            if (result && result.success) {
                editModal.hide();
                await loadInventory();
                alert('✅ تم التعديل بنجاح');
            } else {
                alert('❌ فشل التعديل: تأكد من تسجيل الـ Handler في الملف الرئيسي');
            }
        } catch (err) {
            console.error(err);
            alert('❌ خطأ فني: Handler غير مسجل في الـ Main');
        }
    });
}

window.handleDelete = async(id) => {
    if (confirm('هل أنت متأكد من المسح النهائي؟')) {
        const result = await window.api.deleteProduct(id);
        if (result.success) loadInventory();
    }
};

window.handleSettle = async(userId) => {
    if (confirm('هل تريد تصفية عهدة الموظف؟')) {
        const result = await window.api.settleUserSales(userId);
        if (result.success) loadEmployees();
    }
};

// --- ٥. الإضافات ---

if (categoryForm) {
    categoryForm.addEventListener('submit', async(e) => {
        e.preventDefault();
        const nameInput = document.getElementById('categoryName');
        if (!nameInput.value) return;
        const result = await window.api.addCategory(nameInput.value);
        if (result.success) {
            nameInput.value = '';
            loadCategories();
            alert('✅ تم إضافة القسم');
        }
    });
}

if (productForm) {
    productForm.addEventListener('submit', async(e) => {
        e.preventDefault();
        const product = {
            barcode: document.getElementById('productBarcode').value,
            category_id: document.getElementById('productCategory').value,
            name: document.getElementById('productName').value,
            qty: parseInt(document.getElementById('productQty').value) || 0,
            purchase_price: parseFloat(document.getElementById('purchasePrice').value) || 0,
            sell_price: parseFloat(document.getElementById('sellPrice').value) || 0
        };
        const result = await window.api.addProduct(product);
        if (result.success) {
            productForm.reset();
            document.getElementById('barcodeContainer').style.display = 'none';
            loadInventory();
            alert('✅ تم إضافة المنتج');
        }
    });
}
// إضافة موظف جديد
if (userForm) {
    userForm.addEventListener('submit', async(e) => {
        e.preventDefault(); // ده السطر السحري اللي بيمنع الـ Refresh

        const usernameInput = document.getElementById('newUsername');
        const passwordInput = document.getElementById('newPassword');

        const userData = {
            username: usernameInput.value,
            password: passwordInput.value
        };

        try {
            // بننادي الـ API اللي عرفناه في الـ Main
            const result = await window.api.addUser(userData);

            if (result.success) {
                alert('✅ تم إضافة الموظف بنجاح');
                userForm.reset(); // بنفضي الحقول
                await loadEmployees(); // بنحدث جدول الموظفين عشان يظهر الجديد
            } else {
                alert('❌ فشل إضافة الموظف: ممكن يكون الاسم موجود قبل كدة');
            }
        } catch (err) {
            console.error("❌ خطأ في إضافة الموظف:", err);
            alert('❌ حصل خطأ فني، راجع الـ Console');
        }
    });
}
// --- ٦. الباركود والطباعة ---

const genBarcodeBtn = document.getElementById('genBarcodeBtn');
if (genBarcodeBtn) {
    genBarcodeBtn.addEventListener('click', () => {
        const code = '622' + Math.floor(Math.random() * 9000000000 + 1000000000);
        document.getElementById('productBarcode').value = code;
        document.getElementById('barcodeContainer').style.display = 'block';
        JsBarcode("#barcodePreview", code, { format: "CODE128", width: 2, height: 40 });
    });
}

window.printBarcodeLabel = (barcode, name, price) => {
    const canvas = document.createElement('canvas');
    try {
        JsBarcode(canvas, barcode, {
            format: "CODE128",
            width: 2,
            height: 80,
            displayValue: true,
            fontSize: 20
        });
        const barcodeImg = canvas.toDataURL("image/png");
        const labelHtml = `
            <div style="width: 38mm; text-align: center; font-family: Arial; padding: 5px; direction: rtl;">
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">نظام جولة</div>
                <div style="font-size: 12px; margin-bottom: 5px;">${name}</div>
                <img src="${barcodeImg}" style="width: 100%; max-height: 50px;" />
                <div style="font-size: 14px; font-weight: bold; margin-top: 5px;">السعر: ${price} ج.م</div>
            </div>
        `;
        window.api.printReceipt(labelHtml);
    } catch (err) {
        alert("مشكلة في توليد الباركود");
    }
};

// --- ٧. التشغيل ---

async function init() {
    console.log("🚀 Initializing Nizam Jawla Admin...");
    if (window.api) {
        await loadCategories();
        await loadInventory();
        await loadEmployees();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}