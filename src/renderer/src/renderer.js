import 'bootstrap/dist/css/bootstrap.rtl.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import * as bootstrap from 'bootstrap';
import JsBarcode from 'jsbarcode';
// --- 1. تعريف العناصر من الصفحة ---
var categoryForm = document.getElementById('categoryForm');
var productForm = document.getElementById('productForm');
var userForm = document.getElementById('userForm');
var productCategorySelect = document.getElementById('productCategory');
var inventoryTable = document.getElementById('inventoryTableBody');
var employeeBalancesTable = document.getElementById('employeeBalancesTable');
var searchInput = document.getElementById('searchInput');
var saveEditBtn = document.getElementById('save-edit-btn');

// كروت الإحصائيات
var totalPurchaseValueEl = document.getElementById('totalPurchaseValue');
var totalExpectedProfitEl = document.getElementById('totalExpectedProfit');
var totalItemsCountEl = document.getElementById('totalItemsCount');

// مصفوفة حفظ المنتجات
var allProducts = [];

// --- 2. تشغيل التبويبات (Tabs) بدون الاعتماد على أي مكتبة خارجية ---
function setupTabs() {
    var tabButtons = document.querySelectorAll('#adminTabs button');
    for (var i = 0; i < tabButtons.length; i++) {
        tabButtons[i].addEventListener('click', function(e) {
            e.preventDefault();
            var targetId = this.getAttribute('data-bs-target');
            if (!targetId) return;

            // إزالة التفعيل من جميع الأزرار وتفعيل الزر المضغوط
            for (var j = 0; j < tabButtons.length; j++) {
                tabButtons[j].classList.remove('active');
            }
            this.classList.add('active');

            // إخفاء كل الصفحات وإظهار الصفحة المطلوبة
            var panes = document.querySelectorAll('.tab-content .tab-pane');
            for (var k = 0; k < panes.length; k++) {
                panes[k].classList.remove('show', 'active');
            }
            var targetPane = document.querySelector(targetId);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
        });
    }
}

// --- 3. نافذة التعديل (Modal) بشكل محلي مستقل ---
function setupModal() {
    document.addEventListener('click', function(e) {
        var dismissBtn = e.target.closest('[data-bs-dismiss="modal"]');
        if (dismissBtn) {
            var modal = dismissBtn.closest('.modal');
            if (modal) {
                hideModalFallback(modal);
            }
        }
    });
}

function showModalFallback(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = 'block';
    modalEl.classList.add('show');
    document.body.classList.add('modal-open');
    if (!document.getElementById('custom-modal-backdrop')) {
        var backdrop = document.createElement('div');
        backdrop.id = 'custom-modal-backdrop';
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);
    }
}

function hideModalFallback(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    modalEl.classList.remove('show');
    document.body.classList.remove('modal-open');
    var backdrop = document.getElementById('custom-modal-backdrop');
    if (backdrop) {
        backdrop.remove();
    }
}

// --- 4. تحميل الأقسام والمخزن والموظفين ---

async function loadCategories() {
    try {
        var categories = await window.api.getCategories();
        if (productCategorySelect && categories) {
            var optionsHtml = '';
            for (var i = 0; i < categories.length; i++) {
                var c = categories[i];
                optionsHtml += '<option value="' + c.id + '">' + c.name + '</option>';
            }
            productCategorySelect.innerHTML = optionsHtml;
        }
    } catch (err) {
        console.error("خطأ تحميل الأقسام:", err);
    }
}

async function loadInventory() {
    try {
        var products = await window.api.getAllProducts();
        allProducts = products || [];
        renderTable(allProducts);
        updateStats(allProducts);
    } catch (err) {
        console.error("خطأ تحميل المخزن:", err);
    }
}

