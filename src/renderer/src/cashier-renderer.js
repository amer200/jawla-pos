// cashier-renderer.js
let currentBill = [];

// --- وظيفة توليد شكل الفاتورة للطباعة ---
function generateReceiptHTML(saleData) {
    const itemsHtml = saleData.items.map(item => `
        <tr>
            <td style="padding: 5px 0;">${item.name}</td>
            <td style="padding: 5px; text-align: center;">${item.qty}</td>
            <td style="padding: 5px; text-align: left;">${(item.price * item.qty).toFixed(2)}</td>
        </tr>
    `).join('');

    return `
        <div style="width: 80mm; font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 10px; color: #000; background: #fff;">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px;">
                <h2 style="margin: 0; font-size: 24px; text-transform: uppercase;"> جوجو</h2>
                <p style="margin: 5px 0 0; font-size: 14px; font-weight: bold;">فاتورة بيع</p>
            </div>

            <div style="font-size: 12px; margin-bottom: 10px;">
                <span>التاريخ: ${new Date().toLocaleString('ar-EG')}</span>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 10px;">
                <thead>
                    <tr style="border-bottom: 1px dashed #000;">
                        <th style="text-align: right; padding: 5px 0;">الصنف</th>
                        <th style="text-align: center;">كمية</th>
                        <th style="text-align: left;">السعر</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>

            <div style="border-top: 1px solid #000; padding-top: 10px; margin-bottom: 20px;">
                <h3 style="display: flex; justify-content: space-between; margin: 0; font-size: 18px;">
                    <span>الإجمالي النهائي:</span>
                    <span>${saleData.total.toFixed(2)} ج.م</span>
                </h3>
            </div>

            <div style="text-align: center; border-top: 1px dashed #000; pt: 10px; font-size: 12px;">
                <p style="margin: 10px 0 5px; font-weight: bold;">شكراً لزيارتكم!</p>
                <p style="margin: 0;">بواسطة: <strong>نظام جولة</strong></p>
                <p style="margin: 5px 0 0; font-family: monospace; font-size: 14px;">📞 ${"01152306375"}</p>
            </div>
        </div>
    `;
}

// --- ١. وظيفة عرض الفواتير الأخيرة (العهدة) ---
async function loadRecentSales() {
    const tableBody = document.getElementById('myRecentSalesTable');
    const shiftTotalEl = document.getElementById('myShiftTotal');

    try {
        const sales = await window.api.getMyRecentSales();
        let total = 0;

        tableBody.innerHTML = sales.map(s => {
            total += s.total_amount;
            const time = new Date(s.sale_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            return `<tr><td>#${s.id}</td><td>${time}</td><td class="fw-bold">${s.total_amount.toFixed(2)}</td></tr>`;
        }).join('');

        shiftTotalEl.innerText = `${total.toFixed(2)} ج.م`;
    } catch (err) { console.error("Error loading recent sales:", err); }
}

// --- ٢. نظام البحث والاقتراحات ---
const barcodeInput = document.getElementById('barcodeInput');
const suggestionsBox = document.getElementById('suggestionsBox');

barcodeInput.addEventListener('input', async(e) => {
    const query = e.target.value.trim();
    if (query.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    const products = await window.api.searchProductsSuggestions(query);
    if (products.length > 0) {
        suggestionsBox.innerHTML = products.map(p => `
            <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
                    onclick='addToBill(${JSON.stringify(p)})'>
                <div><strong>${p.name}</strong><br><small>${p.barcode}</small></div>
                <span class="badge bg-primary">${p.sell_price.toFixed(2)} ج.م</span>
            </button>
        `).join('');
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
});

window.addToBill = (product) => {
    const existing = currentBill.find(item => item.id === product.id);
    if (existing) { existing.qty += 1; } else { currentBill.push({ id: product.id, name: product.name, price: product.sell_price, qty: 1 }); }

    barcodeInput.value = '';
    suggestionsBox.style.display = 'none';
    renderBill();
};

// --- ٣. إنهاء البيع والطباعة ---
document.getElementById('checkoutBtn').addEventListener('click', async() => {
    if (currentBill.length === 0) return;

    const saleData = {
        total: currentBill.reduce((sum, i) => sum + (i.price * i.qty), 0),
        items: currentBill,
        date: new Date().toISOString()
    };

    const result = await window.api.completeSale(saleData);
    if (result.success) {
        // التحقق من خيار الطباعة التلقائية
        const shouldPrint = document.getElementById('shouldPrintReceipt').checked;
        if (shouldPrint) {
            const html = generateReceiptHTML(saleData);
            window.api.printReceipt(html); // نداء دالة الطباعة من الـ Preload
        }

        alert("✅ تم البيع بنجاح");
        currentBill = [];
        renderBill();
        await loadRecentSales();
        barcodeInput.focus();
    } else {
        alert("❌ فشل في إتمام البيع: " + (result.message || "خطأ غير معروف"));
    }
});

// --- ٤. حذف الفاتورة (السلة) ---
document.getElementById('cancelBill').addEventListener('click', () => {
    if (currentBill.length > 0) {
        if (confirm("هل أنت متأكد من مسح الفاتورة الحالية؟")) {
            currentBill = [];
            renderBill();
            barcodeInput.focus();
        }
    }
});

function renderBill() {
    document.getElementById('billTableBody').innerHTML = currentBill.map((item, index) => `
        <tr>
            <td>${item.name}</td>
            <td class="text-center">${item.qty}</td>
            <td class="text-center">${(item.price * item.qty).toFixed(2)}</td>
            <td><button class="btn btn-sm text-danger" onclick="removeFromBill(${index})">x</button></td>
        </tr>
    `).join('');
    const total = currentBill.reduce((sum, i) => sum + (i.price * i.qty), 0);
    document.getElementById('grandTotal').innerText = `${total.toFixed(2)} ج.م`;
}

window.removeFromBill = (i) => {
    currentBill.splice(i, 1);
    renderBill();
};

window.addEventListener('DOMContentLoaded', () => {
    loadRecentSales();
    barcodeInput.focus();
});