import 'bootstrap/dist/css/bootstrap.rtl.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
// src/renderer/src/cashier-renderer.js - نظام جولة (الكاشير والبيع السريع)

var currentBill = [];
var allProducts = [];

var storeSettings = {
    shop_name: 'نظام جولة',
    shop_phone: '',
    receipt_header: 'فاتورة بيع نقدية',
    receipt_footer: 'شكراً لزيارتكم ونتشرف دائماً بخدمتكم'
};

// --- 1. جلب إعدادات المتجر المسجلة ---
async function loadStoreSettings() {
    try {
        if (window.api && window.api.getSettings) {
            var s = await window.api.getSettings();
            if (s && typeof s === 'object') {
                if (s.shop_name) storeSettings.shop_name = s.shop_name;
                if (s.shop_phone) storeSettings.shop_phone = s.shop_phone;
                if (s.receipt_header) storeSettings.receipt_header = s.receipt_header;
                if (s.receipt_footer) storeSettings.receipt_footer = s.receipt_footer;
            }
        }
    } catch (e) {
        console.error("خطأ قراءة الإعدادات:", e);
    }
}

// --- 2. توليد قالب الفاتورة الحرارية بالتنسيق وتوقيع المطور ---
function generateReceiptHTML(saleData) {
    var itemsRows = '';
    for (var i = 0; i < saleData.items.length; i++) {
        var it = saleData.items[i];
        var itemTotal = (Number(it.price) * Number(it.qty)).toFixed(2);
        itemsRows += '<tr style="border-bottom: 1px dotted #444;">' +
            '<td style="padding: 5px 0; text-align: right; font-weight: bold;">' + it.name + '</td>' +
            '<td style="padding: 5px 0; text-align: center;">' + it.qty + '</td>' +
            '<td style="padding: 5px 0; text-align: left; font-weight: bold;">' + itemTotal + '</td>' +
            '</tr>';
    }

    var now = new Date();
    var dateStr = now.toLocaleDateString('ar-EG');
    var timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    var grandTotal = Number(saleData.total).toFixed(2);

    var shopTitle = storeSettings.shop_name || 'نظام جولة';
    var shopHeader = storeSettings.receipt_header || 'فاتورة بيع نقدية';
    var shopPhone = storeSettings.shop_phone ? storeSettings.shop_phone : '';

    var html = '<!DOCTYPE html>' +
        '<html lang="ar" dir="rtl">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<style>' +
        '@page { size: 80mm auto; margin: 0; }' +
        '* { box-sizing: border-box; margin: 0; padding: 0; }' +
        'body { width: 76mm; margin: 0 auto; padding: 8px 4px; font-family: Tahoma, Arial, sans-serif; color: #000; background: #fff; direction: rtl; font-size: 12px; }' +
        '.header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px; }' +
        '.shop-title { font-size: 20px; font-weight: 900; margin-bottom: 3px; letter-spacing: 0.5px; }' +
        '.shop-subtitle { font-size: 12px; font-weight: bold; margin-bottom: 2px; }' +
        '.shop-phone-row { font-size: 11px; margin-top: 2px; font-family: monospace; font-weight: bold; }' +
        '.meta-info { font-size: 11px; margin-bottom: 6px; display: flex; justify-content: space-between; border-bottom: 1px dashed #000; padding-bottom: 4px; }' +
        'table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }' +
        'th { padding: 4px 0; font-size: 12px; border-bottom: 1.5px solid #000; }' +
        '.total-box { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; margin-top: 8px; }' +
        '.total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; }' +
        '.footer { text-align: center; margin-top: 10px; font-size: 11px; }' +
        '.client-msg { font-weight: bold; margin-bottom: 6px; }' +
        '.dev-signature { border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-size: 11px; line-height: 1.5; }' +
        '.dev-signature strong { font-size: 12px; }' +
        '.dev-phone { font-family: monospace; font-weight: bold; font-size: 12px; direction: ltr; display: inline-block; margin-top: 2px; }' +
        '</style>' +
        '</head>' +
        '<body>'
        // الترويسة العلوية: بيانات المتجر
        +
        '<div class="header">' +
        '<div class="shop-title">' + shopTitle + '</div>' +
        '<div class="shop-subtitle">' + shopHeader + '</div>' +
        (shopPhone ? '<div class="shop-phone-row">هاتف: ' + shopPhone + '</div>' : '') +
        '</div>'
        // وقت وتاريخ الفاتورة
        +
        '<div class="meta-info">' +
        '<span>التاريخ: ' + dateStr + '</span>' +
        '<span>الوقت: ' + timeStr + '</span>' +
        '</div>'
        // جدول تفاصيل المبيعات
        +
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th style="text-align: right;">الصنف</th>' +
        '<th style="text-align: center;">الكمية</th>' +
        '<th style="text-align: left;">المجموع</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' + itemsRows + '</tbody>' +
        '</table>'
        // صندوق الإجمالي
        +
        '<div class="total-box">' +
        '<div class="total-row">' +
        '<span>الإجمالي النهائي:</span>' +
        '<span>' + grandTotal + ' ج.م</span>' +
        '</div>' +
        '</div>'
        // التذييل وتوقيع المطور Amer
        +
        '<div class="footer">' +
        '<div class="client-msg">' + (storeSettings.receipt_footer || 'شكراً لزيارتكم ونتشرف دائماً بخدمتكم') + '</div>' +
        '<div class="dev-signature">' +
        '<div>تصميم وتطوير النظام: <strong>Amer</strong></div>' +
        '<div>للدعم الفني وتطوير الأنظمة: <span class="dev-phone">01152306375</span></div>' +
        '</div>' +
        '</div>' +
        '</body>' +
        '</html>';

    return html;
}

