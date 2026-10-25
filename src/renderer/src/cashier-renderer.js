import 'bootstrap/dist/css/bootstrap.rtl.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
// cashier-renderer.js
let currentBill = [];
let allProducts = [];
let categories = [];
let selectedCategoryId = 'all';

// إعدادات المتجر الافتراضية (يتم تحديثها تلقائياً من الـ DB)
let storeSettings = {
    shop_name: 'نظام جولة',
    shop_phone: '01152306375',
    receipt_header: 'فاتورة بيع',
    receipt_footer: 'شكراً لزيارتكم ونتشرف بخدمتكم دائماً!'
};

// --- ١. جلب إعدادات المتجر ---
async function loadStoreSettings() {
    try {
        const settings = await window.api.getSettings();
        if (settings && Object.keys(settings).length > 0) {
            storeSettings = {...storeSettings, ...settings };
        }
    } catch (err) {
        console.error("Error loading store settings:", err);
    }
}

// --- ٢. توليد قالب الفاتورة للطباعة الحسابية ---
function generateReceiptHTML(saleData) {
    const itemsHtml = saleData.items.map(item => `
        <tr style="border-bottom: 1px dotted #ccc;">
            <td style="padding: 4px 0; text-align: right;">${item.name}</td>
            <td style="padding: 4px; text-align: center;">${item.qty}</td>
            <td style="padding: 4px 0; text-align: left;">${(item.price * item.qty).toFixed(2)}</td>
        </tr>
    `).join('');

    const savedPrinter = localStorage.getItem('pos_printer_name') || '';
    window.api.printReceipt({
        html: generateReceiptHTML(saleData),
        printerName: savedPrinter,
        isLabel: false
    });

    return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                @page {
                    size: ${savedPrinterWidth} auto;
                    margin: 0;
                }
                body {
                    width: ${savedPrinterWidth};
                    margin: 0;
                    padding: 8px;
                    font-family: 'Segoe UI', Tahoma, sans-serif;
                    color: #000;
                    background: #fff;
                    box-sizing: border-box;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px;">
                <h2 style="margin: 0; font-size: 18px; font-weight: bold;">${storeSettings.shop_name}</h2>
                <p style="margin: 2px 0 0; font-size: 12px;">${storeSettings.receipt_header}</p>
            </div>

            <div style="font-size: 11px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                <span>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</span>
                <span>الوقت: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <table>
                <thead>
                    <tr style="border-bottom: 1.5px solid #000;">
                        <th style="text-align: right; padding: 4px 0;">الصنف</th>
                        <th style="text-align: center; padding: 4px;">الكمية</th>
                        <th style="text-align: left; padding: 4px 0;">السعر</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>

            <div style="border-top: 1.5px solid #000; padding-top: 6px; margin-top: 6px;">
                <h3 style="display: flex; justify-content: space-between; margin: 0; font-size: 15px; font-weight: bold;">
                    <span>الإجمالي:</span>
                    <span>${saleData.total.toFixed(2)} ج.م</span>
                </h3>
            </div>

            <div style="text-align: center; border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-size: 11px;">
                <p style="margin: 0; font-weight: bold;">${storeSettings.receipt_footer}</p>
                ${storeSettings.shop_phone ? `<p style="margin: 3px 0 0; font-size: 12px; font-family: monospace;">📞 ${storeSettings.shop_phone}</p>` : ''}
            </div>
        </body>
        </html>
    `;
}

// --- ٣. تحميل الفواتير الأخيرة للوردية الحالية ---
async function loadRecentSales() {
    const tableBody = document.getElementById('myRecentSalesTable');
    const shiftTotalEl = document.getElementById('myShiftTotal');

    try {
        const sales = await window.api.getMyRecentSales();
        let total = 0;

        tableBody.innerHTML = sales.map(s => {
            total += Number(s.total_amount);
            const time = new Date(s.sale_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            return `<tr><td>#${s.id}</td><td>${time}</td><td class="fw-bold text-success">${Number(s.total_amount).toFixed(2)}</td></tr>`;
        }).join('');

        shiftTotalEl.innerText = `${total.toFixed(2)} ج.م`;
    } catch (err) {
        console.error("Error loading recent sales:", err);
    }
}

// --- ٤. تحميل وعرض شبكة المنتجات والأقسام ---
async function loadCatalog() {
    try {
        [allProducts, categories] = await Promise.all([
            window.api.getAllProducts(),
            window.api.getCategories()
        ]);
        renderCategoryFilter();
        renderProductsGrid();
    } catch (err) {
        console.error("Error loading catalog:", err);
    }
}

