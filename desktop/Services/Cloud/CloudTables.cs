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
        /// <summary>Only these columns leave this PC (empty = all). Keeps cost, supplier, notes... local.</summary>
        public HashSet<string> Columns { get; init; } = new(StringComparer.OrdinalIgnoreCase);
        /// <summary>This PC sends the table to the website (the public catalogue).</summary>
        public bool Outbound { get; init; } = true;
        /// <summary>This PC accepts the table from the website (customer accounts created there).</summary>
        public bool Inbound { get; init; }

        public bool Sends(string column) => Columns.Count == 0 || Columns.Contains(column);

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
        /// What passes between this PC and the website. All business data (sales, costs, expenses, suppliers,
        /// purchase orders, payments, staff, the shop's customer list) stays on this PC and is not listed here.
        /// The website only receives the public catalogue, and sends back accounts its customers created
        /// (website orders travel separately, see TakeWebOrders). Parents before children.
        /// </summary>
        public static readonly IReadOnlyList<SyncTable> All = Build();

        /// <summary>Units the website keeps back for the shop, so the last item can still be sold in store.</summary>
        public const int WebStockReserve = 1;
        /// <summary>The website never learns more than this per item, so it cannot reveal real inventory.</summary>
        public const int WebStockCap = 10;

        private static readonly Dictionary<string, SyncTable> ByName =
            All.ToDictionary(t => t.Name, StringComparer.OrdinalIgnoreCase);

        public static SyncTable Get(string name) => name != null && ByName.TryGetValue(name, out var t) ? t : null;

        private static List<SyncTable> Build()
        {
            var list = new List<SyncTable>
            {
                // --- Public catalogue: this PC -> website (one way). Only the listed columns leave the PC.
                new() { Name = "categories", Pk = "id", Files = Cols("category_image"),
                        Columns = Cols("category_name", "category_name_ar", "category_image", "sort_order", "description") },
                // parts: no cost, supplier, location, notes or real stock; web_stock is added when sending
                new() { Name = "parts", Pk = "id", Fks = Fk("category_id", "categories"), Files = Cols("part_image"),
                        Columns = Cols("part_name", "part_number", "description", "selling_price", "category_id", "part_image",
                            "status", "is_inactive", "is_sales_item", "item_type", "date_deleted", "size", "color", "style_code",
                            "gender", "fabric", "collection", "is_new") },
                new() { Name = "product_images", Pk = "id", Fks = Fk("part_id", "parts"), Files = Cols("image_path"),
                        Columns = Cols("part_id", "image_path", "sort_order") },
                new() { Name = "promotions", Pk = "id" },
                new() { Name = "promotion_items", Pk = "id", Fks = Fk("promotion_id", "promotions", "part_id", "parts") },
                // Website content edited in the Website screen and shown on the 7.10 website.
                new() { Name = "site_settings", Pk = "id" },
                new() { Name = "site_media", Pk = "id", Files = Cols("image_path") },
                new() { Name = "site_reviews", Pk = "id" },

                // --- From the website: customers create these there; this PC takes them in.
                // The shop's own customer list is never sent (Outbound = false); a website customer entry is
                // matched here to an existing customer by email / phone.
                new() { Name = "customers", Pk = "customer_id", Outbound = false, Inbound = true },
                // Accounts and addresses go both ways: staff may correct an address, which updates the account page.
                new() { Name = "web_accounts", Pk = "id", Fks = Fk("customer_id", "customers"), Inbound = true },
                new() { Name = "web_addresses", Pk = "id", Fks = Fk("account_id", "web_accounts"), Inbound = true },
            };
            for (int i = 0; i < list.Count; i++) list[i].Rank = i;
            return list;
        }
    }
}
