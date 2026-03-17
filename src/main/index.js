import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { db, initDB } from './database'

let loginWindow = null,
    adminWindow = null,
    cashierWindow = null;
let currentSessionUser = null;

// دالة تحميل المسارات مع مراعاة Linux Case Sensitivity
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
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true // تأكد إنها true لزيادة الأمان
        }
    });
    loadWindowRoute(loginWindow, 'login');
}

function createAdminWindow() {
    adminWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
    });
    loadWindowRoute(adminWindow, 'admin');
}

function createCashierWindow() {
    cashierWindow = new BrowserWindow({
        width: 1366,
        height: 800,
        webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
    });
    loadWindowRoute(cashierWindow, 'cashier');
}

app.whenReady().then(() => {
    // تهيئة قاعدة البيانات
    initDB();

    // --- الهاندلر المصلح: تغيير الاسم من login-attempt لـ auth:login ---
    ipcMain.handle('auth:login', async(event, { username, password }) => {
        try {
            const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
            if (user) {
                currentSessionUser = user;
                // فتح النافذة بناءً على الصلاحية
                if (user.role === 'admin') {
                    createAdminWindow();
                } else {
                    createCashierWindow();
                }
                // إغلاق نافذة اللوجين بعد وقت قصير لضمان سلاسة الانتقال
                setTimeout(() => { if (loginWindow) loginWindow.close(); }, 500);
                return { success: true, role: user.role };
            }
            return { success: false, message: "بيانات الدخول غير صحيحة" };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // --- باقي الـ Handlers ---
    ipcMain.handle('get-categories', () => db.prepare('SELECT * FROM categories').all());

    ipcMain.handle('get-all-products', () => {
        return db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id').all();
    });

    ipcMain.handle('add-category', (e, name) => {
        try {
            db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
            return { success: true };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('add-product', (e, p) => {
        try {
            db.prepare('INSERT INTO products (barcode, name, category_id, qty, purchase_price, sell_price) VALUES (?,?,?,?,?,?)')
                .run(p.barcode, p.name, p.category_id, p.qty, p.purchase_price, p.sell_price);
            return { success: true };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('update-product', (e, p) => {
        try {
            db.prepare('UPDATE products SET name=?, qty=?, purchase_price=?, sell_price=? WHERE id=?')
                .run(p.name, p.qty, p.purchase_price, p.sell_price, p.id);
            return { success: true };
        } catch (err) { return { success: false }; }
    });

    ipcMain.handle('delete-product', (e, id) => {
        try {
            db.prepare('DELETE FROM products WHERE id = ?').run(id);
            return { success: true };
        } catch (err) { return { success: false }; }
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
        } catch (err) { return []; }
    });

    ipcMain.handle('search-products-suggestions', (event, query) => {
        if (!query) return [];
        return db.prepare('SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? LIMIT 10').all(`%${query}%`, `%${query}%`);
    });

    ipcMain.handle('complete-sale', (event, saleData) => {
        try {
            const transaction = db.transaction((data) => {
                const stmtSale = db.prepare('INSERT INTO sales (total_amount, sale_date, user_id, is_settled) VALUES (?, ?, ?, 0)');
                const info = stmtSale.run(data.total, data.date, currentSessionUser.id);
                const lastId = info.lastInsertRowid;
                const updateProd = db.prepare('UPDATE products SET qty = qty - ? WHERE id = ?');
                const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)');
                for (const item of data.items) {
                    updateProd.run(item.qty, item.id);
                    insertItem.run(lastId, item.id, item.qty, item.price);
                }
            });
            transaction(saleData);
            return { success: true };
        } catch (e) { return { success: false, message: e.message }; }
    });

    ipcMain.handle('add-user', (e, u) => {
        try {
            db.prepare('INSERT INTO users (username, password, role) VALUES (?,?,?)').run(u.username, u.password, 'employee');
            return { success: true };
        } catch (err) { return { success: false }; }
    });

    ipcMain.handle('get-employees-balances', () => {
        return db.prepare(`SELECT u.id, u.username, IFNULL(SUM(CASE WHEN s.is_settled = 0 THEN s.total_amount ELSE 0 END), 0) as currentBalance FROM users u LEFT JOIN sales s ON u.id = s.user_id WHERE u.role = 'employee' GROUP BY u.id`).all();
    });

    ipcMain.handle('settle-user-sales', (e, id) => {
        try {
            db.prepare('UPDATE sales SET is_settled = 1 WHERE user_id = ?').run(id);
            return { success: true };
        } catch (err) { return { success: false }; }
    });

    ipcMain.on('print-receipt', (event, receiptHtml) => {
        const printWindow = new BrowserWindow({
            show: false,
            webPreferences: { nodeIntegration: true, contextIsolation: false }
        });
        const encodedData = encodeURIComponent(receiptHtml);
        printWindow.loadURL(`data:text/html;charset=utf-8,${encodedData}`);
        printWindow.webContents.on('did-finish-load', () => {
            printWindow.webContents.print({
                silent: false, // خليني صامت عشان يطبع فوراً
                printBackground: true,
                color: false,
                margin: { marginType: 'none' }
            }, () => {
                printWindow.close();
            });
        });
    });

    createLoginWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});