function renderCategoryFilter() {
    const filterBar = document.getElementById('categoryFilterBar');
    if (!filterBar) return;

    let html = `
        <div class="category-pill ${selectedCategoryId === 'all' ? 'active' : ''}" onclick="selectCategory('all')">
            <i class="fas fa-th-large me-1"></i> كل المنتجات
        </div>
    `;

    html += categories.map(cat => `
        <div class="category-pill ${selectedCategoryId === cat.id ? 'active' : ''}" onclick="selectCategory(${cat.id})">
            ${cat.name}
        </div>
    `).join('');

    filterBar.innerHTML = html;
}

window.selectCategory = (catId) => {
    selectedCategoryId = catId;
    renderCategoryFilter();
    renderProductsGrid();
};

function renderProductsGrid() {
    const grid = document.getElementById('productsDisplay');
    if (!grid) return;

    const filtered = selectedCategoryId === 'all'
        ? allProducts
        : allProducts.filter(p => p.category_id === selectedCategoryId);

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="fas fa-box-open fa-3x mb-2"></i><p>لا توجد منتجات مسجلة في هذا القسم</p></div>';
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const isOutOfStock = p.qty <= 0;
        return `
            <div class="col-md-3 col-sm-4 col-6">
                <div class="product-card ${isOutOfStock ? 'opacity-50' : ''}" onclick='handleProductClick(${JSON.stringify(p).replace(/'/g, "&apos;")})'>
                    <div>
                        <div class="fw-bold text-dark text-truncate" title="${p.name}">${p.name}</div>
                        <small class="text-muted d-block">${p.category_name || 'عام'}</small>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                        <span class="text-primary fw-bold">${Number(p.sell_price).toFixed(2)} ج.م</span>
                        <span class="badge ${isOutOfStock ? 'bg-danger' : 'bg-light text-dark border'}">${p.qty} في المخزن</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.handleProductClick = (product) => {
    if (product.qty <= 0) {
        alert("⚠️ نفدت كمية هذا المنتج من المخزن!");
        return;
    }
    window.addToBill(product);
};

// --- ٥. دعم قارئ الباركود والبحث الفوري (Barcode Scanner UX) ---
const barcodeInput = document.getElementById('barcodeInput');
const suggestionsBox = document.getElementById('suggestionsBox');

// الاستماع للضغط على Enter (النمط القياسي لماسحات الباركود)
barcodeInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const code = barcodeInput.value.trim();
        if (!code) return;

        // 1. فحص المطابقة المباشرة في الذاكرة بالباركود
        let match = allProducts.find(p => p.barcode && p.barcode === code);

        // 2. فحص المطابقة المباشرة بالاسم
        if (!match) {
            match = allProducts.find(p => p.name.toLowerCase() === code.toLowerCase());
        }

        // 3. البحث في قاعدة البيانات إذا لم يتوفر محلياً
        if (!match) {
            const results = await window.api.searchProductsSuggestions(code);
            if (results && results.length > 0) {
                match = results.find(p => p.barcode === code) || results[0];
            }
        }

        if (match) {
            window.addToBill(match);
            barcodeInput.value = '';
            suggestionsBox.style.display = 'none';
        } else {
            alert(`❌ الصنف غير موجود: ${code}`);
            barcodeInput.select();
        }
    }
});

// إظهار قائمة الاقتراحات أثناء الكتابة اليدوية
barcodeInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    if (query.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    const products = await window.api.searchProductsSuggestions(query);
    if (products.length > 0) {
        suggestionsBox.innerHTML = products.map(p => `
            <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
                    onclick='addToBillFromSuggestion(${JSON.stringify(p).replace(/'/g, "&apos;")})'>
                <div>
                    <strong>${p.name}</strong>
                    <br><small class="text-muted">${p.barcode || 'بدون باركود'}</small>
                </div>
                <span class="badge bg-primary fs-6">${Number(p.sell_price).toFixed(2)} ج.م</span>
            </button>
        `).join('');
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
});

window.addToBillFromSuggestion = (product) => {
    window.addToBill(product);
    barcodeInput.value = '';
    suggestionsBox.style.display = 'none';
    barcodeInput.focus();
};

// --- ٦. إدارة الفاتورة الحالية والحسابات ---
window.addToBill = (product) => {
    const existing = currentBill.find(item => item.id === product.id);
    const stockAvailable = product.qty !== undefined ? product.qty : Infinity;

    if (existing) {
        if (existing.qty + 1 > stockAvailable) {
            alert(`⚠️ الكمية المطلوبة تتجاوز رصيد المخزن المتاح (${stockAvailable})`);
            return;
        }
        existing.qty += 1;
    } else {
        if (stockAvailable < 1) {
            alert(`⚠️ هذا المنتج غير متوفر في المخزن حالياً`);
            return;
        }
        currentBill.push({
            id: product.id,
            name: product.name,
            price: Number(product.sell_price),
            qty: 1,
            maxQty: stockAvailable
        });
    }

    renderBill();
};

window.changeQty = (index, delta) => {
    const item = currentBill[index];
    if (!item) return;

    const newQty = item.qty + delta;
    if (newQty <= 0) {
        window.removeFromBill(index);
        return;
    }

    if (item.maxQty !== undefined && newQty > item.maxQty) {
        alert(`⚠️ أقصى كمية متاحة في المخزن هي ${item.maxQty}`);
        return;
    }

    item.qty = newQty;
    renderBill();
};

window.removeFromBill = (index) => {
    currentBill.splice(index, 1);
    renderBill();
};

function renderBill() {
    const tbody = document.getElementById('billTableBody');
    tbody.innerHTML = currentBill.map((item, index) => `
        <tr>
            <td class="fw-bold">${item.name}</td>
            <td class="text-center">
                <div class="d-flex align-items-center justify-content-center gap-1">
                    <button class="btn btn-sm btn-outline-secondary qty-btn" onclick="changeQty(${index}, -1)">-</button>
                    <span class="fw-bold px-1">${item.qty}</span>
                    <button class="btn btn-sm btn-outline-secondary qty-btn" onclick="changeQty(${index}, 1)">+</button>
                </div>
            </td>
            <td class="text-center fw-bold text-primary">${(item.price * item.qty).toFixed(2)}</td>
            <td class="text-center">
                <button class="btn btn-sm text-danger p-0 border-0" onclick="removeFromBill(${index})" title="حذف الصنف">
                    <i class="fas fa-times-circle"></i>
                </button>
            </td>
        </tr>
    `).join('');

    const total = currentBill.reduce((sum, i) => sum + (i.price * i.qty), 0);
    document.getElementById('grandTotal').innerText = `${total.toFixed(2)} ج.م`;
}

// --- ٧. إنهاء البيع وإفراغ السلة ---
document.getElementById('checkoutBtn').addEventListener('click', async () => {
    if (currentBill.length === 0) {
        alert("⚠️ الفاتورة فارغة، يرجى إضافة منتجات أولاً");
        barcodeInput.focus();
        return;
    }

    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> جاري الحفظ...';

    const saleData = {
        total: currentBill.reduce((sum, i) => sum + (i.price * i.qty), 0),
        items: currentBill,
        date: new Date().toISOString()
    };

    try {
        const result = await window.api.completeSale(saleData);
        if (result.success) {
            const shouldPrint = document.getElementById('shouldPrintReceipt').checked;
            if (shouldPrint) {
                const html = generateReceiptHTML(saleData);
                window.api.printReceipt(html);
            }

            currentBill = [];
            renderBill();
            await Promise.all([loadRecentSales(), loadCatalog()]);
            barcodeInput.value = '';
            barcodeInput.focus();
        } else {
            alert("❌ فشل في إتمام البيع: " + (result.message || "خطأ غير معروف"));
        }
    } catch (err) {
        console.error("Sale error:", err);
        alert("❌ حدث خطأ غير متوقع أثناء البيع");
    } finally {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = '<i class="fas fa-check-circle me-1"></i> إنهاء وبيع';
    }
});

document.getElementById('cancelBill').addEventListener('click', () => {
    if (currentBill.length > 0) {
        if (confirm("هل أنت متأكد من إلغاء وتفريغ الفاتورة الحالية؟")) {
            currentBill = [];
            renderBill();
            barcodeInput.focus();
        }
    }
});

// تهيئة الشاشة عند الإقلاع
window.addEventListener('DOMContentLoaded', async () => {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('ar-EG', {
            weekday: 'short',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
    }

    await loadStoreSettings();
    await loadRecentSales();
    await loadCatalog();
    barcodeInput.focus();
});