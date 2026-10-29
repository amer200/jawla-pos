import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import bcrypt from 'bcryptjs'
import { db, initDB } from './database'

let loginWindow = null,
    adminWindow = null,
    cashierWindow = null;

let currentSessionUser = null;

function loadWindowRoute(window, route) {
    const fileName = (route === 'admin') ? 'index.html' : `${route.replace('/', '')}.html`;
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        const devPath = (route === 'admin') ? '' : route;
        window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${devPath}`);
    } else {
        window.loadFile(join(__dirname, `../renderer/${fileName}`));
    }
}

function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 450,
        height: 600,
        resizable: false,
        frame: false,
        show: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true
        }
    });

    loadWindowRoute(loginWindow, 'login');
    loginWindow.once('ready-to-show', () => loginWindow.show());
}

function createAdminWindow() {
    adminWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true
        }
    });

    loadWindowRoute(adminWindow, 'admin');
    return adminWindow;
}

function createCashierWindow() {
    cashierWindow = new BrowserWindow({
        width: 1366,
        height: 800,
        show: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true
        }
    });

    loadWindowRoute(cashierWindow, 'cashier');
    return cashierWindow;
}

app.whenReady().then(() => {
    initDB();

    // --- المصادقة وتسجيل الدخول ---
    ipcMain.handle('auth:login', async(event, { username, password }) => {
        try {
            const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
            if (!user) {
                return { success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" };
            }

            let isMatch = false;

            // التحقق سواء كانت مشفرة بـ bcrypt أو نص صريح قديم
            if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
                isMatch = bcrypt.compareSync(password, user.password);
            } else {
                // ترقية الحسابات القديمة تلقائياً إلى تشفير bcrypt
                if (user.password === password) {
                    isMatch = true;
                    const newHash = bcrypt.hashSync(password, 10);
                    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHash, user.id);
                }
            }

            if (isMatch) {
                currentSessionUser = {
                    id: user.id,
                    username: user.username,
                    role: user.role
                };

                let targetWindow = null;
                if (user.role === 'admin') {
                    targetWindow = createAdminWindow();
                } else {
                    targetWindow = createCashierWindow();
                }

                // عرض النافذة الجديدة وإغلاق نافذة تسجيل الدخول بسلاسة
                targetWindow.once('ready-to-show', () => {
                    targetWindow.show();
                    if (loginWindow && !loginWindow.isDestroyed()) {
                        loginWindow.close();
                        loginWindow = null;
                    }
                });

                return { success: true, role: user.role, username: user.username };
            }

            return { success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" };
        } catch (err) {
            console.error("Login Handler Error:", err);
            return { success: false, message: "خطأ تقني أثناء التحقق من البيانات" };
        }
    });

    // --- إدارة الأقسام ---
    ipcMain.handle('get-categories', () => db.prepare('SELECT * FROM categories').all());

    ipcMain.handle('add-category', (e, name) => {
        try {
            db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // --- إدارة المنتجات والمخزن ---
    ipcMain.handle('get-all-products', () => {
        return db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC').all();
    });

    ipcMain.handle('add-product', (e, p) => {
        try {
            db.prepare(`
                INSERT INTO products (barcode, name, category_id, qty, purchase_price, sell_price)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(p.barcode || null, p.name, p.category_id || null, p.qty, p.purchase_price, p.sell_price);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // تحديث المنتج مع حماية الباركود من المسح العرضي
    ipcMain.handle('update-product', (e, p) => {
        try {
            const existing = db.prepare('SELECT barcode, category_id FROM products WHERE id = ?').get(p.id);
            if (!existing) return { success: false, error: 'المنتج غير موجود' };

            // إذا تُرك حقل الباركود فارغاً، نحتفظ بالباركود المسجل مسبقاً في الداتابيز
            let barcodeToSave = existing.barcode;
            if (p.barcode !== undefined && p.barcode !== null && String(p.barcode).trim() !== '') {
                barcodeToSave = String(p.barcode).trim();
            }

            const categoryToSave = (p.category_id !== undefined && p.category_id !== null && p.category_id !== '') ?
                p.category_id :
                existing.category_id;

            db.prepare(`
                UPDATE products 
                SET name = ?, barcode = ?, category_id = ?, qty = ?, purchase_price = ?, sell_price = ?
                WHERE id = ?
            `).run(p.name, barcodeToSave, categoryToSave, p.qty, p.purchase_price, p.sell_price, p.id);

            return { success: true };
        } catch (err) {
            console.error('Update Product Error:', err);
            return { success: false, error: err.message };
        }
    });

    // معالج الطباعة الآمن والشامل
    // معالج الطباعة الموحد: يفرّق تلقائياً بين الفاتورة والملصق
    ipcMain.on('print-receipt', (event, payload) => {
        let receiptHtml = '';
        let printerName = '';
        let isLabel = false;

        if (typeof payload === 'string') {
            receiptHtml = payload;
            isLabel = receiptHtml.includes('38mm') || receiptHtml.includes('ملصق باركود');
        } else if (payload && typeof payload === 'object') {
            receiptHtml = payload.html || '';
            printerName = payload.printerName || '';
            isLabel = payload.isLabel || receiptHtml.includes('38mm') || receiptHtml.includes('ملصق باركود');
        }

        if (!receiptHtml) return;

        const printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        const encodedData = encodeURIComponent(receiptHtml);
        printWindow.loadURL(`data:text/html;charset=utf-8,${encodedData}`);

        printWindow.webContents.on('did-finish-load', () => {
            setTimeout(() => {
                const printOptions = {
                    silent: true,
                    printBackground: true,
                    color: false,
                    margin: { marginType: 'none' }
                };

                if (isLabel) {
                    // مقاس ستيكر الباركود: 38 مم عرض × 25 مم ارتفاع
                    printOptions.pageSize = { width: 38000, height: 25000 };
                } else {
                    // مقاس الفاتورة: 80 مم عرض × 200 مم ارتفاع
                    printOptions.pageSize = { width: 80000, height: 200000 };
                }

                if (printerName && printerName.trim() !== '') {
                    printOptions.deviceName = printerName.trim();
                }

                printWindow.webContents.print(printOptions, (success, failureReason) => {
                    if (!success) console.error('Printing failed:', failureReason);
                    printWindow.close();
                });
            }, 250);
        });
    });
    ipcMain.handle('delete-product', (e, id) => {
        try {
            db.prepare('DELETE FROM products WHERE id = ?').run(id);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // --- الكاشير والمبيعات ---
    ipcMain.handle('search-products-suggestions', (event, query) => {
        if (!query) return [];
        return db.prepare(`
            SELECT * FROM products 
            WHERE (name LIKE ? OR barcode LIKE ?) AND qty > 0
            LIMIT 10
        `).all(`%${query}%`, `%${query}%`);
    });

    ipcMain.handle('get-my-recent-sales', () => {
        try {
            if (!currentSessionUser) return [];
            return db.prepare(`
                SELECT id, total_amount, sale_date 
                FROM sales 
                WHERE user_id = ? AND is_settled = 0 
                ORDER BY id DESC
            `).all(currentSessionUser.id);
        } catch (err) {
            return [];
        }
    });

    ipcMain.handle('complete-sale', (event, saleData) => {
        try {
            if (!currentSessionUser) {
                return { success: false, message: "انتهت الجلسة، يرجى إعادة تسجيل الدخول مجدداً" };
            }
            if (!saleData || !saleData.items || saleData.items.length === 0) {
                return { success: false, message: "لا توجد عناصر للبيع في الفاتورة" };
            }

            const transaction = db.transaction((data) => {
                const stmtSale = db.prepare('INSERT INTO sales (total_amount, sale_date, user_id, is_settled) VALUES (?, ?, ?, 0)');
                const info = stmtSale.run(data.total, data.date || new Date().toISOString(), currentSessionUser.id);
                const saleId = info.lastInsertRowid;

                const updateProd = db.prepare('UPDATE products SET qty = qty - ? WHERE id = ?');
                const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)');

                for (const item of data.items) {
                    updateProd.run(item.qty, item.id);
                    insertItem.run(saleId, item.id, item.qty, item.price);
                }
            });

            transaction(saleData);
            return { success: true };
        } catch (e) {
            console.error("Sale Transaction Error:", e);
            return { success: false, message: e.message };
        }
    });

    // --- الموظفين والعهد ---
    ipcMain.handle('add-user', (e, u) => {
        try {
            const hashedPassword = bcrypt.hashSync(u.password, 10);
            db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(u.username, hashedPassword, 'employee');
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('get-employees-balances', () => {
        return db.prepare(`
            SELECT u.id, u.username, 
                   IFNULL(SUM(CASE WHEN s.is_settled = 0 THEN s.total_amount ELSE 0 END), 0) as currentBalance 
            FROM users u 
            LEFT JOIN sales s ON u.id = s.user_id 
            WHERE u.role = 'employee' 
            GROUP BY u.id
        `).all();
    });

    ipcMain.handle('settle-user-sales', (e, id) => {
        try {
            db.prepare('UPDATE sales SET is_settled = 1 WHERE user_id = ?').run(id);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // --- الإعدادات العامة للمتجر ---
    ipcMain.handle('get-settings', () => {
        try {
            const rows = db.prepare('SELECT key, value FROM settings').all();
            const config = {};
            for (const r of rows) config[r.key] = r.value;
            return config;
        } catch (e) {
            return {};
        }
    });

    ipcMain.handle('update-setting', (e, { key, value }) => {
        try {
            db.prepare(`
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `).run(key, value);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
    // 1. جلب الطابعات المتصلة بنظام التشغيل لعرضها في الإعدادات
    ipcMain.handle('get-printers', async(event) => {
        const win = BrowserWindow.getFocusedWindow() || loginWindow || adminWindow || cashierWindow;
        if (!win) return [];
        return await win.webContents.getPrintersAsync();
    });
    ipcMain.on('app:close', () => app.quit());
    createLoginWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});