"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const dbPath = path.join(electron.app.getPath("userData"), "nezam-pos.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON;");
const initDB = () => {
  db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT CHECK( role IN ('admin', 'employee') ) DEFAULT 'employee'
        )
    `).run();
  const userCount = db.prepare("SELECT count(*) as count FROM users").get();
  if (userCount.count === 0) {
    const defaultHash = bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')").run(defaultHash);
    console.log("🔒 Default admin created with hashed password.");
  }
  db.prepare(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `).run();
  db.prepare(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT UNIQUE, 
            name TEXT NOT NULL,
            category_id INTEGER,
            qty REAL DEFAULT 0 CHECK(qty >= 0),
            purchase_price REAL DEFAULT 0,
            sell_price REAL DEFAULT 0,
            FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
    `).run();
  db.prepare(`
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_amount REAL NOT NULL,
            sale_date TEXT NOT NULL,
            user_id INTEGER,
            is_settled INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `).run();
  db.prepare(`
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER,
            product_id INTEGER,
            qty REAL NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
            FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
        )
    `).run();
  db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();
  const defaultSettings = [
    ["shop_name", "نظام جولة"],
    ["shop_phone", "01152306375"],
    ["receipt_header", "فاتورة مبيعات"],
    ["receipt_footer", "شكراً لزيارتكم ونتشرف دائماً بخدمتكم!"]
  ];
  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of defaultSettings) {
    insertSetting.run(k, v);
  }
  console.log("✅ Database Architecture & Constraints Ready at:", dbPath);
};
let loginWindow = null, adminWindow = null, cashierWindow = null;
let currentSessionUser = null;
function loadWindowRoute(window, route) {
  const fileName = route === "admin" ? "index.html" : `${route.replace("/", "")}.html`;
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    const devPath = route === "admin" ? "" : route;
    window.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/${devPath}`);
  } else {
    window.loadFile(path.join(__dirname, `../renderer/${fileName}`));
  }
}
function createLoginWindow() {
  loginWindow = new electron.BrowserWindow({
    width: 450,
    height: 600,
    resizable: false,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
    }
  });
  loadWindowRoute(loginWindow, "login");
  loginWindow.once("ready-to-show", () => loginWindow.show());
}
function createAdminWindow() {
  adminWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
    }
  });
  loadWindowRoute(adminWindow, "admin");
  return adminWindow;
}
function createCashierWindow() {
  cashierWindow = new electron.BrowserWindow({
    width: 1366,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
    }
  });
  loadWindowRoute(cashierWindow, "cashier");
  return cashierWindow;
}
electron.app.whenReady().then(() => {
  initDB();
  electron.ipcMain.handle("auth:login", async (event, { username, password }) => {
    try {
      const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
      if (!user) {
        return { success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" };
      }
      let isMatch = false;
      if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$")) {
        isMatch = bcrypt.compareSync(password, user.password);
      } else {
        if (user.password === password) {
          isMatch = true;
          const newHash = bcrypt.hashSync(password, 10);
          db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newHash, user.id);
        }
      }
      if (isMatch) {
        currentSessionUser = {
          id: user.id,
          username: user.username,
          role: user.role
        };
        let targetWindow = null;
        if (user.role === "admin") {
          targetWindow = createAdminWindow();
        } else {
          targetWindow = createCashierWindow();
        }
        targetWindow.once("ready-to-show", () => {
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
  electron.ipcMain.handle("get-categories", () => db.prepare("SELECT * FROM categories").all());
  electron.ipcMain.handle("add-category", (e, name) => {
    try {
      db.prepare("INSERT INTO categories (name) VALUES (?)").run(name.trim());
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("get-all-products", () => {
    return db.prepare("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC").all();
  });
  electron.ipcMain.handle("add-product", (e, p) => {
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
  electron.ipcMain.handle("update-product", (e, p) => {
    try {
      db.prepare(`
                UPDATE products 
                SET name = ?, barcode = ?, category_id = ?, qty = ?, purchase_price = ?, sell_price = ?
                WHERE id = ?
            `).run(p.name, p.barcode || null, p.category_id || null, p.qty, p.purchase_price, p.sell_price, p.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("delete-product", (e, id) => {
    try {
      db.prepare("DELETE FROM products WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("search-products-suggestions", (event, query) => {
    if (!query) return [];
    return db.prepare(`
            SELECT * FROM products 
            WHERE (name LIKE ? OR barcode LIKE ?) AND qty > 0
            LIMIT 10
        `).all(`%${query}%`, `%${query}%`);
  });
  electron.ipcMain.handle("get-my-recent-sales", () => {
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
  electron.ipcMain.handle("complete-sale", (event, saleData) => {
    try {
      if (!currentSessionUser) {
        return { success: false, message: "انتهت الجلسة، يرجى إعادة تسجيل الدخول مجدداً" };
      }
      if (!saleData || !saleData.items || saleData.items.length === 0) {
        return { success: false, message: "لا توجد عناصر للبيع في الفاتورة" };
      }
      const transaction = db.transaction((data) => {
        const stmtSale = db.prepare("INSERT INTO sales (total_amount, sale_date, user_id, is_settled) VALUES (?, ?, ?, 0)");
        const info = stmtSale.run(data.total, data.date || (/* @__PURE__ */ new Date()).toISOString(), currentSessionUser.id);
        const saleId = info.lastInsertRowid;
        const updateProd = db.prepare("UPDATE products SET qty = qty - ? WHERE id = ?");
        const insertItem = db.prepare("INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)");
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
  electron.ipcMain.handle("add-user", (e, u) => {
    try {
      const hashedPassword = bcrypt.hashSync(u.password, 10);
      db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(u.username, hashedPassword, "employee");
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("get-employees-balances", () => {
    return db.prepare(`
            SELECT u.id, u.username, 
                   IFNULL(SUM(CASE WHEN s.is_settled = 0 THEN s.total_amount ELSE 0 END), 0) as currentBalance 
            FROM users u 
            LEFT JOIN sales s ON u.id = s.user_id 
            WHERE u.role = 'employee' 
            GROUP BY u.id
        `).all();
  });
  electron.ipcMain.handle("settle-user-sales", (e, id) => {
    try {
      db.prepare("UPDATE sales SET is_settled = 1 WHERE user_id = ?").run(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("get-settings", () => {
    try {
      const rows = db.prepare("SELECT key, value FROM settings").all();
      const config = {};
      for (const r of rows) config[r.key] = r.value;
      return config;
    } catch (e) {
      return {};
    }
  });
  electron.ipcMain.handle("update-setting", (e, { key, value }) => {
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
  electron.ipcMain.handle("get-printers", async (event) => {
    const win = electron.BrowserWindow.getFocusedWindow() || loginWindow || adminWindow || cashierWindow;
    if (!win) return [];
    return await win.webContents.getPrintersAsync();
  });
  electron.ipcMain.on("print-receipt", (event, { html, printerName, isLabel }) => {
    const printWindow = new electron.BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    const encodedData = encodeURIComponent(html);
    printWindow.loadURL(`data:text/html;charset=utf-8,${encodedData}`);
    printWindow.webContents.on("did-finish-load", () => {
      setTimeout(() => {
        const printOptions = {
          silent: true,
          // طباعة فورية صامتة عند العميل
          printBackground: true,
          color: false,
          margin: { marginType: "none" }
          // إلغاء الهوامش الافتراضية
        };
        if (printerName && printerName.trim() !== "") {
          printOptions.deviceName = printerName;
        }
        printWindow.webContents.print(printOptions, (success, failureReason) => {
          if (!success) {
            console.error("❌ Printing Failed:", failureReason);
          }
          printWindow.close();
        });
      }, 250);
    });
  });
  electron.ipcMain.on("print-receipt", (event, receiptHtml) => {
    const printWindow = new electron.BrowserWindow({
      show: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    const encodedData = encodeURIComponent(receiptHtml);
    printWindow.loadURL(`data:text/html;charset=utf-8,${encodedData}`);
    printWindow.webContents.on("did-finish-load", () => {
      printWindow.webContents.print({
        silent: true,
        printBackground: true,
        color: false,
        margin: { marginType: "none" }
      }, (success, failureReason) => {
        if (!success) console.error("Printing failed:", failureReason);
        printWindow.close();
      });
    });
  });
  electron.ipcMain.on("app:close", () => electron.app.quit());
  createLoginWindow();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
