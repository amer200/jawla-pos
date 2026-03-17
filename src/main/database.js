import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

const dbPath = path.join(app.getPath('userData'), 'nezam-pos.db')
export const db = new Database(dbPath)

export const initDB = () => {
    // 1. جدول المستخدمين
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT CHECK( role IN ('admin', 'employee') ) DEFAULT 'employee'
        )
    `).run();

    const userCount = db.prepare('SELECT count(*) as count FROM users').get();
    if (userCount.count === 0) {
        db.prepare("INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')").run();
    }

    // 2. جدول الأقسام
    db.prepare(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `).run()

    // 3. جدول المنتجات
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
    `).run()

    // 4. جدول المبيعات (تم تحديثه ليشمل الموظف وحالة التصفية)
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

    // 5. جدول تفاصيل المبيعات
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

    // 🛡️ جسر التحديث (Migrations) 
    // السطور دي عشان لو الداتابيز قديمة عند "خالك" تتحدث تلقائي بدون مشاكل
    try { db.prepare("ALTER TABLE products ADD COLUMN barcode TEXT UNIQUE").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE sales ADD COLUMN user_id INTEGER").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE sales ADD COLUMN is_settled INTEGER DEFAULT 0").run(); } catch (e) {}

    console.log('✅ Database System Ready at:', dbPath)
}