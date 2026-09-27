using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using InventorySystem.Helpers;

namespace InventorySystem.Services
{
    public static class ProfitShareApi
    {
        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        private const string SalesFilter =
            "o.status IS NOT NULL AND o.status NOT IN ('Draft', 'Quotation', 'Cancelled')";

        public static void Map(WebApplication app)
        {
            app.MapGet("/api/profit-shares", GetShares);
            app.MapPost("/api/profit-parties", AddParty);
            app.MapPost("/api/profit-parties/{id:int}/update", UpdateParty);
            app.MapPost("/api/profit-parties/{id:int}/delete", DeleteParty);
            app.MapPost("/api/profit-collections", AddCollection);
            app.MapPost("/api/profit-collections/{id:int}/update", UpdateCollection);
            app.MapPost("/api/profit-collections/{id:int}/delete", DeleteCollection);
        }

        private static IResult GetShares(HttpRequest request)
        {
            string mode = request.Query["mode"].ToString();
            int? year = TryInt(request.Query["year"]);
            int? month = TryInt(request.Query["month"]);
            int? collectionId = TryInt(request.Query["collectionId"]);
            try
            {
                var parties = LoadParties();
                var collections = LoadCollections();
                var range = ResolveRange(mode, year, month, collectionId);
                decimal sales = 0, cost = 0, expenses = 0;
                if (range.ok)
                {
                    sales = Sum($@"
                        SELECT COALESCE(SUM(oi.quantity * oi.price), 0)
                        FROM order_items oi
                        INNER JOIN orders o ON oi.order_id = o.order_id
                        WHERE date(o.order_date) BETWEEN date(@from) AND date(@to)
                          AND {SalesFilter}", range.from, range.to);
                    cost = Sum($@"
                        SELECT COALESCE(SUM(oi.quantity * COALESCE(p.purchase_price, 0)), 0)
                        FROM order_items oi
                        INNER JOIN orders o ON oi.order_id = o.order_id
                        INNER JOIN parts p ON oi.part_id = p.id
                        WHERE date(o.order_date) BETWEEN date(@from) AND date(@to)
                          AND {SalesFilter}", range.from, range.to);
                    expenses = Sum(@"
                        SELECT COALESCE(SUM(amount), 0)
                        FROM expenses
                        WHERE date(expense_date) BETWEEN date(@from) AND date(@to)
                          AND date_deleted IS NULL", range.from, range.to);
                }

                decimal profit = sales - cost - expenses;
                decimal percentTotal = 0;
                var shares = new List<object>();
                var rounded = new List<decimal>();
                foreach (var party in parties)
                {
                    percentTotal += party.Percent;
                    rounded.Add(Math.Round(profit * party.Percent / 100m, 2, MidpointRounding.AwayFromZero));
                }
                if (parties.Count > 0 && Math.Abs(percentTotal - 100m) < 0.001m)
                {
                    decimal drift = profit - 0m;
                    foreach (var amount in rounded) drift -= amount;
                    rounded[rounded.Count - 1] += drift;
                }
                for (int i = 0; i < parties.Count; i++)
                {
                    shares.Add(new
                    {
                        id = parties[i].Id,
                        name = parties[i].Name,
                        percent = parties[i].Percent,
                        amount = rounded[i]
                    });
                }

                return Results.Ok(new
                {
                    mode = range.mode,
                    from = range.ok ? range.from.ToString("yyyy-MM-dd") : "",
                    to = range.ok ? range.to.ToString("yyyy-MM-dd") : "",
                    label = range.label,
                    needsCollection = range.needsCollection,
                    sales,
                    cost,
                    expenses,
                    profit,
                    percentTotal,
                    parties = shares,
                    collections
                });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }

        private static async Task<IResult> AddParty(HttpRequest request)
        {
            var body = await Read<PartyBody>(request);
            var error = ValidateParty(body);
            if (error != null) return Results.BadRequest(new { error });
            int sort = DatabaseHelper.ExecuteScalar<int>("SELECT COALESCE(MAX(sort_order), 0) FROM profit_parties") + 1;
            DatabaseHelper.ExecuteNonQuery(
                "INSERT INTO profit_parties (name, percent, sort_order) VALUES (@name, @percent, @sort)",
                new SqliteParameter("@name", body.Name.Trim()),
                new SqliteParameter("@percent", body.Percent),
                new SqliteParameter("@sort", sort));
            return Results.Ok(new { ok = true });
        }

        private static async Task<IResult> UpdateParty(int id, HttpRequest request)
        {
            var body = await Read<PartyBody>(request);
            var error = ValidateParty(body);
            if (error != null) return Results.BadRequest(new { error });
            DatabaseHelper.ExecuteNonQuery(
                "UPDATE profit_parties SET name = @name, percent = @percent WHERE id = @id",
                new SqliteParameter("@name", body.Name.Trim()),
                new SqliteParameter("@percent", body.Percent),
                new SqliteParameter("@id", id));
            return Results.Ok(new { ok = true });
        }

        private static IResult DeleteParty(int id)
        {
            DatabaseHelper.ExecuteNonQuery("DELETE FROM profit_parties WHERE id = @id", new SqliteParameter("@id", id));
            return Results.Ok(new { ok = true });
        }

        private static async Task<IResult> AddCollection(HttpRequest request)
        {
            var body = await Read<CollectionBody>(request);
            var error = ValidateCollection(body, out var from, out var to);
            if (error != null) return Results.BadRequest(new { error });
            DatabaseHelper.ExecuteNonQuery(
                "INSERT INTO profit_collections (name, date_from, date_to) VALUES (@name, @from, @to)",
                new SqliteParameter("@name", body.Name.Trim()),
                new SqliteParameter("@from", from.ToString("yyyy-MM-dd")),
                new SqliteParameter("@to", to.ToString("yyyy-MM-dd")));
            int id = DatabaseHelper.ExecuteScalar<int>("SELECT COALESCE(MAX(id), 0) FROM profit_collections");
            return Results.Ok(new { ok = true, id });
        }

        private static async Task<IResult> UpdateCollection(int id, HttpRequest request)
        {
            var body = await Read<CollectionBody>(request);
            var error = ValidateCollection(body, out var from, out var to);
            if (error != null) return Results.BadRequest(new { error });
            DatabaseHelper.ExecuteNonQuery(
                "UPDATE profit_collections SET name = @name, date_from = @from, date_to = @to WHERE id = @id",
                new SqliteParameter("@name", body.Name.Trim()),
                new SqliteParameter("@from", from.ToString("yyyy-MM-dd")),
                new SqliteParameter("@to", to.ToString("yyyy-MM-dd")),
                new SqliteParameter("@id", id));
            return Results.Ok(new { ok = true, id });
        }

        private static IResult DeleteCollection(int id)
        {
            DatabaseHelper.ExecuteNonQuery("DELETE FROM profit_collections WHERE id = @id", new SqliteParameter("@id", id));
            return Results.Ok(new { ok = true });
        }

        private static List<PartyRow> LoadParties()
        {
            var dt = DatabaseHelper.ExecuteDataTable("SELECT id, name, percent FROM profit_parties ORDER BY sort_order, id");
            var list = new List<PartyRow>();
            foreach (DataRow row in dt.Rows)
            {
                list.Add(new PartyRow
                {
                    Id = Convert.ToInt32(row["id"]),
                    Name = row["name"]?.ToString() ?? "",
                    Percent = row["percent"] == DBNull.Value ? 0m : Convert.ToDecimal(row["percent"])
                });
            }
            return list;
        }

        private static List<object> LoadCollections()
        {
            var dt = DatabaseHelper.ExecuteDataTable("SELECT id, name, date_from, date_to FROM profit_collections ORDER BY date_from DESC, id DESC");
            var list = new List<object>();
            foreach (DataRow row in dt.Rows)
            {
                list.Add(new
                {
                    id = Convert.ToInt32(row["id"]),
                    name = row["name"]?.ToString() ?? "",
                    from = row["date_from"]?.ToString() ?? "",
                    to = row["date_to"]?.ToString() ?? ""
                });
            }
            return list;
        }

        private static int? TryInt(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) ? n : null;
        }

        private static decimal Sum(string sql, DateTime from, DateTime to)
        {
            return DatabaseHelper.ExecuteScalar<decimal>(sql,
                new SqliteParameter("@from", from.ToString("yyyy-MM-dd")),
                new SqliteParameter("@to", to.ToString("yyyy-MM-dd")));
        }

        private static Range ResolveRange(string mode, int? year, int? month, int? collectionId)
        {
            string kind = (mode ?? "year").Trim().ToLowerInvariant();
            int y = year.GetValueOrDefault(DateTime.Today.Year);
            if (y < 2000 || y > 2100) y = DateTime.Today.Year;
            if (kind == "month")
            {
                int m = month.GetValueOrDefault(DateTime.Today.Month);
                if (m < 1 || m > 12) m = DateTime.Today.Month;
                var start = new DateTime(y, m, 1);
                return new Range
                {
                    ok = true,
                    mode = "month",
                    from = start,
                    to = start.AddMonths(1).AddDays(-1),
                    label = start.ToString("MMMM yyyy", CultureInfo.InvariantCulture)
                };
            }
            if (kind == "collection")
            {
                int id = collectionId.GetValueOrDefault();
                DataTable dt = DatabaseHelper.ExecuteDataTable(
                    "SELECT name, date_from, date_to FROM profit_collections WHERE id = @id",
                    new SqliteParameter("@id", id));
                if (dt.Rows.Count == 0)
                {
                    return new Range { ok = false, mode = "collection", needsCollection = true, label = "" };
                }
                var row = dt.Rows[0];
                DateTime from = DateTime.ParseExact(row["date_from"].ToString().Substring(0, 10), "yyyy-MM-dd", CultureInfo.InvariantCulture);
                DateTime to = DateTime.ParseExact(row["date_to"].ToString().Substring(0, 10), "yyyy-MM-dd", CultureInfo.InvariantCulture);
                return new Range
                {
                    ok = true,
                    mode = "collection",
                    from = from.Date,
                    to = to.Date,
                    label = row["name"]?.ToString() ?? ""
                };
            }
            return new Range
            {
                ok = true,
                mode = "year",
                from = new DateTime(y, 1, 1),
                to = new DateTime(y, 12, 31),
                label = y.ToString(CultureInfo.InvariantCulture)
            };
        }

        private static string ValidateParty(PartyBody body)
        {
            if (body == null || string.IsNullOrWhiteSpace(body.Name)) return "Enter a name.";
            if (body.Name.Trim().Length > 80) return "Name is too long.";
            if (body.Percent < 0 || body.Percent > 100) return "Percent must be between 0 and 100.";
            return null;
        }

        private static string ValidateCollection(CollectionBody body, out DateTime from, out DateTime to)
        {
            from = DateTime.Today;
            to = DateTime.Today;
            if (body == null || string.IsNullOrWhiteSpace(body.Name)) return "Enter a name.";
            if (body.Name.Trim().Length > 80) return "Name is too long.";
            if (!DateTime.TryParseExact((body.From ?? "").Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out from)
                || !DateTime.TryParseExact((body.To ?? "").Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out to))
                return "Choose a start and an end date.";
            from = from.Date;
            to = to.Date;
            if (to < from) return "The end date has to be on or after the start date.";
            return null;
        }

        private static async Task<T> Read<T>(HttpRequest request) where T : class
        {
            if (request.ContentLength.GetValueOrDefault() == 0) return null;
            return await JsonSerializer.DeserializeAsync<T>(request.Body, JsonOpts);
        }

        private class PartyRow
        {
            public int Id { get; set; }
            public string Name { get; set; }
            public decimal Percent { get; set; }
        }

        private class PartyBody
        {
            public string Name { get; set; }
            public decimal Percent { get; set; }
        }

        private class CollectionBody
        {
            public string Name { get; set; }
            public string From { get; set; }
            public string To { get; set; }
        }

        private class Range
        {
            public bool ok;
            public bool needsCollection;
            public string mode;
            public string label;
            public DateTime from;
            public DateTime to;
        }
    }
}