function renderTable(products) {
    if (!inventoryTable) return;

    if (!products || products.length === 0) {
        inventoryTable.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">لا توجد منتجات مسجلة في المخزن</td></tr>';
        return;
    }

    var rowsHtml = '';
    for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var barcode = p.barcode ? p.barcode : '—';
        var catName = p.category_name ? p.category_name : 'عام';
        var buyPrice = Number(p.purchase_price) || 0;
        var sellPrice = Number(p.sell_price) || 0;
        var profit = (sellPrice - buyPrice).toFixed(2);
        var qty = Number(p.qty) || 0;
        var badgeClass = qty < 5 ? 'bg-danger' : 'bg-light text-dark';

        rowsHtml += '<tr>';
        rowsHtml += '<td><small class="text-muted">' + barcode + '</small></td>';
        rowsHtml += '<td><span class="badge bg-info text-dark">' + catName + '</span></td>';
        rowsHtml += '<td class="fw-bold">' + p.name + '</td>';
        rowsHtml += '<td><span class="badge ' + badgeClass + '">' + qty + '</span></td>';
        rowsHtml += '<td>' + buyPrice.toFixed(2) + '</td>';
        rowsHtml += '<td>' + sellPrice.toFixed(2) + '</td>';
        rowsHtml += '<td class="text-success fw-bold">' + profit + '</td>';
        rowsHtml += '<td>';
        rowsHtml += '<button class="btn btn-sm btn-warning me-1" onclick="openEditModalById(' + p.id + ')"><i class="fas fa-edit"></i></button>';
        rowsHtml += '<button class="btn btn-sm btn-danger me-1" onclick="handleDelete(' + p.id + ')"><i class="fas fa-trash"></i></button>';
        rowsHtml += '<button class="btn btn-sm btn-dark" onclick="printBarcodeLabelById(' + p.id + ')"><i class="fas fa-print"></i></button>';
        rowsHtml += '</td>';
        rowsHtml += '</tr>';
    }

    inventoryTable.innerHTML = rowsHtml;
}

async function loadEmployees() {
    try {
        var balances = await window.api.getEmployeesBalances();
        if (employeeBalancesTable && balances) {
            if (balances.length === 0) {
                employeeBalancesTable.innerHTML = '<tr><td colspan="3" class="text-muted py-3 text-center">لا يوجد موظفين مسجلين</td></tr>';
                return;
            }
            var rowsHtml = '';
            for (var i = 0; i < balances.length; i++) {
                var b = balances[i];
                var bal = Number(b.currentBalance) || 0;
                rowsHtml += '<tr>';
                rowsHtml += '<td>' + b.username + '</td>';
                rowsHtml += '<td class="fw-bold text-primary">' + bal.toFixed(2) + ' ج.م</td>';
                rowsHtml += '<td>';
                rowsHtml += '<button class="btn btn-sm btn-success" onclick="handleSettle(' + b.id + ')">تصفية العهدة</button>';
                rowsHtml += '</td>';
                rowsHtml += '</tr>';
            }
            employeeBalancesTable.innerHTML = rowsHtml;
        }
    } catch (err) {
        console.error("خطأ تحميل الموظفين:", err);
    }
}

function updateStats(products) {
    if (!products) return;
    var totalPurchase = 0;
    var totalProfit = 0;

    for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var qty = Number(p.qty) || 0;
        var buy = Number(p.purchase_price) || 0;
        var sell = Number(p.sell_price) || 0;
        totalPurchase = totalPurchase + (buy * qty);
        totalProfit = totalProfit + ((sell - buy) * qty);
    }

    if (totalPurchaseValueEl) totalPurchaseValueEl.innerText = totalPurchase.toFixed(2) + ' ج.م';
    if (totalExpectedProfitEl) totalExpectedProfitEl.innerText = totalProfit.toFixed(2) + ' ج.م';
    if (totalItemsCountEl) totalItemsCountEl.innerText = products.length;
}

// --- 5. البحث السريع ---
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        var term = e.target.value.toLowerCase().trim();
        var filtered = [];
        for (var i = 0; i < allProducts.length; i++) {
            var item = allProducts[i];
            var nameMatch = item.name && item.name.toLowerCase().indexOf(term) !== -1;
            var barcodeMatch = item.barcode && item.barcode.toLowerCase().indexOf(term) !== -1;
            if (nameMatch || barcodeMatch) {
                filtered.push(item);
            }
        }
        renderTable(filtered);
    });
}

// --- 6. التعديل والحذف والعهد ---

window.openEditModalById = function(id) {
    var product = null;
    for (var i = 0; i < allProducts.length; i++) {
        if (allProducts[i].id == id) {
            product = allProducts[i];
            break;
        }
    }
    if (product) {
        window.openEditModal(product);
    }
};


