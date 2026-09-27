using System;
using System.Collections.Generic;
using System.Data;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using InventorySystem.Helpers;

namespace InventorySystem.Services
{
    public static class ProductMaterialApi
    {
        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        public static void Map(WebApplication app)
        {
            app.MapGet("/api/products/{id:int}/materials", List);
            app.MapPost("/api/products/{id:int}/materials", Add);
            app.MapPost("/api/products/{id:int}/materials/{materialId:int}/update", Update);
            app.MapPost("/api/products/{id:int}/materials/{materialId:int}/delete", Delete);
        }

        private static IResult List(int id)
        {
            try
            {
                if (!PartExists(id)) return Results.BadRequest(new { error = "Product not found." });
                return Results.Ok(Load(id));
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }

        private static async Task<IResult> Add(int id, HttpRequest request)
        {
            try
            {
                if (!PartExists(id)) return Results.BadRequest(new { error = "Product not found." });
                var body = await Read(request);
                var error = Validate(body, out var qty, out var cost, out int? supplierId);
                if (error != null) return Results.BadRequest(new { error });
                DatabaseHelper.ExecuteNonQuery(
                    @"INSERT INTO product_materials (part_id, name, supplier_id, quantity, unit_cost)
                      VALUES (@part, @name, @supplier, @qty, @cost)",
                    new SqliteParameter("@part", id),
                    new SqliteParameter("@name", body.Name.Trim()),
                    new SqliteParameter("@supplier", supplierId.HasValue ? supplierId.Value : DBNull.Value),
                    new SqliteParameter("@qty", qty),
                    new SqliteParameter("@cost", cost));
                int materialId = DatabaseHelper.ExecuteScalar<int>("SELECT COALESCE(MAX(id), 0) FROM product_materials");
                return Results.Ok(new { ok = true, id = materialId });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }

        private static async Task<IResult> Update(int id, int materialId, HttpRequest request)
        {
            try
            {
                var body = await Read(request);
                var error = Validate(body, out var qty, out var cost, out int? supplierId);
                if (error != null) return Results.BadRequest(new { error });
                DatabaseHelper.ExecuteNonQuery(
                    @"UPDATE product_materials
                      SET name = @name, supplier_id = @supplier, quantity = @qty, unit_cost = @cost
                      WHERE id = @id AND part_id = @part",
                    new SqliteParameter("@name", body.Name.Trim()),
                    new SqliteParameter("@supplier", supplierId.HasValue ? supplierId.Value : DBNull.Value),
                    new SqliteParameter("@qty", qty),
                    new SqliteParameter("@cost", cost),
                    new SqliteParameter("@id", materialId),
                    new SqliteParameter("@part", id));
                return Results.Ok(new { ok = true, id = materialId });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }

        private static IResult Delete(int id, int materialId)
        {
            DatabaseHelper.ExecuteNonQuery(
                "DELETE FROM product_materials WHERE id = @id AND part_id = @part",
                new SqliteParameter("@id", materialId),
                new SqliteParameter("@part", id));
            return Results.Ok(new { ok = true });
        }

        private static List<object> Load(int partId)
        {
            var dt = DatabaseHelper.ExecuteDataTable(@"
                SELECT m.id, m.name, m.supplier_id, m.quantity, m.unit_cost,
                       COALESCE(s.supplier_name, '') AS supplier_name
                FROM product_materials m
                LEFT JOIN suppliers s ON s.id = m.supplier_id
                WHERE m.part_id = @part
                ORDER BY m.id",
                new SqliteParameter("@part", partId));
            var list = new List<object>();
            foreach (DataRow row in dt.Rows)
            {
                decimal qty = row["quantity"] == DBNull.Value ? 0m : Convert.ToDecimal(row["quantity"]);
                decimal cost = row["unit_cost"] == DBNull.Value ? 0m : Convert.ToDecimal(row["unit_cost"]);
                list.Add(new
                {
                    id = Convert.ToInt32(row["id"]),
                    name = row["name"]?.ToString() ?? "",
                    supplierId = row["supplier_id"] == DBNull.Value ? (int?)null : Convert.ToInt32(row["supplier_id"]),
                    supplierName = row["supplier_name"]?.ToString() ?? "",
                    quantity = qty,
                    unitCost = cost,
                    lineCost = Math.Round(qty * cost, 2, MidpointRounding.AwayFromZero)
                });
            }
            return list;
        }

        private static bool PartExists(int id)
        {
            return DatabaseHelper.ExecuteScalar<int>(
                "SELECT COUNT(*) FROM parts WHERE id = @id AND date_deleted IS NULL",
                new SqliteParameter("@id", id)) > 0;
        }

        private static string Validate(MaterialBody body, out decimal qty, out decimal cost, out int? supplierId)
        {
            qty = 0;
            cost = 0;
            supplierId = null;
            if (body == null || string.IsNullOrWhiteSpace(body.Name)) return "Enter the material name.";
            if (body.Name.Trim().Length > 80) return "Name is too long.";
            qty = body.Quantity <= 0 ? 0 : body.Quantity;
            if (qty <= 0) return "Enter how much goes into one piece.";
            if (body.UnitCost < 0) return "Cost cannot be negative.";
            cost = body.UnitCost;
            if (body.SupplierId.HasValue && body.SupplierId.Value > 0) supplierId = body.SupplierId;
            return null;
        }

        private static async Task<MaterialBody> Read(HttpRequest request)
        {
            if (request.ContentLength.GetValueOrDefault() == 0) return null;
            return await JsonSerializer.DeserializeAsync<MaterialBody>(request.Body, JsonOpts);
        }

        private class MaterialBody
        {
            public string Name { get; set; }
            public int? SupplierId { get; set; }
            public decimal Quantity { get; set; }
            public decimal UnitCost { get; set; }
        }
    }
}
