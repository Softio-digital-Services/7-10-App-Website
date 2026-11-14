using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using InventorySystem.Helpers;

namespace InventorySystem.Services
{
    /// <summary>
    /// Promotions: % off or a fixed sale price on some products, a category, a collection or the whole shop,
    /// between two dates, in the shop, on the website or both. When several promotions cover one item the
    /// lowest price wins (they never stack with each other). A POS discount can still be added on top.
    /// Promotion prices are looked up live and never written into a product's normal selling price.
    /// </summary>
    public static class PromotionService
    {
        public sealed class Promo
        {
            public int Id { get; set; }
            public string Name { get; set; }
            public string Kind { get; set; }          // percent | price
            public decimal Value { get; set; }
            public string Scope { get; set; }         // all | products | category | collection
            public string ScopeValue { get; set; }    // category or collection name
            public DateTime From { get; set; }
            public DateTime To { get; set; }
            public string Channel { get; set; }       // both | shop | web
            public bool Active { get; set; }
            public HashSet<int> PartIds { get; set; } = new HashSet<int>();

            public bool RunsOn(DateTime day) => Active && day.Date >= From.Date && day.Date <= To.Date;
            public bool InChannel(string channel) => channel == null || Channel == "both" || Channel == channel;

            public decimal PriceFor(decimal listPrice)
            {
                if (listPrice <= 0) return listPrice;
                decimal p = Kind == "price"
                    ? Value
                    : Math.Round(listPrice * (100m - Math.Min(100m, Math.Max(0m, Value))) / 100m, 2, MidpointRounding.AwayFromZero);
                return Math.Max(0, Math.Min(listPrice, p));
            }
        }

        public sealed class PartInfo
        {
            public int Id { get; set; }
            public decimal Price { get; set; }
            public decimal Cost { get; set; }
            public string Category { get; set; }
            public string Collection { get; set; }
        }

        public sealed class Applied
        {
            public Promo Promo { get; set; }
            public decimal ListPrice { get; set; }
            public decimal Price { get; set; }
        }

        public static List<Promo> LoadAll()
        {
            var list = new List<Promo>();
            var dt = DatabaseHelper.ExecuteDataTable(
                "SELECT id, name, kind, value, scope, scope_value, date_from, date_to, channel, is_active FROM promotions ORDER BY date_from DESC, id DESC");
            foreach (DataRow r in dt.Rows)
            {
                list.Add(new Promo
                {
                    Id = Convert.ToInt32(r["id"]),
                    Name = r["name"]?.ToString() ?? "",
                    Kind = r["kind"]?.ToString() == "price" ? "price" : "percent",
                    Value = r["value"] == DBNull.Value ? 0 : Convert.ToDecimal(r["value"]),
                    Scope = r["scope"]?.ToString() ?? "all",
                    ScopeValue = r["scope_value"]?.ToString() ?? "",
                    From = ParseDay(r["date_from"]?.ToString()),
                    To = ParseDay(r["date_to"]?.ToString()),
                    Channel = r["channel"]?.ToString() ?? "both",
                    Active = r["is_active"] != DBNull.Value && Convert.ToInt32(r["is_active"]) != 0
                });
            }
            if (list.Count > 0)
            {
                var byId = list.ToDictionary(p => p.Id);
                var items = DatabaseHelper.ExecuteDataTable("SELECT promotion_id, part_id FROM promotion_items");
                foreach (DataRow r in items.Rows)
                    if (byId.TryGetValue(Convert.ToInt32(r["promotion_id"]), out var p)) p.PartIds.Add(Convert.ToInt32(r["part_id"]));
            }
            return list;
        }

        public static bool Covers(Promo promo, PartInfo part) => promo.Scope switch
        {
            "products" => promo.PartIds.Contains(part.Id),
            "category" => Same(promo.ScopeValue, part.Category),
            "collection" => Same(promo.ScopeValue, part.Collection),
            _ => true
        };

        /// <summary>Best (lowest) promotion price for a product on a day, or null when none applies.</summary>
        public static Applied Best(IEnumerable<Promo> promos, PartInfo part, DateTime day, string channel)
        {
            Applied best = null;
            foreach (var promo in promos)
            {
                if (!promo.RunsOn(day) || !promo.InChannel(channel) || !Covers(promo, part)) continue;
                decimal price = promo.PriceFor(part.Price);
                if (price >= part.Price) continue;
                if (best == null || price < best.Price) best = new Applied { Promo = promo, ListPrice = part.Price, Price = price };
            }
            return best;
        }

        public static List<PartInfo> LoadParts(int? partId = null)
        {
            var dt = DatabaseHelper.ExecuteDataTable(@"
                SELECT p.id, COALESCE(p.selling_price, 0) AS price, COALESCE(p.purchase_price, 0) AS cost,
                       COALESCE(c.category_name, '') AS category, COALESCE(p.collection, '') AS collection
                FROM parts p LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.date_deleted IS NULL" + (partId.HasValue ? " AND p.id = @id" : ""),
                partId.HasValue ? new[] { new SqliteParameter("@id", partId.Value) } : Array.Empty<SqliteParameter>());
            return dt.Rows.Cast<DataRow>().Select(r => new PartInfo
            {
                Id = Convert.ToInt32(r["id"]),
                Price = Convert.ToDecimal(r["price"]),
                Cost = Convert.ToDecimal(r["cost"]),
                Category = r["category"]?.ToString() ?? "",
                Collection = r["collection"]?.ToString() ?? ""
            }).ToList();
        }