window.openEditModal = function(product) {
    if (!product) return;

    var editId = document.getElementById('edit-id');
    var editBarcode = document.getElementById('edit-barcode');
    var editName = document.getElementById('edit-name');
    var editQty = document.getElementById('edit-qty');
    var editPurchase = document.getElementById('edit-purchase');
    var editSell = document.getElementById('edit-sell');

    if (editId) editId.value = product.id;
    if (editBarcode) editBarcode.value = product.barcode || '';
    if (editName) editName.value = product.name;
    if (editQty) editQty.value = product.qty;
    if (editPurchase) editPurchase.value = product.purchase_price;
    if (editSell) editSell.value = product.sell_price;

    var modalDom = document.getElementById('editProductModal');
    if (modalDom) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            var inst = bootstrap.Modal.getInstance(modalDom);
            if (!inst) inst = new bootstrap.Modal(modalDom);
            inst.show();
        } else {
            showModalFallback(modalDom);
        }
    }
};

if (saveEditBtn) {
    saveEditBtn.addEventListener('click', async function() {
        var editId = document.getElementById('edit-id');
        var editBarcode = document.getElementById('edit-barcode');
        var editName = document.getElementById('edit-name');
        var editQty = document.getElementById('edit-qty');
        var editPurchase = document.getElementById('edit-purchase');
        var editSell = document.getElementById('edit-sell');

        if (!editName || !editName.value.trim()) {
            alert('يرجى كتابة اسم المنتج');
            return;
        }

        var product = {
            id: editId ? editId.value : '',
            barcode: editBarcode ? editBarcode.value.trim() : '',
            name: editName.value.trim(),
            qty: editQty ? (parseFloat(editQty.value) || 0) : 0,
            purchase_price: editPurchase ? (parseFloat(editPurchase.value) || 0) : 0,
            sell_price: editSell ? (parseFloat(editSell.value) || 0) : 0
        };

        try {
            var result = await window.api.updateProduct(product);
            if (result && result.success) {
                var modalDom = document.getElementById('editProductModal');
                if (modalDom) {
                    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                        var inst = bootstrap.Modal.getInstance(modalDom);
                        if (inst) inst.hide();
                    } else {
                        hideModalFallback(modalDom);
                    }
                }
                await loadInventory();
                alert('✅ تم التعديل وحفظ الباركود بنجاح');
            } else {
                alert('❌ فشل التعديل: ' + (result && result.error ? result.error : ''));
            }
        } catch (err) {
            console.error(err);
            alert('❌ خطأ أثناء الاتصال بالنظام');
        }
    });
}

window.handleDelete = async function(id) {
    if (confirm('هل أنت متأكد من المسح النهائي؟')) {
        var result = await window.api.deleteProduct(id);
        if (result && result.success) {
            loadInventory();
        }
    }
};

window.handleSettle = async function(userId) {
    if (confirm('هل تريد تصفية عهدة الموظف؟')) {
        var result = await window.api.settleUserSales(userId);
        if (result && result.success) {
            loadEmployees();
        }
    }
};

// --- 7. نماذج الإضافة (أقسام، منتجات، موظفين) ---

if (categoryForm) {
    categoryForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var nameInput = document.getElementById('categoryName');
        if (!nameInput || !nameInput.value.trim()) return;

        var result = await window.api.addCategory(nameInput.value.trim());
        if (result && result.success) {
            nameInput.value = '';
            await loadCategories();
            alert('✅ تم إضافة القسم بنجاح');
        } else {
            alert('❌ فشل إضافة القسم: قد يكون مكرراً');
        }
    });
}

