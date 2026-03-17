"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const Database = require("better-sqlite3");
const dbPath = path.join(electron.app.getPath("userData"), "nezam-pos.db");
const db = new Database(dbPath);
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
    db.prepare("INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')").run();
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
            FOREIGN KEY(category_id) REFERENCES categories(id)
        )
    `).run();
  db.prepare(`
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_amount REAL NOT NULL,
            sale_date TEXT NOT NULL,
            user_id INTEGER,
            is_settled INTEGER DEFAULT 0, -- 0 = في العهدة، 1 = تم التصفير
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `).run();
  db.prepare(`
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER,
            product_id INTEGER,
            qty REAL NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY(sale_id) REFERENCES sales(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    `).run();
  try {
    db.prepare("ALTER TABLE products ADD COLUMN barcode TEXT UNIQUE").run();
  } catch (e) {
  }
  try {
    db.prepare("ALTER TABLE sales ADD COLUMN user_id INTEGER").run();
  } catch (e) {
  }
  try {
    db.prepare("ALTER TABLE sales ADD COLUMN is_settled INTEGER DEFAULT 0").run();
  } catch (e) {
  }
  console.log("✅ Database System Ready at:", dbPath);
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
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
      // تأكد إنها true لزيادة الأمان
    }
  });
  loadWindowRoute(loginWindow, "login");
}
function createAdminWindow() {
  adminWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { preload: path.join(__dirname, "../preload/index.js"), sandbox: false }
  });
  loadWindowRoute(adminWindow, "admin");
}
function createCashierWindow() {
  cashierWindow = new electron.BrowserWindow({
    width: 1366,
    height: 800,
    webPreferences: { preload: path.join(__dirname, "../preload/index.js"), sandbox: false }
  });
  loadWindowRoute(cashierWindow, "cashier");
}
electron.app.whenReady().then(() => {
  initDB();
  electron.ipcMain.handle("auth:login", async (event, { username, password }) => {
    try {
      const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
      if (user) {
        currentSessionUser = user;
        if (user.role === "admin") {
          createAdminWindow();
        } else {
          createCashierWindow();
        }
        setTimeout(() => {
          if (loginWindow) loginWindow.close();
        }, 500);
        return { success: true, role: user.role };
      }
      return { success: false, message: "بيانات الدخول غير صحيحة" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("get-categories", () => db.prepare("SELECT * FROM categories").all());
  electron.ipcMain.handle("get-all-products", () => {
    return db.prepare("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id").all();
  });
  electron.ipcMain.handle("add-category", (e, name) => {
    try {
      db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("add-product", (e, p) => {
    try {
      db.prepare("INSERT INTO products (barcode, name, category_id, qty, purchase_price, sell_price) VALUES (?,?,?,?,?,?)").run(p.barcode, p.name, p.category_id, p.qty, p.purchase_price, p.sell_price);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("update-product", (e, p) => {
    try {
      db.prepare("UPDATE products SET name=?, qty=?, purchase_price=?, sell_price=? WHERE id=?").run(p.name, p.qty, p.purchase_price, p.sell_price, p.id);
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  });
  electron.ipcMain.handle("delete-product", (e, id) => {
    try {
      db.prepare("DELETE FROM products WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      return { success: false };
    }
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
  electron.ipcMain.handle("search-products-suggestions", (event, query) => {
    if (!query) return [];
    return db.prepare("SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? LIMIT 10").all(`%${query}%`, `%${query}%`);
  });
  electron.ipcMain.handle("complete-sale", (event, saleData) => {
    try {
      const transaction = db.transaction((data) => {
        const stmtSale = db.prepare("INSERT INTO sales (total_amount, sale_date, user_id, is_settled) VALUES (?, ?, ?, 0)");
        const info = stmtSale.run(data.total, data.date, currentSessionUser.id);
        const lastId = info.lastInsertRowid;
        const updateProd = db.prepare("UPDATE products SET qty = qty - ? WHERE id = ?");
        const insertItem = db.prepare("INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)");
        for (const item of data.items) {
          updateProd.run(item.qty, item.id);
          insertItem.run(lastId, item.id, item.qty, item.price);
        }
      });
      transaction(saleData);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  electron.ipcMain.handle("add-user", (e, u) => {
    try {
      db.prepare("INSERT INTO users (username, password, role) VALUES (?,?,?)").run(u.username, u.password, "employee");
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  });
  electron.ipcMain.handle("get-employees-balances", () => {
    return db.prepare(`SELECT u.id, u.username, IFNULL(SUM(CASE WHEN s.is_settled = 0 THEN s.total_amount ELSE 0 END), 0) as currentBalance FROM users u LEFT JOIN sales s ON u.id = s.user_id WHERE u.role = 'employee' GROUP BY u.id`).all();
  });
  electron.ipcMain.handle("settle-user-sales", (e, id) => {
    try {
      db.prepare("UPDATE sales SET is_settled = 1 WHERE user_id = ?").run(id);
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  });
  electron.ipcMain.on("print-receipt", (event, receiptHtml) => {
    const printWindow = new electron.BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    const encodedData = encodeURIComponent(receiptHtml);
    printWindow.loadURL(`data:text/html;charset=utf-8,${encodedData}`);
    printWindow.webContents.on("did-finish-load", () => {
      printWindow.webContents.print({
        silent: false,
        // خليني صامت عشان يطبع فوراً
        printBackground: true,
        color: false,
        margin: { marginType: "none" }
      }, () => {
        printWindow.close();
      });
    });
  });
  createLoginWindow();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
