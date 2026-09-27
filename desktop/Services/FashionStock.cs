using System;
using Microsoft.Data.Sqlite;
using InventorySystem.Helpers;

namespace InventorySystem.Services
{
    public static class FashionStock
    {
        public static int EnsureMainWarehouse()
        {
            int id = DatabaseHelper.ExecuteScalar<int>("SELECT id FROM warehouses WHERE code = 'MAIN' LIMIT 1");
            if (id > 0) return id;
            DatabaseHelper.ExecuteNonQuery("INSERT INTO warehouses (name, code) VALUES ('Main', 'MAIN')");
            return DatabaseHelper.ExecuteScalar<int>("SELECT id FROM warehouses WHERE code = 'MAIN' LIMIT 1");
        }

        public static void Reconcile(int partId)
        {
            if (partId <= 0) return;
            try
            {
                int mainId = EnsureMainWarehouse();
                var dt = DatabaseHelper.ExecuteDataTable(
                    "SELECT COALESCE(quantity_in_stock,0) AS qty, COALESCE(minimum_stock_level,0) AS minlvl FROM parts WHERE id = @id",
                    new SqliteParameter("@id", partId));
                if (dt.Rows.Count == 0) return;

                int total = Convert.ToInt32(dt.Rows[0]["qty"]);
                int reorder = Convert.ToInt32(dt.Rows[0]["minlvl"]);
                int other = DatabaseHelper.ExecuteScalar<int>(
                    "SELECT COALESCE(SUM(quantity),0) FROM stock_levels WHERE part_id = @id AND warehouse_id <> @w",
                    new SqliteParameter("@id", partId),
                    new SqliteParameter("@w", mainId));
                int mainQty = total - other;
                if (mainQty < 0)
                {
                    int deficit = -mainQty;
                    mainQty = 0;
                    var rows = DatabaseHelper.ExecuteDataTable(
                        "SELECT id, quantity FROM stock_levels WHERE part_id = @id AND warehouse_id <> @w AND quantity > 0 ORDER BY quantity DESC",
                        new SqliteParameter("@id", partId),
                        new SqliteParameter("@w", mainId));
                    foreach (System.Data.DataRow row in rows.Rows)
                    {
                        if (deficit <= 0) break;
                        int levelId = Convert.ToInt32(row["id"]);
                        int qty = Convert.ToInt32(row["quantity"]);
                        int take = Math.Min(qty, deficit);
                        DatabaseHelper.ExecuteNonQuery(
                            "UPDATE stock_levels SET quantity = @q WHERE id = @id",
                            new SqliteParameter("@q", qty - take),
                            new SqliteParameter("@id", levelId));
                        deficit -= take;
                    }
                }
                Upsert(partId, mainId, mainQty, reorder);
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "FashionStock.Reconcile");
            }
        }

        public static void Upsert(int partId, int warehouseId, int quantity, int reorder)
        {
            DatabaseHelper.ExecuteNonQuery(@"
                INSERT INTO stock_levels (part_id, warehouse_id, quantity, reorder_level)
                VALUES (@p, @w, @q, @r)
                ON CONFLICT(part_id, warehouse_id) DO UPDATE SET quantity = @q, reorder_level = @r",
                new SqliteParameter("@p", partId),
                new SqliteParameter("@w", warehouseId),
                new SqliteParameter("@q", quantity),
                new SqliteParameter("@r", reorder));
        }

        public static void LogMovement(int partId, string type, int quantity, string notes, int? warehouseId = null, string referenceType = null, int? referenceId = null)
        {
            if (partId <= 0) return;
            try
            {
                int balance = DatabaseHelper.ExecuteScalar<int>(
                    "SELECT COALESCE(quantity_in_stock,0) FROM parts WHERE id = @id",
                    new SqliteParameter("@id", partId));
                DatabaseHelper.ExecuteNonQuery(@"
                    INSERT INTO stock_movements (part_id, warehouse_id, movement_type, quantity, balance_after, performed_by, notes, movement_date, reference_type, reference_id)
                    VALUES (@p, @w, @t, @q, @b, @u, @n, datetime('now'), @rt, @ri)",
                    new SqliteParameter("@p", partId),
                    new SqliteParameter("@w", warehouseId.HasValue ? warehouseId.Value : DBNull.Value),
                    new SqliteParameter("@t", type ?? ""),
                    new SqliteParameter("@q", quantity),
                    new SqliteParameter("@b", balance),
                    new SqliteParameter("@u", UserSession.Username ?? "Web"),
                    new SqliteParameter("@n", notes ?? ""),
                    new SqliteParameter("@rt", (object)referenceType ?? DBNull.Value),
                    new SqliteParameter("@ri", referenceId.HasValue ? referenceId.Value : DBNull.Value));
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "FashionStock.LogMovement");
            }
        }

        public static void SetWarehouseQty(int partId, int warehouseId, int quantity)
        {
            if (partId <= 0 || warehouseId <= 0) return;
            int reorder = DatabaseHelper.ExecuteScalar<int>(
                "SELECT COALESCE(minimum_stock_level,0) FROM parts WHERE id = @id",
                new SqliteParameter("@id", partId));
            int previous = DatabaseHelper.ExecuteScalar<int>(
                "SELECT COALESCE(quantity,0) FROM stock_levels WHERE part_id = @p AND warehouse_id = @w",
                new SqliteParameter("@p", partId),
                new SqliteParameter("@w", warehouseId));
            Upsert(partId, warehouseId, Math.Max(0, quantity), reorder);
            SyncPartTotal(partId);
            int delta = quantity - previous;
            if (delta != 0)
                LogMovement(partId, delta > 0 ? "Purchase" : "Adjustment", delta, delta > 0 ? "Stock added" : "Stock adjusted", warehouseId);
        }

        public static void ReplaceGallery(int partId, System.Collections.Generic.IList<string> paths)
        {
            if (partId <= 0 || paths == null) return;
            DatabaseHelper.ExecuteNonQuery("DELETE FROM product_images WHERE part_id = @id", new SqliteParameter("@id", partId));
            int order = 0;
            foreach (string path in paths)
            {
                if (string.IsNullOrWhiteSpace(path)) continue;
                DatabaseHelper.ExecuteNonQuery(
                    "INSERT INTO product_images (part_id, image_path, sort_order) VALUES (@p, @img, @s)",
                    new SqliteParameter("@p", partId),
                    new SqliteParameter("@img", path.Trim()),
                    new SqliteParameter("@s", order++));
            }
        }

        public static void SyncPartTotal(int partId)
        {
            int total = DatabaseHelper.ExecuteScalar<int>(
                "SELECT COALESCE(SUM(quantity),0) FROM stock_levels WHERE part_id = @id",
                new SqliteParameter("@id", partId));
            DatabaseHelper.ExecuteNonQuery(
                "UPDATE parts SET quantity_in_stock = @q WHERE id = @id",
                new SqliteParameter("@q", total),
                new SqliteParameter("@id", partId));
        }
    }
}