// --- 3. تحميل وعرض كروت المنتجات تلقائياً ---
async function loadProducts() {
    try {
        var products = await window.api.getAllProducts();
        allProducts = products || [];
        renderProductsGrid(allProducts);
    } catch (err) {
        console.error("خطأ تحميل المنتجات:", err);
    }
}

function renderProductsGrid(products) {
    var display = document.getElementById('productsDisplay');
    if (!display) return;

    if (!products || products.length === 0) {
        display.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="fas fa-box-open fa-3x mb-2"></i><p class="fs-5">لا توجد منتجات مسجلة بالمخزن</p></div>';
        return;
    }

    var html = '';
    for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var isOutOfStock = Number(p.qty) <= 0;
        var opacity = isOutOfStock ? 'opacity: 0.5;' : '';
        var price = (Number(p.sell_price) || 0).toFixed(2);
        var catName = p.category_name ? p.category_name : 'عام';
        var stockBadge = isOutOfStock ?
            '<span class="badge bg-danger">نفذت الكمية</span>' :
            '<span class="badge bg-light text-dark border">' + p.qty + ' متاح</span>';

        html += '<div class="col-md-3 col-sm-4 col-6">' +
            '<div class="card h-100 shadow-sm p-2 text-center border" style="cursor: pointer; border-radius: 12px; transition: 0.15s; background: #fff; ' + opacity + '" onclick="handleProductCardClick(' + p.id + ')">' +
            '<div class="fw-bold text-dark text-truncate mb-1" title="' + p.name + '">' + p.name + '</div>' +
            '<small class="text-muted d-block mb-2">' + catName + '</small>' +
            '<div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">' +
            '<span class="fw-bold text-primary">' + price + ' ج.م</span>' +
            stockBadge +
            '</div>' +
            '</div>' +
            '</div>';
    }
    display.innerHTML = html;
}

window.handleProductCardClick = function(id) {
    for (var i = 0; i < allProducts.length; i++) {
        if (allProducts[i].id == id) {
            var product = allProducts[i];
            if (Number(product.qty) <= 0) {
                alert("⚠️ هذا المنتج غير متوفر في المخزن حالياً");
                return;
            }
            addToBill(product);
            break;
        }
    }
};