        /// <summary>
        /// For a sale line being saved: the product's normal price, and the promotion it was sold under
        /// (when the charged price matches a running promotion). Covers POS, order screen and website orders alike.
        /// </summary>
        public static (decimal? listPrice, int? promotionId) Attribute(int partId, decimal unitPrice)
        {
            if (partId <= 0) return (null, null);
            try
            {
                var part = LoadParts(partId).FirstOrDefault();
                if (part == null) return (null, null);
                var best = Best(LoadAll(), part, DateTime.Today, null);
                bool sold = best != null && unitPrice <= best.Price + 0.005m;
                return (part.Price, sold ? best.Promo.Id : (int?)null);
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "PromotionService.Attribute");
                return (null, null);
            }
        }

        private static bool Same(string a, string b) =>
            !string.IsNullOrWhiteSpace(a) && string.Equals(a.Trim(), (b ?? "").Trim(), StringComparison.OrdinalIgnoreCase);

        private static DateTime ParseDay(string s) =>
            DateTime.TryParseExact((s ?? "").Length >= 10 ? s.Substring(0, 10) : s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
                ? d : DateTime.MinValue;

        // ------------------------------------------------------------------ API

        private sealed class PromoBody
        {
            public string Name { get; set; }
            public string Kind { get; set; }
            public decimal Value { get; set; }
            public string Scope { get; set; }
            public string ScopeValue { get; set; }
            public List<int> PartIds { get; set; }
            public string DateFrom { get; set; }
            public string DateTo { get; set; }
            public string Channel { get; set; }
            public bool? Active { get; set; }
        }

        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        public static void Map(WebApplication app)
        {
            app.MapGet("/api/promotions", List);
            app.MapPost("/api/promotions", async (HttpRequest r) => await Save(r, null));
            app.MapPost("/api/promotions/{id:int}/update", async (int id, HttpRequest r) => await Save(r, id));
            app.MapPost("/api/promotions/{id:int}/active", async (int id, HttpRequest r) => await SetActive(id, r));
            app.MapPost("/api/promotions/{id:int}/delete", Delete);
            app.MapGet("/api/promotions/prices", Prices);
        }

        private static IResult List()
        {
            try
            {
                var today = DateTime.Today;
                var parts = LoadParts();
                var promos = LoadAll();
                return Results.Ok(promos.Select(p =>
                {
                    var covered = parts.Where(x => Covers(p, x) && x.Price > 0).ToList();
                    string status = !p.Active ? "paused" : today < p.From.Date ? "scheduled" : today > p.To.Date ? "ended" : "running";
                    return new
                    {
                        id = p.Id,
                        name = p.Name,
                        kind = p.Kind,
                        value = p.Value,
                        scope = p.Scope,
                        scopeValue = p.ScopeValue,
                        partIds = p.PartIds.ToList(),
                        dateFrom = p.From.ToString("yyyy-MM-dd"),
                        dateTo = p.To.ToString("yyyy-MM-dd"),
                        channel = p.Channel,
                        active = p.Active,
                        status,
                        itemCount = covered.Count,
                        // Items this promotion would sell below their cost (a loss on every sale)
                        belowCost = covered.Count(x => x.Cost > 0 && p.PriceFor(x.Price) < x.Cost)
                    };
                }));
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        /// <summary>Promotion prices in effect today for the shop (POS and order screen).</summary>
        private static IResult Prices()
        {
            try
            {
                var promos = LoadAll().Where(p => p.RunsOn(DateTime.Today) && p.InChannel("shop")).ToList();
                var map = new Dictionary<string, object>();
                if (promos.Count > 0)
                {
                    foreach (var part in LoadParts())
                    {
                        var best = Best(promos, part, DateTime.Today, "shop");
                        if (best == null) continue;
                        map[part.Id.ToString(CultureInfo.InvariantCulture)] = new
                        {
                            promotionId = best.Promo.Id,
                            name = best.Promo.Name,
                            listPrice = best.ListPrice,
                            price = best.Price
                        };
                    }
                }
                return Results.Ok(map);
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static string Validate(PromoBody b, out DateTime from, out DateTime to)
        {
            from = to = DateTime.MinValue;
            if (b == null || string.IsNullOrWhiteSpace(b.Name)) return "Enter a name.";
            if (b.Name.Trim().Length > 80) return "Name is too long.";
            if (b.Kind == "price" ? b.Value <= 0 : (b.Value <= 0 || b.Value >= 100)) return b.Kind == "price"
                ? "Enter the sale price." : "Enter a discount between 1 and 99 %.";
            from = ParseDay(b.DateFrom);
            to = ParseDay(b.DateTo);
            if (from == DateTime.MinValue || to == DateTime.MinValue) return "Choose the start and end dates.";
            if (to < from) return "The end date is before the start date.";
            string scope = b.Scope ?? "all";
            if (scope == "products" && (b.PartIds == null || b.PartIds.Count == 0)) return "Choose at least one product.";
            if ((scope == "category" || scope == "collection") && string.IsNullOrWhiteSpace(b.ScopeValue))
                return scope == "category" ? "Choose a category." : "Choose a collection.";
            return null;
        }

        private static async System.Threading.Tasks.Task<IResult> Save(HttpRequest request, int? id)
        {
            try
            {
                var b = await JsonSerializer.DeserializeAsync<PromoBody>(request.Body, JsonOpts);
                string error = Validate(b, out var from, out var to);
                if (error != null) return Results.BadRequest(new { error });
                string kind = b.Kind == "price" ? "price" : "percent";
                string scope = b.Scope is "products" or "category" or "collection" ? b.Scope : "all";
                string channel = b.Channel is "shop" or "web" ? b.Channel : "both";
                var ps = new[]
                {
                    new SqliteParameter("@n", b.Name.Trim()),
                    new SqliteParameter("@k", kind),
                    new SqliteParameter("@v", b.Value),
                    new SqliteParameter("@s", scope),
                    new SqliteParameter("@sv", scope is "category" or "collection" ? b.ScopeValue.Trim() : ""),
                    new SqliteParameter("@f", from.ToString("yyyy-MM-dd")),
                    new SqliteParameter("@t", to.ToString("yyyy-MM-dd")),
                    new SqliteParameter("@c", channel),
                    new SqliteParameter("@a", b.Active == false ? 0 : 1),
                    new SqliteParameter("@id", id ?? 0)
                };
                int promoId;
                if (id.HasValue)
                {
                    int exists = DatabaseHelper.ExecuteScalar<int>("SELECT COUNT(*) FROM promotions WHERE id = @id", new SqliteParameter("@id", id.Value));
                    if (exists == 0) return Results.NotFound();
                    DatabaseHelper.ExecuteNonQuery(@"UPDATE promotions SET name=@n, kind=@k, value=@v, scope=@s, scope_value=@sv,
                        date_from=@f, date_to=@t, channel=@c, is_active=@a WHERE id=@id", ps);
                    promoId = id.Value;
                }
                else
                {
                    DatabaseHelper.ExecuteNonQuery(@"INSERT INTO promotions (name, kind, value, scope, scope_value, date_from, date_to, channel, is_active)
                        VALUES (@n, @k, @v, @s, @sv, @f, @t, @c, @a)", ps);
                    promoId = DatabaseHelper.ExecuteScalar<int>("SELECT MAX(id) FROM promotions");
                }

                // Product list: only touch rows that change, so sync sends the smallest set of edits
                var wanted = scope == "products" ? new HashSet<int>(b.PartIds.Where(x => x > 0)) : new HashSet<int>();
                var current = DatabaseHelper.ExecuteDataTable("SELECT id, part_id FROM promotion_items WHERE promotion_id = @p",
                    new SqliteParameter("@p", promoId)).Rows.Cast<DataRow>()
                    .Select(r => (row: Convert.ToInt32(r["id"]), part: Convert.ToInt32(r["part_id"]))).ToList();
                foreach (var c in current.Where(c => !wanted.Contains(c.part)))
                    DatabaseHelper.ExecuteNonQuery("DELETE FROM promotion_items WHERE id = @id", new SqliteParameter("@id", c.row));
                var have = current.Select(c => c.part).ToHashSet();
                foreach (int part in wanted.Where(p => !have.Contains(p)))
                    DatabaseHelper.ExecuteNonQuery("INSERT INTO promotion_items (promotion_id, part_id) VALUES (@p, @part)",
                        new SqliteParameter("@p", promoId), new SqliteParameter("@part", part));

                return Results.Ok(new { success = true, id = promoId });
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> SetActive(int id, HttpRequest request)
        {
            try
            {
                using var doc = await JsonDocument.ParseAsync(request.Body);
                bool active = doc.RootElement.TryGetProperty("active", out var a) && a.ValueKind == JsonValueKind.True;
                DatabaseHelper.ExecuteNonQuery("UPDATE promotions SET is_active = @a WHERE id = @id",
                    new SqliteParameter("@a", active ? 1 : 0), new SqliteParameter("@id", id));
                return Results.Ok(new { success = true });
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static IResult Delete(int id)
        {
            try
            {
                // Sales made under it must keep a named promotion in the reports: pause it instead
                int sold = DatabaseHelper.ExecuteScalar<int>("SELECT COUNT(*) FROM order_items WHERE promotion_id = @id", new SqliteParameter("@id", id));
                if (sold > 0)
                    return Results.BadRequest(new { error = "This promotion already has sales, so it stays for the reports. Pause it instead." });
                DatabaseHelper.ExecuteNonQuery("DELETE FROM promotion_items WHERE promotion_id = @id", new SqliteParameter("@id", id));
                DatabaseHelper.ExecuteNonQuery("DELETE FROM promotions WHERE id = @id", new SqliteParameter("@id", id));
                return Results.Ok(new { success = true });
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }
    }
}
