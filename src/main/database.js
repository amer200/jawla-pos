import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import bcrypt from 'bcryptjs'

const dbPath = path.join(app.getPath('userData'), 'nezam-pos.db')
export const db = new Database(dbPath)

// تفعيل القيود الخارجية في SQLite
db.pragma('foreign_keys = ON;')

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

    // التحقق من وجود مستخدم مدير افتراضي وتشفير كلمته
    const userCount = db.prepare('SELECT count(*) as count FROM users').get();
    if (userCount.count === 0) {
        const defaultHash = bcrypt.hashSync('admin123', 10);
        db.prepare("INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')").run(defaultHash);
        console.log('🔒 Default admin created with hashed password.');
    }

    // 2. جدول الأقسام
    db.prepare(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `).run();

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
            FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
    `).run();

    // 4. جدول المبيعات
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

    // 5. جدول تفاصيل المبيعات
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

    // 6. جدول إعدادات النظام (اسم المتجر، أرقام التواصل، تذييل الفاتورة)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();

    // تهيئة الإعدادات الافتراضية
    const defaultSettings = [
        ['shop_name', 'نظام جولة'],
        ['shop_phone', '01152306375'],
        ['receipt_header', 'فاتورة مبيعات'],
        ['receipt_footer', 'شكراً لزيارتكم ونتشرف دائماً بخدمتكم!']
    ];

    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of defaultSettings) {
        insertSetting.run(k, v);
    }

    console.log('✅ Database Architecture & Constraints Ready at:', dbPath);
}