// --- 4. الفلترة الفورية ومسح الباركود ---
var barcodeInput = document.getElementById('barcodeInput');

if (barcodeInput) {
    barcodeInput.addEventListener('input', function(e) {
        var term = e.target.value.toLowerCase().trim();
        if (!term) {
            renderProductsGrid(allProducts);
            return;
        }

        var filtered = [];
        for (var i = 0; i < allProducts.length; i++) {
            var item = allProducts[i];
            var nameMatch = item.name && item.name.toLowerCase().indexOf(term) !== -1;
            var barcodeMatch = item.barcode && item.barcode.toLowerCase().indexOf(term) !== -1;
            if (nameMatch || barcodeMatch) {
                filtered.push(item);
            }
        }
        renderProductsGrid(filtered);
    });

    barcodeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var code = barcodeInput.value.trim();
            if (!code) return;

            var match = null;
            for (var i = 0; i < allProducts.length; i++) {
                if (allProducts[i].barcode && allProducts[i].barcode === code) {
                    match = allProducts[i];
                    break;
                }
            }
            if (!match) {
                for (var j = 0; j < allProducts.length; j++) {
                    if (allProducts[j].name && allProducts[j].name.toLowerCase() === code.toLowerCase()) {
                        match = allProducts[j];
                        break;
                    }
                }
            }

            if (match) {
                if (Number(match.qty) <= 0) {
                    alert("⚠️ هذا المنتج نفدت كميته من المخزن");
                } else {
                    addToBill(match);
                }
                barcodeInput.value = '';
                renderProductsGrid(allProducts);
            } else {
                alert("❌ الصنف غير موجود: " + code);
                barcodeInput.select();
            }
        }
    });
}

// --- 5. إدارة الفاتورة الحالية والحسابات ---
window.addToBill = function(product) {
    if (!product) return;
    var existing = null;
    for (var i = 0; i < currentBill.length; i++) {
        if (currentBill[i].id == product.id) {
            existing = currentBill[i];
            break;
        }
    }

    var availableStock = Number(product.qty) || 0;

    if (existing) {
        if (existing.qty + 1 > availableStock) {
            alert("⚠️ الكمية المطلوبة تتجاوز رصيد المخزن المتاح (" + availableStock + ")");
            return;
        }
        existing.qty = existing.qty + 1;
    } else {
        currentBill.push({
            id: product.id,
            name: product.name,
            price: Number(product.sell_price) || 0,
            qty: 1,
            maxQty: availableStock
        });
    }

    renderBill();
};

window.changeQty = function(index, delta) {
    var item = currentBill[index];
    if (!item) return;

    var newQty = item.qty + delta;
    if (newQty <= 0) {
        window.removeFromBill(index);
        return;
    }

    if (item.maxQty && newQty > item.maxQty) {
        alert("⚠️ أقصى كمية متاحة في المخزن هي " + item.maxQty);
        return;
    }

    item.qty = newQty;
    renderBill();
};

window.removeFromBill = function(index) {
    currentBill.splice(index, 1);
    renderBill();
};

function renderBill() {
    var tbody = document.getElementById('billTableBody');
    var grandTotalEl = document.getElementById('grandTotal');
    if (!tbody) return;

    var total = 0;
    var rowsHtml = '';

    for (var i = 0; i < currentBill.length; i++) {
        var it = currentBill[i];
        var itemTotal = it.price * it.qty;
        total = total + itemTotal;

        rowsHtml += '<tr>' +
            '<td class="fw-bold">' + it.name + '</td>' +
            '<td class="text-center">' +
            '<div class="d-flex align-items-center justify-content-center gap-1">' +
            '<button class="btn btn-sm btn-outline-secondary py-0 px-2 fw-bold" onclick="changeQty(' + i + ', -1)">-</button>' +
            '<span class="fw-bold px-2">' + it.qty + '</span>' +
            '<button class="btn btn-sm btn-outline-secondary py-0 px-2 fw-bold" onclick="changeQty(' + i + ', 1)">+</button>' +
            '</div>' +
            '</td>' +
            '<td class="text-center fw-bold text-primary">' + itemTotal.toFixed(2) + '</td>' +
            '<td class="text-center">' +
            '<button class="btn btn-sm text-danger border-0 bg-transparent p-0" onclick="removeFromBill(' + i + ')">' +
            '<i class="fas fa-times-circle"></i>' +
            '</button>' +
            '</td>' +
            '</tr>';
    }

    tbody.innerHTML = rowsHtml;
    if (grandTotalEl) grandTotalEl.innerText = total.toFixed(2) + ' ج.م';
}