if (productForm) {
    productForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var barcodeInput = document.getElementById('productBarcode');
        var catSelect = document.getElementById('productCategory');
        var nameInput = document.getElementById('productName');
        var qtyInput = document.getElementById('productQty');
        var purchaseInput = document.getElementById('purchasePrice');
        var sellInput = document.getElementById('sellPrice');

        if (!nameInput || !nameInput.value.trim()) {
            alert('يرجى كتابة اسم المنتج');
            return;
        }

        var product = {
            barcode: barcodeInput ? barcodeInput.value.trim() : '',
            category_id: catSelect ? catSelect.value : '',
            name: nameInput.value.trim(),
            qty: qtyInput ? (parseFloat(qtyInput.value) || 0) : 0,
            purchase_price: purchaseInput ? (parseFloat(purchaseInput.value) || 0) : 0,
            sell_price: sellInput ? (parseFloat(sellInput.value) || 0) : 0
        };

        var result = await window.api.addProduct(product);
        if (result && result.success) {
            productForm.reset();
            var container = document.getElementById('barcodeContainer');
            if (container) container.style.display = 'none';
            await loadInventory();
            alert('✅ تم إضافة المنتج بنجاح');
        } else {
            alert('❌ فشل إضافة المنتج: قد يكون الباركود مستخدماً');
        }
    });
}

if (userForm) {
    userForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var usernameInput = document.getElementById('newUsername');
        var passwordInput = document.getElementById('newPassword');

        if (!usernameInput || !passwordInput) return;

        var userData = {
            username: usernameInput.value.trim(),
            password: passwordInput.value
        };

        try {
            var result = await window.api.addUser(userData);
            if (result && result.success) {
                alert('✅ تم إضافة الموظف بنجاح');
                userForm.reset();
                await loadEmployees();
            } else {
                alert('❌ فشل إضافة الموظف: قد يكون الاسم مسجلاً من قبل');
            }
        } catch (err) {
            console.error("خطأ إضافة موظف:", err);
            alert('❌ حدث خطأ فني أثناء إضافة الموظف');
        }
    });
}

// --- 8. توليد وطباعة الباركود ---

var genBarcodeBtn = document.getElementById('genBarcodeBtn');
if (genBarcodeBtn) {
    genBarcodeBtn.addEventListener('click', function() {
        var code = '622' + Math.floor(Math.random() * 9000000000 + 1000000000);
        var barcodeInput = document.getElementById('productBarcode');
        var container = document.getElementById('barcodeContainer');

        if (barcodeInput) barcodeInput.value = code;
        if (container) container.style.display = 'block';

        if (typeof JsBarcode !== 'undefined') {
            JsBarcode("#barcodePreview", code, {
                format: "CODE128",
                width: 2,
                height: 40
            });
        }
    });
}

window.printBarcodeLabelById = function(id) {
    var product = null;
    for (var i = 0; i < allProducts.length; i++) {
        if (allProducts[i].id == id) {
            product = allProducts[i];
            break;
        }
    }
    if (product) {
        window.printBarcodeLabel(product.barcode);
    }
};
window.printBarcodeLabel = function(barcode) {
    if (!barcode) {
        alert("⚠️ هذا المنتج لا يحتوي على باركود لطباعته");
        return;
    }

    if (typeof JsBarcode === 'undefined') {
        alert("مكتبة توليد الباركود غير محملة");
        return;
    }

    var canvas = document.createElement('canvas');
    try {
        JsBarcode(canvas, barcode, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true,
            fontSize: 15,
            font: "monospace",
            textMargin: 2,
            margin: 2
        });

        var barcodeImg = canvas.toDataURL("image/png");

        var labelHtml = '<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<title>ملصق باركود</title>' +
            '<style>' +
            '@page { size: 38mm 25mm landscape; margin: 0; }' +
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            'body { width: 38mm; height: 25mm; overflow: hidden; display: flex; justify-content: center; align-items: center; background: #fff; margin: 0; padding: 1mm; }' +
            '.barcode-img { width: 36mm; max-height: 23mm; object-fit: contain; }' +
            '</style>' +
            '</head>' +
            '<body>' +
            '<img class="barcode-img" src="' + barcodeImg + '" />' +
            '</body>' +
            '</html>';

        // إرسال نوع الطباعة كملصق صراحة
        window.api.printReceipt({
            html: labelHtml,
            isLabel: true
        });

    } catch (err) {
        console.error(err);
        alert("مشكلة في توليد الباركود");
    }
};

// --- 9. بدء التشغيل التلقائي ---

async function init() {
    console.log("🚀 Initializing Nizam Jawla Admin...");
    setupTabs();
    setupModal();
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