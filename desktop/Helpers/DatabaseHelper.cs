using System;
using System.Collections.Generic;
using System.Data;
using Microsoft.Data.Sqlite;
using InventorySystem.Helpers;

namespace InventorySystem
{
    /// <summary>
    /// Centralized database operations helper -- SQLite backend.
    /// Drop-in replacement for the previous SQL Server version.
    /// </summary>
    public static class DatabaseHelper
    {
        // - helpers -

        private static SqliteConnection OpenConnection()
        {
            var conn = new SqliteConnection(DatabaseConfig.ConnectionString);
            conn.Open();
            return conn;
        }

        private static void AddParams(SqliteCommand cmd, SqliteParameter[] parameters)
        {
            if (parameters != null && parameters.Length > 0)
                cmd.Parameters.AddRange(parameters);
        }

        // - public API -

        public static List<T> ExecuteQuery<T>(string sql, Func<SqliteDataReader, T> map, params SqliteParameter[] parameters)
        {
            var results = new List<T>();
            try
            {
                using var conn = OpenConnection();
                using var cmd  = new SqliteCommand(sql, conn);
                AddParams(cmd, parameters);
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                    results.Add(map(reader));
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, $"ExecuteQuery: {sql}");
                throw;
            }
            return results;
        }

        public static bool ExecuteNonQuery(string sql, params SqliteParameter[] parameters)
        {
            try
            {
                using var conn = OpenConnection();
                using var cmd  = new SqliteCommand(sql, conn);
                AddParams(cmd, parameters);
                cmd.ExecuteNonQuery();
                return true;
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, $"ExecuteNonQuery: {sql}");
                return false;
            }
        }

        public static T ExecuteScalar<T>(string sql, params SqliteParameter[] parameters)
        {
            try
            {
                using var conn = OpenConnection();
                using var cmd  = new SqliteCommand(sql, conn);
                AddParams(cmd, parameters);
                object result = cmd.ExecuteScalar();
                if (result == null || result == DBNull.Value)
                    return default(T);
                return (T)Convert.ChangeType(result, typeof(T));
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, $"ExecuteScalar: {sql}");
                return default(T);
            }
        }

        public static bool RecordExists(string tableName, string columnName, string value, bool excludeDeleted = true)
        {
            string del = excludeDeleted ? " AND date_deleted IS NULL" : "";
            string sql = $"SELECT COUNT(*) FROM {tableName} WHERE {columnName} = @value{del}";
            return ExecuteScalar<int>(sql, new SqliteParameter("@value", value)) > 0;
        }

        public static int GetCount(string tableName, string whereClause = "", params SqliteParameter[] parameters)
        {
            string sql = $"SELECT COUNT(*) FROM {tableName}";
            if (!string.IsNullOrWhiteSpace(whereClause))
                sql += $" WHERE {whereClause}";
            return ExecuteScalar<int>(sql, parameters);
        }

        /// <summary>
        /// Fills a DataTable from a query -- replaces SqlDataAdapter for SQLite.
        /// </summary>
        public static DataTable ExecuteDataTable(string sql, params SqliteParameter[] parameters)
        {
            var dt = new DataTable();
            try
            {
                using var conn   = OpenConnection();
                using var cmd    = new SqliteCommand(sql, conn);
                AddParams(cmd, parameters);
                using var reader = cmd.ExecuteReader();
                
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    Type t = reader.GetFieldType(i) ?? typeof(object);
                    dt.Columns.Add(reader.GetName(i), t);
                }

                while (reader.Read())
                {
                    DataRow row = dt.NewRow();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        object val = reader.GetValue(i);
                        if (val == DBNull.Value)
                        {
                            row[i] = DBNull.Value;
                        }
                        else
                        {
                            Type targetType = dt.Columns[i].DataType;
                            if (val.GetType() == targetType || targetType == typeof(object))
                            {
                                row[i] = val;
                            }
                            else
                            {
                                try
                                {
                                    if (val is string s && string.IsNullOrWhiteSpace(s))
                                    {
                                        row[i] = targetType.IsValueType ? Activator.CreateInstance(targetType) : DBNull.Value;
                                    }
                                    else
                                    {
                                        row[i] = Convert.ChangeType(val, targetType);
                                    }
                                }
                                catch
                                {
                                    row[i] = targetType.IsValueType ? Activator.CreateInstance(targetType) : DBNull.Value;
                                }
                            }
                        }
                    }
                    dt.Rows.Add(row);
                }
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, $"ExecuteDataTable: {sql}");
                throw;
            }
            return dt;
        }

        public static void LogTransaction(string action, string partName, string description)
        {
            try
            {
                string sql = "INSERT INTO transactions (action_type, part_name, description, username, timestamp) " +
                             "VALUES (@action, @part, @desc, @user, datetime('now'))";
                ExecuteNonQuery(sql,
                    new SqliteParameter("@action", action),
                    new SqliteParameter("@part",   partName),
                    new SqliteParameter("@desc",   description),
                    new SqliteParameter("@user",   "Admin"));
            }
            catch { }
        }

        /// <summary>
        /// Ensures all required tables and columns exist (SQLite-compatible).
        /// Uses CREATE TABLE IF NOT EXISTS + PRAGMA table_info for column checks.
        /// </summary>
        public static void EnsureSchema()
        {
            try
            {
                // Tables -- SQLite CREATE IF NOT EXISTS is idempotent
                string sqlTables = @"
                    CREATE TABLE IF NOT EXISTS categories (
                        id              INTEGER PRIMARY KEY AUTOINCREMENT,
                        category_name   TEXT NOT NULL UNIQUE,
                        description     TEXT,
                        category_image  TEXT,
                        date_created    TEXT DEFAULT (datetime('now'))
                    );

                    CREATE TABLE IF NOT EXISTS suppliers (
                        id              INTEGER PRIMARY KEY AUTOINCREMENT,
                        supplier_code   TEXT,
                        supplier_name   TEXT NOT NULL,
                        contact_person  TEXT,
                        email           TEXT,
                        phone           TEXT,
                        address         TEXT,
                        type            TEXT,
                        balance_due     REAL DEFAULT 0,
                        payment_due_date TEXT,
                        reminder_days   INTEGER DEFAULT 0,
                        status          TEXT DEFAULT 'Active',
                        date_added      TEXT DEFAULT (datetime('now')),
                        date_deleted    TEXT
                    );

                    CREATE TABLE IF NOT EXISTS customers (
                        customer_id     INTEGER PRIMARY KEY AUTOINCREMENT,
                        full_name       TEXT NOT NULL,
                        phone           TEXT,
                        email           TEXT,
                        address         TEXT,
                        type            TEXT,
                        current_balance REAL DEFAULT 0,
                        credit_limit    REAL DEFAULT 1000,
                        payment_due_date TEXT,
                        reminder_days   INTEGER DEFAULT 0,
                        status          TEXT DEFAULT 'Active',
                        date_added      TEXT DEFAULT (datetime('now')),
                        date_deleted    TEXT
                    );

                    CREATE TABLE IF NOT EXISTS parts (
                        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                        part_number         TEXT,
                        part_name           TEXT NOT NULL,
                        description         TEXT,
                        category_id         INTEGER,
                        supplier_id         INTEGER,
                        purchase_price      REAL DEFAULT 0,
                        selling_price       REAL DEFAULT 0,
                        quantity_in_stock   INTEGER DEFAULT 0,
                        minimum_stock_level INTEGER DEFAULT 5,
                        reorder_quantity    INTEGER DEFAULT 10,
                        location            TEXT,
                        shelf               TEXT,
                        part_image          TEXT,
                        barcode             TEXT,
                        status              TEXT DEFAULT 'Active',
                        date_added          TEXT DEFAULT (datetime('now')),
                        date_deleted        TEXT,
                        item_type           TEXT DEFAULT 'Product',
                        unit_of_measure     TEXT,
                        batch_number        TEXT,
                        expiry_date         TEXT,
                        is_sales_item       INTEGER DEFAULT 1,
                        is_purchase_item    INTEGER DEFAULT 0,
                        is_inactive         INTEGER DEFAULT 0,
                        tax_rate            REAL DEFAULT 0,
                        is_stock_tracked    INTEGER DEFAULT 1,
                        sell_by_weight      INTEGER DEFAULT 0,
                        price2              REAL DEFAULT 0,
                        price3              REAL DEFAULT 0,
                        price4              REAL DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS transactions (
                        id          INTEGER PRIMARY KEY AUTOINCREMENT,
                        action_type TEXT,
                        part_name   TEXT,
                        description TEXT,
                        username    TEXT,
                        timestamp   TEXT DEFAULT (datetime('now'))
                    );

                    CREATE TABLE IF NOT EXISTS users (
                        id           INTEGER PRIMARY KEY AUTOINCREMENT,
                        username     TEXT NOT NULL UNIQUE,
                        password     TEXT NOT NULL,
                        full_name    TEXT,
                        role         TEXT DEFAULT 'User',
                        is_active    INTEGER DEFAULT 1,
                        date_created TEXT DEFAULT (datetime('now'))
                    );

                    CREATE TABLE IF NOT EXISTS orders (
                        order_id        INTEGER PRIMARY KEY AUTOINCREMENT,
                        customer_id     INTEGER,
                        order_date      TEXT DEFAULT (datetime('now')),
                        total_amount    REAL DEFAULT 0,
                        status          TEXT DEFAULT 'Completed',
                        payment_status  TEXT DEFAULT 'Paid',
                        amount_paid     REAL DEFAULT 0,
                        payment_method  TEXT DEFAULT 'Cash'
                    );

                    CREATE TABLE IF NOT EXISTS order_items (
                        order_item_id   INTEGER PRIMARY KEY AUTOINCREMENT,
                        order_id        INTEGER,
                        part_id         INTEGER,
                        quantity        INTEGER,
                        price           REAL
                    );

                    CREATE TABLE IF NOT EXISTS payments (
                        payment_id      INTEGER PRIMARY KEY AUTOINCREMENT,
                        entity_type     TEXT,
                        entity_id       INTEGER,
                        amount          REAL,
                        payment_date    TEXT DEFAULT (datetime('now')),
                        notes           TEXT,
                        due_date        TEXT
                    );

                    CREATE TABLE IF NOT EXISTS purchase_orders (
                        po_id           INTEGER PRIMARY KEY AUTOINCREMENT,
                        supplier_id     INTEGER,
                        order_date      TEXT DEFAULT (datetime('now')),
                        total_amount    REAL DEFAULT 0,
                        status          TEXT DEFAULT 'Pending',
                        received_date   TEXT,
                        notes           TEXT
                    );

                    CREATE TABLE IF NOT EXISTS purchase_order_items (
                        po_item_id      INTEGER PRIMARY KEY AUTOINCREMENT,
                        po_id           INTEGER,
                        part_id         INTEGER,
                        quantity        INTEGER,
                        cost_price      REAL
                    );

                    CREATE TABLE IF NOT EXISTS returns (
                        return_id       INTEGER PRIMARY KEY AUTOINCREMENT,
                        order_id        INTEGER,
                        return_date     TEXT DEFAULT (datetime('now')),
                        total_refund    REAL DEFAULT 0,
                        reason          TEXT,
                        performed_by    TEXT
                    );

                    CREATE TABLE IF NOT EXISTS return_items (
                        return_item_id  INTEGER PRIMARY KEY AUTOINCREMENT,
                        return_id       INTEGER,
                        part_id         INTEGER,
                        quantity        INTEGER,
                        refund_amount   REAL
                    );

                    CREATE TABLE IF NOT EXISTS expenses (
                        expense_id          INTEGER PRIMARY KEY AUTOINCREMENT,
                        expense_date        TEXT DEFAULT (datetime('now')),
                        category            TEXT,
                        amount              REAL DEFAULT 0,
                        description         TEXT,
                        recorded_by         TEXT,
                        is_paid             INTEGER DEFAULT 1,
                        is_recurring        INTEGER DEFAULT 0,
                        last_processed_month TEXT,
                        date_deleted        TEXT
                    );

                    CREATE TABLE IF NOT EXISTS expense_categories (
                        category_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category_name TEXT NOT NULL UNIQUE
                    );

                    CREATE TABLE IF NOT EXISTS units_of_measure (
                        unit_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        unit_name TEXT NOT NULL UNIQUE
                    );

                    CREATE TABLE IF NOT EXISTS app_settings (
                        key TEXT PRIMARY KEY NOT NULL,
                        value TEXT NOT NULL
                    );
                ";

                // SQLite doesn't support multiple statements in one call -- split them
                foreach (var stmt in sqlTables.Split(new[] { ";\r\n", ";\n" }, StringSplitOptions.RemoveEmptyEntries))
                {
                    string trimmed = stmt.Trim();
                    if (!string.IsNullOrWhiteSpace(trimmed))
                        ExecuteNonQuery(trimmed + ";");
                }

                // --- MIGRATIONS ---
                // Add new unified product/service fields to parts
                if (!ColumnExists("parts", "item_type")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN item_type TEXT DEFAULT 'Product';");
                if (!ColumnExists("parts", "unit_of_measure")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN unit_of_measure TEXT;");
                if (!ColumnExists("parts", "batch_number")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN batch_number TEXT;");
                if (!ColumnExists("parts", "expiry_date")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN expiry_date TEXT;");
                if (!ColumnExists("parts", "is_sales_item")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN is_sales_item INTEGER DEFAULT 1;");
                if (!ColumnExists("parts", "is_purchase_item")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN is_purchase_item INTEGER DEFAULT 0;");
                if (!ColumnExists("parts", "is_inactive")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN is_inactive INTEGER DEFAULT 0;");
                if (!ColumnExists("parts", "tax_rate")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN tax_rate REAL DEFAULT 0;");
                if (!ColumnExists("parts", "is_stock_tracked")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN is_stock_tracked INTEGER DEFAULT 1;");
                if (!ColumnExists("parts", "sell_by_weight")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN sell_by_weight INTEGER DEFAULT 0;");
                if (!ColumnExists("parts", "price2")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN price2 REAL DEFAULT 0;");
                if (!ColumnExists("parts", "price3")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN price3 REAL DEFAULT 0;");
                if (!ColumnExists("parts", "price4")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN price4 REAL DEFAULT 0;");

                // Add due_date to payments if missing
                if (!ColumnExists("payments", "due_date"))
                {
                    ExecuteNonQuery("ALTER TABLE payments ADD COLUMN due_date TEXT;");
                }

                // Add shipping fields to orders
                if (!ColumnExists("orders", "shipping_address")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN shipping_address TEXT;");
                if (!ColumnExists("orders", "delivery_date")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN delivery_date TEXT;");
                if (!ColumnExists("orders", "due_date")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN due_date TEXT;");

                // Custom / quick-sale line label (when part_id is null or name overridden)
                if (!ColumnExists("order_items", "item_name")) ExecuteNonQuery("ALTER TABLE order_items ADD COLUMN item_name TEXT;");
                if (!ColumnExists("order_items", "amount_paid")) ExecuteNonQuery("ALTER TABLE order_items ADD COLUMN amount_paid REAL DEFAULT 0;");

                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS supplier_purchase_items (
                        id              INTEGER PRIMARY KEY AUTOINCREMENT,
                        supplier_id     INTEGER NOT NULL,
                        item_name       TEXT NOT NULL,
                        category        TEXT,
                        quantity        REAL NOT NULL DEFAULT 1,
                        unit_price      REAL NOT NULL DEFAULT 0,
                        payment_status  TEXT NOT NULL DEFAULT 'Unpaid',
                        amount_paid     REAL NOT NULL DEFAULT 0,
                        part_id         INTEGER,
                        notes           TEXT,
                        created_at      TEXT DEFAULT (datetime('now', 'localtime')),
                        date_deleted    TEXT
                    );");
                if (!ColumnExists("supplier_purchase_items", "category"))
                    ExecuteNonQuery("ALTER TABLE supplier_purchase_items ADD COLUMN category TEXT;");

                if (!ColumnExists("parts", "brand")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN brand TEXT;");
                if (!ColumnExists("parts", "size")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN size TEXT;");
                if (!ColumnExists("parts", "color")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN color TEXT;");
                if (!ColumnExists("parts", "style_code")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN style_code TEXT;");
                if (!ColumnExists("parts", "source_kind")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN source_kind TEXT DEFAULT 'bought';");
                if (!ColumnExists("parts", "gender")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN gender TEXT DEFAULT 'Unisex';");
                if (!ColumnExists("parts", "fabric")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN fabric TEXT;");
                if (!ColumnExists("parts", "collection")) ExecuteNonQuery("ALTER TABLE parts ADD COLUMN collection TEXT;");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS product_materials (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        part_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        supplier_id INTEGER,
                        quantity REAL NOT NULL DEFAULT 1,
                        unit_cost REAL NOT NULL DEFAULT 0
                    );");

                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS fashion_collections (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL UNIQUE,
                        season TEXT,
                        year INTEGER,
                        is_active INTEGER DEFAULT 1,
                        date_created TEXT DEFAULT (datetime('now', 'localtime'))
                    );");

                ExecuteNonQuery(@"
                    INSERT OR IGNORE INTO fashion_collections (name, season) VALUES
                    ('Summer', 'Summer'),
                    ('Winter', 'Winter'),
                    ('Spring', 'Spring'),
                    ('Autumn / Fall', 'Autumn'),
                    ('Pre-Fall', 'Pre-Fall'),
                    ('Resort & Cruise', 'Resort'),
                    ('Core Essentials', 'All Season');");

                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS tech_packs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        part_id INTEGER NOT NULL UNIQUE,
                        style_code TEXT,
                        season TEXT,
                        sample_size TEXT DEFAULT 'M',
                        fit_type TEXT DEFAULT 'Regular Fit',
                        status TEXT DEFAULT 'Draft',
                        version TEXT DEFAULT '1.0',
                        designer TEXT,
                        fabric_details TEXT,
                        bom_json TEXT,
                        measurements_json TEXT,
                        construction_notes TEXT,
                        artwork_notes TEXT,
                        packaging_notes TEXT,
                        sketch_front TEXT,
                        sketch_back TEXT,
                        date_created TEXT DEFAULT (datetime('now', 'localtime')),
                        date_updated TEXT DEFAULT (datetime('now', 'localtime'))
                    );");

                if (!ColumnExists("purchase_orders", "po_number")) ExecuteNonQuery("ALTER TABLE purchase_orders ADD COLUMN po_number TEXT;");
                if (!ColumnExists("purchase_orders", "delivery_date")) ExecuteNonQuery("ALTER TABLE purchase_orders ADD COLUMN delivery_date TEXT;");
                if (!ColumnExists("purchase_orders", "warehouse_id")) ExecuteNonQuery("ALTER TABLE purchase_orders ADD COLUMN warehouse_id INTEGER;");

                if (!ColumnExists("orders", "channel")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN channel TEXT DEFAULT 'Retail';");
                if (!ColumnExists("orders", "notes")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN notes TEXT;");
                if (!ColumnExists("orders", "fulfillment_type")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN fulfillment_type TEXT;");
                if (!ColumnExists("orders", "fulfillment_stage")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN fulfillment_stage TEXT;");
                if (!ColumnExists("orders", "carrier")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN carrier TEXT;");
                if (!ColumnExists("orders", "tracking_number")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN tracking_number TEXT;");
                if (!ColumnExists("orders", "tracking_status")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN tracking_status TEXT;");
                if (!ColumnExists("orders", "pickup_note")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN pickup_note TEXT;");
                if (!ColumnExists("orders", "feedback_rating")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN feedback_rating INTEGER;");
                if (!ColumnExists("orders", "feedback_comment")) ExecuteNonQuery("ALTER TABLE orders ADD COLUMN feedback_comment TEXT;");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS order_pack_checks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        order_id INTEGER NOT NULL,
                        order_item_id INTEGER NOT NULL,
                        check_key TEXT NOT NULL,
                        is_checked INTEGER DEFAULT 0,
                        checked_at TEXT
                    );");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS order_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        order_id INTEGER NOT NULL,
                        event_type TEXT,
                        message TEXT,
                        detail TEXT,
                        actor TEXT,
                        created_at TEXT DEFAULT (datetime('now','localtime'))
                    );");
                if (!ColumnExists("order_events", "detail")) ExecuteNonQuery("ALTER TABLE order_events ADD COLUMN detail TEXT;");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS profit_parties (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        percent REAL NOT NULL DEFAULT 0,
                        sort_order INTEGER DEFAULT 0
                    );");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS profit_collections (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        date_from TEXT NOT NULL,
                        date_to TEXT NOT NULL
                    );");

                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS warehouses (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        code TEXT,
                        is_active INTEGER DEFAULT 1
                    );");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS stock_levels (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        part_id INTEGER NOT NULL,
                        warehouse_id INTEGER NOT NULL,
                        quantity INTEGER DEFAULT 0,
                        reorder_level INTEGER DEFAULT 0,
                        UNIQUE(part_id, warehouse_id)
                    );");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS stock_movements (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        part_id INTEGER,
                        warehouse_id INTEGER,
                        movement_type TEXT,
                        quantity REAL,
                        balance_after INTEGER,
                        performed_by TEXT,
                        notes TEXT,
                        movement_date TEXT DEFAULT (datetime('now')),
                        reference_type TEXT,
                        reference_id INTEGER
                    );");
                if (!ColumnExists("stock_movements", "warehouse_id")) ExecuteNonQuery("ALTER TABLE stock_movements ADD COLUMN warehouse_id INTEGER;");
                if (!ColumnExists("stock_movements", "balance_after")) ExecuteNonQuery("ALTER TABLE stock_movements ADD COLUMN balance_after INTEGER;");
                if (!ColumnExists("stock_movements", "reference_type")) ExecuteNonQuery("ALTER TABLE stock_movements ADD COLUMN reference_type TEXT;");
                if (!ColumnExists("stock_movements", "reference_id")) ExecuteNonQuery("ALTER TABLE stock_movements ADD COLUMN reference_id INTEGER;");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS stock_transfers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        from_warehouse_id INTEGER,
                        to_warehouse_id INTEGER,
                        transfer_date TEXT DEFAULT (datetime('now')),
                        notes TEXT,
                        performed_by TEXT
                    );");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS stock_transfer_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        transfer_id INTEGER,
                        part_id INTEGER,
                        quantity INTEGER
                    );");
                ExecuteNonQuery(@"
                    CREATE TABLE IF NOT EXISTS product_images (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        part_id INTEGER NOT NULL,
                        image_path TEXT NOT NULL,
                        sort_order INTEGER DEFAULT 0
                    );");

                ExecuteNonQuery("INSERT INTO warehouses (name, code) SELECT 'Main', 'MAIN' WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'MAIN');");
                ExecuteNonQuery("INSERT INTO warehouses (name, code) SELECT 'Store', 'STORE' WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'STORE');");
                ExecuteNonQuery(@"
                    INSERT INTO stock_levels (part_id, warehouse_id, quantity, reorder_level)
                    SELECT p.id, w.id, COALESCE(p.quantity_in_stock, 0), COALESCE(p.minimum_stock_level, 0)
                    FROM parts p
                    JOIN warehouses w ON w.code = 'MAIN'
                    WHERE p.date_deleted IS NULL
                      AND NOT EXISTS (
                          SELECT 1 FROM stock_levels sl WHERE sl.part_id = p.id AND sl.warehouse_id = w.id
                      );");
                ExecuteNonQuery(@"
                    UPDATE purchase_orders
                    SET po_number = 'PO-' || strftime('%Y', COALESCE(order_date, 'now')) || '-' || printf('%04d', po_id)
                    WHERE po_number IS NULL OR po_number = '';");

                // Normalize legacy product names where variant info was appended (e.g. "TEST1 - RED - M")
                ExecuteNonQuery(@"
                    UPDATE parts 
                    SET style_code = TRIM(SUBSTR(part_name, 1, INSTR(part_name, ' - ') - 1))
                    WHERE (style_code IS NULL OR style_code = '') 
                      AND part_name LIKE '% - %' 
                      AND ((size IS NOT NULL AND size != '') OR (color IS NOT NULL AND color != ''));");

                ExecuteNonQuery(@"
                    UPDATE parts 
                    SET part_name = TRIM(SUBSTR(part_name, 1, INSTR(part_name, ' - ') - 1))
                    WHERE part_name LIKE '% - %' 
                      AND ((size IS NOT NULL AND size != '') OR (color IS NOT NULL AND color != ''));");

                EnsureMenWomenFashionCatalog();
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "EnsureSchema failed");
            }
        }

        public static void EnsureMenWomenFashionCatalog()
        {
            try
            {
                int menCount = ExecuteScalar<int>("SELECT COUNT(*) FROM parts WHERE gender = 'Men' AND date_deleted IS NULL");
                int womenCount = ExecuteScalar<int>("SELECT COUNT(*) FROM parts WHERE gender = 'Women' AND date_deleted IS NULL");
                if (menCount >= 5 && womenCount >= 5) return;

                int GetOrAddCategory(string name)
                {
                    object idObj = ExecuteScalar<object>("SELECT id FROM categories WHERE category_name = @n", new SqliteParameter("@n", name));
                    if (idObj != null && idObj != DBNull.Value) return Convert.ToInt32(idObj);
                    ExecuteNonQuery("INSERT INTO categories (category_name, description) VALUES (@n, @d)",
                        new SqliteParameter("@n", name), new SqliteParameter("@d", name + " Collection"));
                    return (int)ExecuteScalar<long>("SELECT last_insert_rowid()");
                }

                int mainWhId = 1;
                object whObj = ExecuteScalar<object>("SELECT id FROM warehouses WHERE code = 'MAIN' LIMIT 1");
                if (whObj != null && whObj != DBNull.Value) mainWhId = Convert.ToInt32(whObj);

                var items = new (string Name, string Sku, string Barcode, string Cat, string Gender, string Brand, string Size, string Color, string Style, decimal Cost, decimal Price, int Stock, string Desc)[]
                {
                    ("Classic Pique Polo Shirt", "MEN-POLO-001", "7101000101", "Men - T-Shirts & Polos", "Men", "Studio 7-10", "L", "Navy Blue", "M-POLO", 16m, 34m, 28, "Breathable cotton pique polo shirt."),
                    ("Heavyweight Boxy Men Tee", "MEN-TEE-002", "7101000102", "Men - T-Shirts & Polos", "Men", "Studio 7-10", "XL", "Olive Green", "M-BOXTEE", 12m, 28m, 35, "280GSM heavyweight drop-shoulder tee."),
                    ("Slim Striped Crewneck Tee", "MEN-TEE-003", "7101000103", "Men - T-Shirts & Polos", "Men", "Studio 7-10", "M", "Black/White", "M-STRIPE", 13m, 30m, 22, "Cotton blend striped crewneck tee."),
                    ("Oxford Button-Down Shirt", "MEN-SHIRT-004", "7101000104", "Men - Shirts & Casual", "Men", "Urban Tailor", "L", "Light Blue", "M-OXFORD", 22m, 48m, 24, "Tailored button-down oxford shirt."),
                    ("Relaxed Linen Summer Shirt", "MEN-SHIRT-005", "7101000105", "Men - Shirts & Casual", "Men", "Urban Tailor", "M", "Beige", "M-LINEN", 19m, 42m, 20, "Airy pure linen casual shirt."),
                    ("Slim-Fit Stretch Denim Jeans", "MEN-JEAN-006", "7101000106", "Men - Pants & Jeans", "Men", "Denim Co.", "32", "Dark Indigo", "M-DENIM", 25m, 55m, 30, "Classic 5-pocket stretch denim jeans."),
                    ("Modern Chino Trousers", "MEN-CHINO-007", "7101000107", "Men - Pants & Jeans", "Men", "Urban Tailor", "34", "Khaki", "M-CHINO", 20m, 45m, 25, "Flat-front tailored chinos."),
                    ("French Terry Heavyweight Zip Hoodie", "MEN-HOOD-008", "7101000108", "Men - Hoodies & Sweatshirts", "Men", "Studio 7-10", "L", "Charcoal Grey", "M-ZIPHOOD", 28m, 65m, 20, "Heavyweight French terry zip hoodie."),
                    ("Classic Crewneck Sweatshirt", "MEN-SWEAT-009", "7101000109", "Men - Hoodies & Sweatshirts", "Men", "Studio 7-10", "XL", "Black", "M-CREW", 22m, 52m, 26, "Comfortable everyday crewneck fleece."),
                    ("Quilted MA-1 Bomber Jacket", "MEN-JACK-010", "7101000110", "Men - Jackets & Coats", "Men", "North Peak", "L", "Olive Green", "M-BOMBER", 42m, 89m, 16, "Water-resistant satin bomber jacket."),
                    ("Italian Wool Tailored Blazer", "MEN-BLAZ-011", "7101000111", "Men - Suits & Blazers", "Men", "Milano Sartoria", "42R", "Midnight Blue", "M-BLAZER", 68m, 145m, 12, "Modern blazer in virgin wool blend."),
                    ("Handcrafted Leather Sneakers", "MEN-SHOE-012", "7101000112", "Men - Footwear & Shoes", "Men", "Craft & Sole", "43", "White", "M-SNEAK", 35m, 79m, 18, "Minimalist low-top sneakers in calfskin leather."),

                    ("Floral Silk Wrap Midi Dress", "WMN-DRES-001", "7102000201", "Women - Dresses & Gowns", "Women", "Aura Chic", "M", "Emerald Green", "W-WRAP", 30m, 68m, 22, "Flowy silk-touch wrap dress with botanical print."),
                    ("Pleated Evening Maxi Gown", "WMN-DRES-002", "7102000202", "Women - Dresses & Gowns", "Women", "Aura Chic", "S", "Burgundy", "W-GOWN", 48m, 115m, 14, "Graceful sunburst pleated chiffon maxi gown."),
                    ("Linen Tiered Summer Dress", "WMN-DRES-003", "7102000203", "Women - Dresses & Gowns", "Women", "Elle Mode", "M", "White", "W-TIERED", 25m, 58m, 20, "Relaxed tiered A-line linen dress."),
                    ("Satin Button-Up Silk Blouse", "WMN-BLOU-004", "7102000204", "Women - Blouses & Tops", "Women", "Elle Mode", "S", "Champagne", "W-SATIN", 18m, 42m, 26, "Lustrous satin drape shirt with cuffs."),
                    ("Ribbed Long-Sleeve Knit Top", "WMN-TOP-005", "7102000205", "Women - Blouses & Tops", "Women", "Elle Mode", "M", "Mocha", "W-RIBBED", 14m, 32m, 30, "Soft stretchy modal rib knit top."),
                    ("Royal Embroidered Black Abaya", "WMN-ABAY-006", "7102000206", "Women - Abayas & Kaftans", "Women", "Al-Noor Couture", "56", "Black/Gold", "W-ABAYA-ROY", 38m, 85m, 20, "Nida fabric abaya with gold embroidery."),
                    ("Crêpe Open-Front Everyday Abaya", "WMN-ABAY-007", "7102000207", "Women - Abayas & Kaftans", "Women", "Al-Noor Couture", "54", "Sage Olive", "W-ABAYA-CREP", 28m, 65m, 18, "Lightweight crêpe kimono-cut abaya."),
                    ("High-Waisted Palazzo Trousers", "WMN-PANT-008", "7102000208", "Women - Skirts & Pants", "Women", "Elle Mode", "M", "Cream", "W-PALAZZO", 20m, 46m, 24, "Flattering wide-leg trousers with front pleats."),
                    ("Pleated Satin Midi Skirt", "WMN-SKRT-009", "7102000209", "Women - Skirts & Pants", "Women", "Aura Chic", "S", "Bronze", "W-SKIRT", 17m, 39m, 22, "Shimmering accordion pleat midi skirt."),
                    ("Quilted Chain Crossbody Bag", "WMN-BAG-010", "7102000210", "Women - Handbags & Accessories", "Women", "Luxe Atelier", "One Size", "Black", "W-CROSSBODY", 32m, 75m, 16, "Padded chevron quilted vegan leather purse."),
                    ("Structured Minimalist Tote Bag", "WMN-BAG-011", "7102000211", "Women - Handbags & Accessories", "Women", "Luxe Atelier", "One Size", "Caramel Tan", "W-TOTE", 39m, 88m, 15, "Spacious everyday structured tote bag."),
                    ("Pointed Toe Stiletto Pumps", "WMN-HEEL-012", "7102000212", "Women - Footwear & Heels", "Women", "Bellissima", "38", "Nude Beige", "W-PUMP", 29m, 69m, 18, "Classic 85mm patent leather pointed pumps."),
                    ("Wool Blend Double-Breasted Trench", "WMN-COAT-013", "7102000213", "Women - Jackets & Cardigans", "Women", "Elle Mode", "M", "Camel", "W-TRENCH", 55m, 125m, 14, "Belted double-breasted coat in wool blend.")
                };

                foreach (var it in items)
                {
                    int catId = GetOrAddCategory(it.Cat);
                    int exId = ExecuteScalar<int>("SELECT id FROM parts WHERE (part_name = @n OR part_number = @sku) AND date_deleted IS NULL LIMIT 1",
                        new SqliteParameter("@n", it.Name), new SqliteParameter("@sku", it.Sku));

                    if (exId > 0)
                    {
                        ExecuteNonQuery(@"UPDATE parts SET gender = @g, category_id = @c, brand = @b, size = @sz, color = @col, style_code = @style,
                                                          selling_price = @price, purchase_price = @cost WHERE id = @id",
                            new SqliteParameter("@id", exId), new SqliteParameter("@g", it.Gender), new SqliteParameter("@c", catId),
                            new SqliteParameter("@b", it.Brand), new SqliteParameter("@sz", it.Size), new SqliteParameter("@col", it.Color),
                            new SqliteParameter("@style", it.Style), new SqliteParameter("@price", it.Price), new SqliteParameter("@cost", it.Cost));
                    }
                    else
                    {
                        ExecuteNonQuery(@"
                            INSERT INTO parts (
                                part_name, part_number, description, category_id,
                                purchase_price, selling_price, quantity_in_stock, minimum_stock_level,
                                barcode, status, date_added, item_type, is_sales_item, is_stock_tracked,
                                brand, size, color, style_code, source_kind, gender
                            ) VALUES (
                                @name, @sku, @desc, @cat,
                                @cost, @price, @stock, 5,
                                @barcode, 'Active', datetime('now'), 'Product', 1, 1,
                                @brand, @size, @color, @style, 'bought', @gender
                            )",
                            new SqliteParameter("@name", it.Name), new SqliteParameter("@sku", it.Sku), new SqliteParameter("@desc", it.Desc),
                            new SqliteParameter("@cat", catId), new SqliteParameter("@cost", it.Cost), new SqliteParameter("@price", it.Price),
                            new SqliteParameter("@stock", it.Stock), new SqliteParameter("@barcode", it.Barcode), new SqliteParameter("@brand", it.Brand),
                            new SqliteParameter("@size", it.Size), new SqliteParameter("@color", it.Color), new SqliteParameter("@style", it.Style),
                            new SqliteParameter("@gender", it.Gender));

                        int newId = (int)ExecuteScalar<long>("SELECT last_insert_rowid()");
                        ExecuteNonQuery("INSERT OR REPLACE INTO stock_levels (part_id, warehouse_id, quantity, reorder_level) VALUES (@pid, @wid, @qty, 5)",
                            new SqliteParameter("@pid", newId), new SqliteParameter("@wid", mainWhId), new SqliteParameter("@qty", it.Stock));
                    }
                }
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "EnsureMenWomenFashionCatalog failed");
            }
        }

        /// <summary>
        /// Insert demo categories, suppliers, products, customers, and supplier purchase lines for testing.
        /// Skips when sentinel supplier already exists unless force=true.
        /// </summary>
        public static object SeedDemoData(bool force = false)
        {
            EnsureSchema();
            int exists = ExecuteScalar<int>(
                "SELECT COUNT(*) FROM suppliers WHERE supplier_name = @n AND date_deleted IS NULL",
                new SqliteParameter("@n", "Demo Auto Supply"));
            if (exists > 0 && !force)
                return new { seeded = false, reason = "Demo data already present" };

            void EnsureCategory(string name)
            {
                int c = ExecuteScalar<int>("SELECT COUNT(*) FROM categories WHERE category_name = @n",
                    new SqliteParameter("@n", name));
                if (c == 0)
                    ExecuteNonQuery("INSERT INTO categories (category_name, description) VALUES (@n, 'Demo')",
                        new SqliteParameter("@n", name));
            }

            EnsureCategory("Oils");
            EnsureCategory("Filters");
            EnsureCategory("Brakes");
            EnsureCategory("Electrical");
            EnsureCategory("General");

            int EnsureSupplier(string name, string phone, string contact)
            {
                object idObj = ExecuteScalar<object>(
                    "SELECT id FROM suppliers WHERE supplier_name = @n AND date_deleted IS NULL",
                    new SqliteParameter("@n", name));
                if (idObj != null && idObj != DBNull.Value)
                    return Convert.ToInt32(idObj);
                ExecuteNonQuery(
                    @"INSERT INTO suppliers (supplier_name, phone, email, address, contact_person, balance_due, type, date_added)
                      VALUES (@n, @p, '', '', @c, 0, 'Company', datetime('now'))",
                    new SqliteParameter("@n", name),
                    new SqliteParameter("@p", phone),
                    new SqliteParameter("@c", contact));
                return (int)ExecuteScalar<long>("SELECT last_insert_rowid()");
            }

            int sid1 = EnsureSupplier("Demo Auto Supply", "03111111", "Ahmad");
            int sid2 = EnsureSupplier("Demo Parts Hub", "03222222", "Sara");

            int EnsureCustomer(string name, string phone, decimal bal)
            {
                object idObj = ExecuteScalar<object>(
                    "SELECT customer_id FROM customers WHERE full_name = @n AND date_deleted IS NULL",
                    new SqliteParameter("@n", name));
                if (idObj != null && idObj != DBNull.Value)
                    return Convert.ToInt32(idObj);
                ExecuteNonQuery(
                    @"INSERT INTO customers (full_name, phone, email, address, type, credit_limit, current_balance, date_added)
                      VALUES (@n, @p, '', '', 'Retail', 2000, @b, datetime('now'))",
                    new SqliteParameter("@n", name),
                    new SqliteParameter("@p", phone),
                    new SqliteParameter("@b", bal));
                return (int)ExecuteScalar<long>("SELECT last_insert_rowid()");
            }

            EnsureCustomer("Demo Walk-in Ali", "03999901", 150);
            EnsureCustomer("Demo Garage Karim", "03999902", 420);

            int CatId(string name)
            {
                object o = ExecuteScalar<object>("SELECT id FROM categories WHERE category_name = @n",
                    new SqliteParameter("@n", name));
                return o == null || o == DBNull.Value ? 1 : Convert.ToInt32(o);
            }

            void EnsurePart(string name, string cat, int supplierId, decimal cost, decimal price, int stock)
            {
                int found = ExecuteScalar<int>(
                    @"SELECT COUNT(*) FROM parts WHERE LOWER(TRIM(part_name)) = LOWER(TRIM(@n))
                        AND supplier_id = @sid AND date_deleted IS NULL",
                    new SqliteParameter("@n", name),
                    new SqliteParameter("@sid", supplierId));
                if (found > 0) return;
                string sku = "DEMO-" + Guid.NewGuid().ToString("N").Substring(0, 6).ToUpperInvariant();
                string barcode = "BC" + Guid.NewGuid().ToString("N").Substring(0, 10).ToUpperInvariant();
                ExecuteNonQuery(
                    @"INSERT INTO parts (part_name, part_number, description, category_id, supplier_id,
                         purchase_price, selling_price, quantity_in_stock, minimum_stock_level,
                         status, date_added, item_type, is_sales_item, is_purchase_item, is_stock_tracked, barcode)
                      VALUES (@n, @sku, 'Demo', @cat, @sid, @cost, @price, @stock, 2,
                              'Active', datetime('now'), 'Product', 1, 1, 1, @bc)",
                    new SqliteParameter("@n", name),
                    new SqliteParameter("@sku", sku),
                    new SqliteParameter("@cat", CatId(cat)),
                    new SqliteParameter("@sid", supplierId),
                    new SqliteParameter("@cost", cost),
                    new SqliteParameter("@price", price),
                    new SqliteParameter("@stock", stock),
                    new SqliteParameter("@bc", barcode));
            }

            EnsurePart("Engine Oil 5W30 1L", "Oils", sid1, 4.50m, 7.00m, 24);
            EnsurePart("Oil Filter Standard", "Filters", sid1, 2.00m, 4.50m, 40);
            EnsurePart("Brake Pads Front", "Brakes", sid2, 12.00m, 22.00m, 10);
            EnsurePart("Battery 60Ah", "Electrical", sid2, 55.00m, 85.00m, 5);

            var purchaseSvc = new InventorySystem.Services.SupplierPurchaseService();
            purchaseSvc.EnsureTable();

            // Unadded lines (for import testing) + one debt / one paid
            void AddPurchase(int sid, string name, string cat, decimal qty, decimal price, bool paid)
            {
                int dup = ExecuteScalar<int>(
                    @"SELECT COUNT(*) FROM supplier_purchase_items
                      WHERE supplier_id = @sid AND item_name = @n AND date_deleted IS NULL AND part_id IS NULL",
                    new SqliteParameter("@sid", sid),
                    new SqliteParameter("@n", name));
                if (dup > 0 && !force) return;
                purchaseSvc.AddItem(sid, name, cat, qty, price, paid, "Demo seed");
            }

            AddPurchase(sid1, "Air Filter Cabin", "Filters", 15, 3.25m, false);
            AddPurchase(sid1, "Engine Oil 5W30 1L", "Oils", 12, 4.75m, true); // exists → import should add stock
            AddPurchase(sid2, "Spark Plug Iridium", "Electrical", 20, 6.00m, false);
            AddPurchase(sid2, "Brake Fluid DOT4", "Brakes", 8, 5.50m, false);
            AddPurchase(sid2, "Brake Pads Front", "Brakes", 4, 11.50m, false); // exists → add stock

            return new
            {
                seeded = true,
                suppliers = new[] { "Demo Auto Supply", "Demo Parts Hub" },
                categories = new[] { "Oils", "Filters", "Brakes", "Electrical" },
                note = "Open Suppliers → Add product, or Inventory → From supplier to import lines."
            };
        }

        private static bool ColumnExists(string tableName, string columnName)
        {
            try
            {
                DataTable dt = ExecuteDataTable($"PRAGMA table_info({tableName})");
                foreach (DataRow row in dt.Rows)
                {
                    if (row["name"].ToString().Equals(columnName, StringComparison.OrdinalIgnoreCase))
                        return true;
                }
            }
            catch { }
            return false;
        }
    }
}