// --- 6. إنهاء عملية البيع والطباعة المباشرة ---
var checkoutBtn = document.getElementById('checkoutBtn');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', async function() {
        if (!currentBill || currentBill.length === 0) {
            alert("⚠️ الفاتورة فارغة، يرجى اختيار منتجات أولاً");
            if (barcodeInput) barcodeInput.focus();
            return;
        }

        checkoutBtn.disabled = true;

        var total = 0;
        for (var i = 0; i < currentBill.length; i++) {
            total = total + (currentBill[i].price * currentBill[i].qty);
        }

        var saleData = {
            total: total,
            items: currentBill,
            date: new Date().toISOString()
        };

        try {
            var result = await window.api.completeSale(saleData);
            if (result && result.success) {
                var shouldPrint = document.getElementById('shouldPrintReceipt');
                if (shouldPrint && shouldPrint.checked) {
                    var receiptHtml = generateReceiptHTML(saleData);
                    window.api.printReceipt(receiptHtml);
                }

                currentBill = [];
                renderBill();
                await Promise.all([loadProducts(), loadRecentSales()]);
                if (barcodeInput) {
                    barcodeInput.value = '';
                    barcodeInput.focus();
                }
            } else {
                alert("❌ فشل في إتمام البيع: " + (result && result.message ? result.message : ''));
            }
        } catch (err) {
            console.error("خطأ البيع:", err);
            alert("❌ حدث خطأ غير متوقع أثناء البيع");
        } finally {
            checkoutBtn.disabled = false;
        }
    });
}

var cancelBillBtn = document.getElementById('cancelBill');
if (cancelBillBtn) {
    cancelBillBtn.addEventListener('click', function() {
        if (currentBill.length > 0) {
            if (confirm("هل تريد تفريغ الفاتورة الحالية؟")) {
                currentBill = [];
                renderBill();
                if (barcodeInput) barcodeInput.focus();
            }
        }
    });
}

// --- 7. تحميل العهدة والمبيعات السابقة ---
async function loadRecentSales() {
    var tableBody = document.getElementById('myRecentSalesTable');
    var shiftTotalEl = document.getElementById('myShiftTotal');
    if (!tableBody) return;

    try {
        var sales = await window.api.getMyRecentSales();
        var total = 0;
        var rowsHtml = '';

        if (sales && sales.length > 0) {
            for (var i = 0; i < sales.length; i++) {
                var s = sales[i];
                var amt = Number(s.total_amount) || 0;
                total = total + amt;
                var time = new Date(s.sale_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                rowsHtml += '<tr><td>#' + s.id + '</td><td>' + time + '</td><td class="fw-bold text-success">' + amt.toFixed(2) + '</td></tr>';
            }
        }
        tableBody.innerHTML = rowsHtml;
        if (shiftTotalEl) shiftTotalEl.innerText = total.toFixed(2) + ' ج.م';
    } catch (err) {
        console.error("خطأ جلب المبيعات:", err);
    }
}

// --- 8. بدء التشغيل التلقائي ---
window.addEventListener('DOMContentLoaded', async function() {
    await loadStoreSettings();
    await loadProducts();
    await loadRecentSales();
    if (barcodeInput) barcodeInput.focus();
});