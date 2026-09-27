using System;
using System.Collections.Generic;
using System.Linq;

namespace InventorySystem.Services.Cloud
{
    /// <summary>How one shop table is shared between laptops.</summary>
    internal sealed class SyncTable
    {
        public string Name { get; init; }
        public string Pk { get; init; }
        /// <summary>Position in parent-before-child order; parents are inserted first when data arrives.</summary>
        public int Rank { get; set; }
        /// <summary>Column → referenced table. Local ids differ per laptop, so these travel as hub ids.</summary>
        public Dictionary<string, string> Fks { get; init; } = new(StringComparer.OrdinalIgnoreCase);
        /// <summary>A (type, id) pair whose target table depends on the type value, e.g. payments.entity_type.</summary>
        public string PolyTypeColumn { get; init; }
        public string PolyIdColumn { get; init; }
        public Dictionary<string, string> PolyTargets { get; init; } = new(StringComparer.OrdinalIgnoreCase);
        /// <summary>Running totals (stock, balances). Laptops send the change, never the value, so concurrent sales add up.</summary>
        public HashSet<string> Counters { get; init; } = new(StringComparer.OrdinalIgnoreCase);
        /// <summary>Columns encrypted with the shop secret before they leave the laptop.</summary>
        public HashSet<string> Encrypted { get; init; } = new(StringComparer.OrdinalIgnoreCase);
        /// <summary>Image path columns; the file itself is uploaded and the path rewritten to Assets/Products/&lt;hash&gt;.</summary>
        public HashSet<string> Files { get; init; } = new(StringComparer.OrdinalIgnoreCase);

        public string TargetOf(string column, Func<string, string> typeValue)
        {
            if (Fks.TryGetValue(column, out string table)) return table;
            if (PolyIdColumn != null && column.Equals(PolyIdColumn, StringComparison.OrdinalIgnoreCase))
            {
                string type = typeValue(PolyTypeColumn);
                if (type != null && PolyTargets.TryGetValue(type.Trim(), out string target)) return target;
            }
            return null;
        }
    }

    internal static class SyncTables
    {
        private static Dictionary<string, string> Fk(params string[] pairs)
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i + 1 < pairs.Length; i += 2) map[pairs[i]] = pairs[i + 1];
            return map;
        }

        private static HashSet<string> Cols(params string[] names) => new(names, StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Every table that belongs to the shop, parents before children. Machine-local tables
        /// (app_settings, currency_rates, licence, printers) are deliberately absent.
        /// </summary>
        public static readonly IReadOnlyList<SyncTable> All = Build();

        private static readonly Dictionary<string, SyncTable> ByName =
            All.ToDictionary(t => t.Name, StringComparer.OrdinalIgnoreCase);

        public static SyncTable Get(string name) => name != null && ByName.TryGetValue(name, out var t) ? t : null;

        private static List<SyncTable> Build()
        {
            var list = new List<SyncTable>
            {
                new() { Name = "users", Pk = "id", Encrypted = Cols("password") },
                new() { Name = "categories", Pk = "id", Files = Cols("category_image") },
                new() { Name = "suppliers", Pk = "id", Counters = Cols("balance_due") },
                new() { Name = "customers", Pk = "customer_id", Counters = Cols("current_balance") },
                new() { Name = "warehouses", Pk = "id" },
                new() { Name = "expense_categories", Pk = "category_id" },
                new() { Name = "units_of_measure", Pk = "unit_id" },
                new() { Name = "profit_parties", Pk = "id" },
                new() { Name = "profit_collections", Pk = "id" },
                new() { Name = "expenses", Pk = "expense_id" },
                new() { Name = "transactions", Pk = "id" },
                new() { Name = "parts", Pk = "id", Fks = Fk("category_id", "categories", "supplier_id", "suppliers"),
                        Counters = Cols("quantity_in_stock"), Files = Cols("part_image") },
                new() { Name = "product_images", Pk = "id", Fks = Fk("part_id", "parts"), Files = Cols("image_path") },
                new() { Name = "product_materials", Pk = "id", Fks = Fk("part_id", "parts", "supplier_id", "suppliers") },
                new() { Name = "stock_levels", Pk = "id", Fks = Fk("part_id", "parts", "warehouse_id", "warehouses"),
                        Counters = Cols("quantity") },
                new() { Name = "purchase_orders", Pk = "po_id", Fks = Fk("supplier_id", "suppliers", "warehouse_id", "warehouses") },
                new() { Name = "purchase_order_items", Pk = "po_item_id", Fks = Fk("po_id", "purchase_orders", "part_id", "parts") },
                new() { Name = "supplier_purchase_items", Pk = "id", Fks = Fk("supplier_id", "suppliers", "part_id", "parts") },
                new() { Name = "stock_transfers", Pk = "id", Fks = Fk("from_warehouse_id", "warehouses", "to_warehouse_id", "warehouses") },
                new() { Name = "stock_transfer_items", Pk = "id", Fks = Fk("transfer_id", "stock_transfers", "part_id", "parts") },
                new() { Name = "orders", Pk = "order_id", Fks = Fk("customer_id", "customers") },
                new() { Name = "order_items", Pk = "order_item_id", Fks = Fk("order_id", "orders", "part_id", "parts") },
                new() { Name = "order_pack_checks", Pk = "id", Fks = Fk("order_id", "orders", "order_item_id", "order_items") },
                new() { Name = "order_events", Pk = "id", Fks = Fk("order_id", "orders") },
                new() { Name = CloudStore.WebLinksTable, Pk = "id", Fks = Fk("order_id", "orders") },
                new() { Name = "returns", Pk = "return_id", Fks = Fk("order_id", "orders") },
                new() { Name = "return_items", Pk = "return_item_id", Fks = Fk("return_id", "returns", "part_id", "parts") },
                new()
                {
                    Name = "payments", Pk = "payment_id",
                    PolyTypeColumn = "entity_type", PolyIdColumn = "entity_id",
                    PolyTargets = Fk("Customer", "customers", "Supplier", "suppliers")
                },
                new()
                {
                    Name = "stock_movements", Pk = "id", Fks = Fk("part_id", "parts", "warehouse_id", "warehouses"),
                    PolyTypeColumn = "reference_type", PolyIdColumn = "reference_id",
                    PolyTargets = Fk("Order", "orders", "PO", "purchase_orders", "Transfer", "stock_transfers")
                },
            };
            for (int i = 0; i < list.Count; i++) list[i].Rank = i;
            return list;
        }
    }
}
