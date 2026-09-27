using System;
using System.Collections.Generic;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using InventorySystem.Helpers;

namespace InventorySystem.Services
{
    public static class FashionApi
    {
        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        public static void Map(WebApplication app)
        {
            ShopOrderApi.Map(app);
            app.MapGet("/api/purchase-orders", () =>
            {
                try
                {
                    var dt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT po.po_id, po.po_number, po.supplier_id, COALESCE(s.supplier_name,'') AS supplier_name,
                               po.order_date, po.delivery_date, po.received_date, po.total_amount, po.status, po.notes, po.warehouse_id
                        FROM purchase_orders po
                        LEFT JOIN suppliers s ON s.id = po.supplier_id
                        ORDER BY po.po_id DESC");
                    var list = new List<object>();
                    foreach (System.Data.DataRow row in dt.Rows)
                    {
                        list.Add(new
                        {
                            id = Convert.ToInt32(row["po_id"]),
                            number = row["po_number"]?.ToString() ?? "",
                            supplierId = row["supplier_id"] == DBNull.Value ? (int?)null : Convert.ToInt32(row["supplier_id"]),
                            supplier = row["supplier_name"]?.ToString() ?? "",
                            orderDate = row["order_date"]?.ToString() ?? "",
                            deliveryDate = row["delivery_date"]?.ToString() ?? "",
                            receivedDate = row["received_date"]?.ToString() ?? "",
                            total = row["total_amount"] == DBNull.Value ? 0m : Convert.ToDecimal(row["total_amount"]),
                            status = row["status"]?.ToString() ?? "Pending",
                            notes = row["notes"]?.ToString() ?? "",
                            warehouseId = row["warehouse_id"] == DBNull.Value ? (int?)null : Convert.ToInt32(row["warehouse_id"])
                        });
                    }
                    return Results.Ok(list);
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapGet("/api/purchase-orders/{id:int}", (int id) =>
            {
                try
                {
                    var header = DatabaseHelper.ExecuteDataTable(@"
                        SELECT po.po_id, po.po_number, po.supplier_id, COALESCE(s.supplier_name,'') AS supplier_name,
                               po.order_date, po.delivery_date, po.status, po.notes, po.total_amount, po.warehouse_id
                        FROM purchase_orders po
                        LEFT JOIN suppliers s ON s.id = po.supplier_id
                        WHERE po.po_id = @id", new SqliteParameter("@id", id));
                    if (header.Rows.Count == 0) return Results.NotFound();
                    var row = header.Rows[0];
                    var itemsDt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT i.po_item_id, i.part_id, i.quantity, i.cost_price, COALESCE(p.part_name,'') AS part_name, COALESCE(p.part_number,'') AS sku
                        FROM purchase_order_items i
                        LEFT JOIN parts p ON p.id = i.part_id
                        WHERE i.po_id = @id", new SqliteParameter("@id", id));
                    var items = new List<object>();
                    foreach (System.Data.DataRow item in itemsDt.Rows)
                    {
                        items.Add(new
                        {
                            id = Convert.ToInt32(item["po_item_id"]),
                            partId = item["part_id"] == DBNull.Value ? 0 : Convert.ToInt32(item["part_id"]),
                            name = item["part_name"]?.ToString() ?? "",
                            sku = item["sku"]?.ToString() ?? "",
                            quantity = item["quantity"] == DBNull.Value ? 0 : Convert.ToInt32(item["quantity"]),
                            cost = item["cost_price"] == DBNull.Value ? 0m : Convert.ToDecimal(item["cost_price"])
                        });
                    }
                    return Results.Ok(new
                    {
                        id = Convert.ToInt32(row["po_id"]),
                        number = row["po_number"]?.ToString() ?? "",
                        supplierId = row["supplier_id"] == DBNull.Value ? (int?)null : Convert.ToInt32(row["supplier_id"]),
                        supplier = row["supplier_name"]?.ToString() ?? "",
                        orderDate = row["order_date"]?.ToString() ?? "",
                        deliveryDate = row["delivery_date"]?.ToString() ?? "",
                        status = row["status"]?.ToString() ?? "Pending",
                        notes = row["notes"]?.ToString() ?? "",
                        total = row["total_amount"] == DBNull.Value ? 0m : Convert.ToDecimal(row["total_amount"]),
                        warehouseId = row["warehouse_id"] == DBNull.Value ? (int?)null : Convert.ToInt32(row["warehouse_id"]),
                        items
                    });
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapPost("/api/purchase-orders", async (HttpRequest request) =>
            {
                try
                {
                    var body = await JsonSerializer.DeserializeAsync<PoPayload>(request.Body, JsonOpts);
                    if (body == null || body.SupplierId <= 0) return Results.BadRequest(new { error = "Supplier required" });
                    if (body.Items == null || body.Items.Count == 0) return Results.BadRequest(new { error = "Add at least one item" });

                    decimal total = 0;
                    foreach (var line in body.Items)
                        total += line.Quantity * line.Cost;

                    int warehouseId = body.WarehouseId > 0 ? body.WarehouseId : FashionStock.EnsureMainWarehouse();
                    DatabaseHelper.ExecuteNonQuery(@"
                        INSERT INTO purchase_orders (supplier_id, order_date, total_amount, status, notes, delivery_date, warehouse_id)
                        VALUES (@s, datetime('now'), @t, 'Pending', @n, @d, @w)",
                        new SqliteParameter("@s", body.SupplierId),
                        new SqliteParameter("@t", total),
                        new SqliteParameter("@n", body.Notes ?? ""),
                        new SqliteParameter("@d", string.IsNullOrWhiteSpace(body.DeliveryDate) ? DBNull.Value : body.DeliveryDate),
                        new SqliteParameter("@w", warehouseId));
                    int poId = DatabaseHelper.ExecuteScalar<int>("SELECT COALESCE(MAX(po_id),0) FROM purchase_orders");
                    string number = "PO-" + DateTime.Now.Year + "-" + poId.ToString("D4");
                    DatabaseHelper.ExecuteNonQuery(
                        "UPDATE purchase_orders SET po_number = @n WHERE po_id = @id",
                        new SqliteParameter("@n", number),
                        new SqliteParameter("@id", poId));
                    foreach (var line in body.Items)
                    {
                        if (line.PartId <= 0 || line.Quantity <= 0) continue;
                        DatabaseHelper.ExecuteNonQuery(@"
                            INSERT INTO purchase_order_items (po_id, part_id, quantity, cost_price)
                            VALUES (@po, @p, @q, @c)",
                            new SqliteParameter("@po", poId),
                            new SqliteParameter("@p", line.PartId),
                            new SqliteParameter("@q", line.Quantity),
                            new SqliteParameter("@c", line.Cost));
                    }
                    return Results.Ok(new { success = true, id = poId, number });
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapPost("/api/purchase-orders/{id:int}/receive", (int id) =>
            {
                try
                {
                    var header = DatabaseHelper.ExecuteDataTable(
                        "SELECT status, warehouse_id, po_number FROM purchase_orders WHERE po_id = @id",
                        new SqliteParameter("@id", id));
                    if (header.Rows.Count == 0) return Results.NotFound();
                    string status = header.Rows[0]["status"]?.ToString() ?? "";
                    if (!status.Equals("Pending", StringComparison.OrdinalIgnoreCase))
                        return Results.BadRequest(new { error = "Only pending orders can be received" });

                    int warehouseId = header.Rows[0]["warehouse_id"] == DBNull.Value
                        ? FashionStock.EnsureMainWarehouse()
                        : Convert.ToInt32(header.Rows[0]["warehouse_id"]);
                    string number = header.Rows[0]["po_number"]?.ToString() ?? ("PO-" + id);

                    var items = DatabaseHelper.ExecuteDataTable(
                        "SELECT part_id, quantity FROM purchase_order_items WHERE po_id = @id",
                        new SqliteParameter("@id", id));
                    foreach (System.Data.DataRow item in items.Rows)
                    {
                        int partId = Convert.ToInt32(item["part_id"]);
                        int qty = Convert.ToInt32(item["quantity"]);
                        if (partId <= 0 || qty <= 0) continue;
                        int current = DatabaseHelper.ExecuteScalar<int>(
                            "SELECT COALESCE(quantity,0) FROM stock_levels WHERE part_id = @p AND warehouse_id = @w",
                            new SqliteParameter("@p", partId),
                            new SqliteParameter("@w", warehouseId));
                        int reorder = DatabaseHelper.ExecuteScalar<int>(
                            "SELECT COALESCE(minimum_stock_level,0) FROM parts WHERE id = @id",
                            new SqliteParameter("@id", partId));
                        FashionStock.Upsert(partId, warehouseId, current + qty, reorder);
                        FashionStock.SyncPartTotal(partId);
                        FashionStock.LogMovement(partId, "Purchase", qty, "Received " + number, warehouseId, "PO", id);
                    }
                    DatabaseHelper.ExecuteNonQuery(
                        "UPDATE purchase_orders SET status = 'Received', received_date = datetime('now') WHERE po_id = @id",
                        new SqliteParameter("@id", id));
                    return Results.Ok(new { success = true });
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapPost("/api/purchase-orders/{id:int}/cancel", (int id) =>
            {
                try
                {
                    string status = DatabaseHelper.ExecuteScalar<string>(
                        "SELECT status FROM purchase_orders WHERE po_id = @id",
                        new SqliteParameter("@id", id)) ?? "";
                    if (string.IsNullOrEmpty(status)) return Results.NotFound();
                    if (!status.Equals("Pending", StringComparison.OrdinalIgnoreCase))
                        return Results.BadRequest(new { error = "Only pending orders can be cancelled" });
                    DatabaseHelper.ExecuteNonQuery(
                        "UPDATE purchase_orders SET status = 'Cancelled' WHERE po_id = @id",
                        new SqliteParameter("@id", id));
                    return Results.Ok(new { success = true });
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapGet("/api/warehouses", () =>
            {
                try
                {
                    FashionStock.EnsureMainWarehouse();
                    var dt = DatabaseHelper.ExecuteDataTable("SELECT id, name, code FROM warehouses WHERE COALESCE(is_active,1) = 1 ORDER BY name");
                    var list = new List<object>();
                    foreach (System.Data.DataRow row in dt.Rows)
                        list.Add(new { id = Convert.ToInt32(row["id"]), name = row["name"]?.ToString() ?? "", code = row["code"]?.ToString() ?? "" });
                    return Results.Ok(list);
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapGet("/api/inventory/summary", () =>
            {
                try
                {
                    FashionStock.EnsureMainWarehouse();
                    var totals = DatabaseHelper.ExecuteDataTable(@"
                        SELECT
                            COALESCE(SUM(quantity),0) AS units,
                            SUM(CASE WHEN quantity > reorder_level THEN 1 ELSE 0 END) AS in_stock,
                            SUM(CASE WHEN quantity > 0 AND quantity <= reorder_level THEN 1 ELSE 0 END) AS low_stock,
                            SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock
                        FROM stock_levels sl
                        JOIN parts p ON p.id = sl.part_id AND p.date_deleted IS NULL");
                    var row = totals.Rows.Count > 0 ? totals.Rows[0] : null;
                    var warehouses = new List<object>();
                    var wh = DatabaseHelper.ExecuteDataTable(@"
                        SELECT w.id, w.name,
                               COUNT(sl.id) AS total_items,
                               SUM(CASE WHEN sl.quantity > sl.reorder_level THEN 1 ELSE 0 END) AS in_stock,
                               SUM(CASE WHEN sl.quantity > 0 AND sl.quantity <= sl.reorder_level THEN 1 ELSE 0 END) AS low_stock,
                               SUM(CASE WHEN sl.quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock
                        FROM warehouses w
                        LEFT JOIN stock_levels sl ON sl.warehouse_id = w.id
                        LEFT JOIN parts p ON p.id = sl.part_id AND p.date_deleted IS NULL
                        WHERE COALESCE(w.is_active,1) = 1
                        GROUP BY w.id, w.name
                        ORDER BY w.name");
                    foreach (System.Data.DataRow w in wh.Rows)
                    {
                        warehouses.Add(new
                        {
                            id = Convert.ToInt32(w["id"]),
                            name = w["name"]?.ToString() ?? "",
                            totalItems = w["total_items"] == DBNull.Value ? 0 : Convert.ToInt32(w["total_items"]),
                            inStock = w["in_stock"] == DBNull.Value ? 0 : Convert.ToInt32(w["in_stock"]),
                            lowStock = w["low_stock"] == DBNull.Value ? 0 : Convert.ToInt32(w["low_stock"]),
                            outOfStock = w["out_of_stock"] == DBNull.Value ? 0 : Convert.ToInt32(w["out_of_stock"])
                        });
                    }
                    var alerts = new List<object>();
                    var alertDt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT p.id, p.part_name, COALESCE(p.part_number,'') AS sku, w.name AS warehouse,
                               sl.quantity, sl.reorder_level
                        FROM stock_levels sl
                        JOIN parts p ON p.id = sl.part_id AND p.date_deleted IS NULL
                        JOIN warehouses w ON w.id = sl.warehouse_id
                        WHERE sl.quantity <= sl.reorder_level
                        ORDER BY sl.quantity ASC
                        LIMIT 25");
                    foreach (System.Data.DataRow a in alertDt.Rows)
                    {
                        int qty = Convert.ToInt32(a["quantity"]);
                        alerts.Add(new
                        {
                            partId = Convert.ToInt32(a["id"]),
                            name = a["part_name"]?.ToString() ?? "",
                            sku = a["sku"]?.ToString() ?? "",
                            warehouse = a["warehouse"]?.ToString() ?? "",
                            stock = qty,
                            reorder = Convert.ToInt32(a["reorder_level"]),
                            status = qty <= 0 ? "Out of Stock" : "Low Stock"
                        });
                    }
                    return Results.Ok(new
                    {
                        units = row == null || row["units"] == DBNull.Value ? 0 : Convert.ToInt32(row["units"]),
                        inStock = row == null || row["in_stock"] == DBNull.Value ? 0 : Convert.ToInt32(row["in_stock"]),
                        lowStock = row == null || row["low_stock"] == DBNull.Value ? 0 : Convert.ToInt32(row["low_stock"]),
                        outOfStock = row == null || row["out_of_stock"] == DBNull.Value ? 0 : Convert.ToInt32(row["out_of_stock"]),
                        warehouses,
                        alerts
                    });
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapPost("/api/stock-transfers", async (HttpRequest request) =>
            {
                try
                {
                    var body = await JsonSerializer.DeserializeAsync<TransferPayload>(request.Body, JsonOpts);
                    if (body == null || body.FromWarehouseId <= 0 || body.ToWarehouseId <= 0)
                        return Results.BadRequest(new { error = "Choose both warehouses" });
                    if (body.FromWarehouseId == body.ToWarehouseId)
                        return Results.BadRequest(new { error = "Warehouses must be different" });
                    if (body.PartId <= 0 || body.Quantity <= 0)
                        return Results.BadRequest(new { error = "Choose a product and quantity" });

                    int available = DatabaseHelper.ExecuteScalar<int>(
                        "SELECT COALESCE(quantity,0) FROM stock_levels WHERE part_id = @p AND warehouse_id = @w",
                        new SqliteParameter("@p", body.PartId),
                        new SqliteParameter("@w", body.FromWarehouseId));
                    if (available < body.Quantity)
                        return Results.BadRequest(new { error = "Not enough stock in the source warehouse" });

                    int reorder = DatabaseHelper.ExecuteScalar<int>(
                        "SELECT COALESCE(minimum_stock_level,0) FROM parts WHERE id = @id",
                        new SqliteParameter("@id", body.PartId));
                    int destQty = DatabaseHelper.ExecuteScalar<int>(
                        "SELECT COALESCE(quantity,0) FROM stock_levels WHERE part_id = @p AND warehouse_id = @w",
                        new SqliteParameter("@p", body.PartId),
                        new SqliteParameter("@w", body.ToWarehouseId));

                    FashionStock.Upsert(body.PartId, body.FromWarehouseId, available - body.Quantity, reorder);
                    FashionStock.Upsert(body.PartId, body.ToWarehouseId, destQty + body.Quantity, reorder);

                    DatabaseHelper.ExecuteNonQuery(@"
                        INSERT INTO stock_transfers (from_warehouse_id, to_warehouse_id, transfer_date, notes, performed_by)
                        VALUES (@f, @t, @d, @n, @u)",
                        new SqliteParameter("@f", body.FromWarehouseId),
                        new SqliteParameter("@t", body.ToWarehouseId),
                        new SqliteParameter("@d", string.IsNullOrWhiteSpace(body.TransferDate) ? DateTime.Now.ToString("yyyy-MM-dd") : body.TransferDate),
                        new SqliteParameter("@n", body.Notes ?? ""),
                        new SqliteParameter("@u", UserSession.Username ?? "Web"));
                    int transferId = DatabaseHelper.ExecuteScalar<int>("SELECT COALESCE(MAX(id),0) FROM stock_transfers");
                    DatabaseHelper.ExecuteNonQuery(
                        "INSERT INTO stock_transfer_items (transfer_id, part_id, quantity) VALUES (@t, @p, @q)",
                        new SqliteParameter("@t", transferId),
                        new SqliteParameter("@p", body.PartId),
                        new SqliteParameter("@q", body.Quantity));
                    FashionStock.LogMovement(body.PartId, "Transfer", -body.Quantity, body.Notes ?? "Stock transfer", body.FromWarehouseId, "Transfer", transferId);
                    FashionStock.LogMovement(body.PartId, "Transfer", body.Quantity, body.Notes ?? "Stock transfer", body.ToWarehouseId, "Transfer", transferId);
                    return Results.Ok(new { success = true, id = transferId });
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapGet("/api/products/{id:int}/history", (int id) =>
            {
                try
                {
                    var dt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT movement_date, movement_type, quantity, balance_after, notes, performed_by,
                               COALESCE(reference_type,'') AS reference_type, reference_id,
                               COALESCE(w.name,'') AS warehouse
                        FROM stock_movements m
                        LEFT JOIN warehouses w ON w.id = m.warehouse_id
                        WHERE m.part_id = @id
                        ORDER BY m.id DESC
                        LIMIT 40", new SqliteParameter("@id", id));
                    var list = new List<object>();
                    foreach (System.Data.DataRow row in dt.Rows)
                    {
                        list.Add(new
                        {
                            date = row["movement_date"]?.ToString() ?? "",
                            type = row["movement_type"]?.ToString() ?? "",
                            quantity = row["quantity"] == DBNull.Value ? 0 : Convert.ToInt32(row["quantity"]),
                            balance = row["balance_after"] == DBNull.Value ? (int?)null : Convert.ToInt32(row["balance_after"]),
                            notes = row["notes"]?.ToString() ?? "",
                            reference = FormatReference(row["reference_type"]?.ToString(), row["reference_id"]),
                            user = row["performed_by"]?.ToString() ?? "",
                            warehouse = row["warehouse"]?.ToString() ?? ""
                        });
                    }
                    return Results.Ok(list);
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapGet("/api/products/{id:int}/images", (int id) =>
            {
                try
                {
                    var dt = DatabaseHelper.ExecuteDataTable(
                        "SELECT image_path FROM product_images WHERE part_id = @id ORDER BY sort_order, id",
                        new SqliteParameter("@id", id));
                    var list = new List<string>();
                    foreach (System.Data.DataRow row in dt.Rows)
                    {
                        string path = row["image_path"]?.ToString() ?? "";
                        if (!string.IsNullOrWhiteSpace(path)) list.Add(path);
                    }
                    return Results.Ok(list);
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapGet("/api/products/{id:int}/stock", (int id) =>
            {
                try
                {
                    var dt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT w.id, w.name, COALESCE(sl.quantity,0) AS quantity
                        FROM warehouses w
                        LEFT JOIN stock_levels sl ON sl.warehouse_id = w.id AND sl.part_id = @id
                        WHERE COALESCE(w.is_active,1) = 1
                        ORDER BY w.name", new SqliteParameter("@id", id));
                    var list = new List<object>();
                    foreach (System.Data.DataRow row in dt.Rows)
                    {
                        list.Add(new
                        {
                            warehouseId = Convert.ToInt32(row["id"]),
                            name = row["name"]?.ToString() ?? "",
                            quantity = Convert.ToInt32(row["quantity"])
                        });
                    }
                    return Results.Ok(list);
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });

            app.MapGet("/api/analytics", () =>
            {
                try
                {
                    var months = new decimal[12];
                    var monthDt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT CAST(strftime('%m', order_date) AS INTEGER) AS m, COALESCE(SUM(total_amount),0) AS t
                        FROM orders
                        WHERE strftime('%Y', order_date) = strftime('%Y','now')
                          AND COALESCE(status,'') NOT IN ('Quotation','Draft','Cancelled')
                        GROUP BY m");
                    foreach (System.Data.DataRow row in monthDt.Rows)
                    {
                        int m = Convert.ToInt32(row["m"]);
                        if (m >= 1 && m <= 12) months[m - 1] = Convert.ToDecimal(row["t"]);
                    }

                    var categories = new List<object>();
                    var catDt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT COALESCE(c.category_name,'Other') AS name, COALESCE(SUM(oi.quantity * oi.price),0) AS total
                        FROM order_items oi
                        JOIN parts p ON p.id = oi.part_id
                        LEFT JOIN categories c ON c.id = p.category_id
                        GROUP BY name
                        ORDER BY total DESC
                        LIMIT 6");
                    foreach (System.Data.DataRow row in catDt.Rows)
                        categories.Add(new { name = row["name"]?.ToString() ?? "Other", total = Convert.ToDecimal(row["total"]) });

                    var sellers = new List<object>();
                    var sellDt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT p.part_name, COALESCE(p.part_number,'') AS sku,
                               COALESCE(SUM(oi.quantity),0) AS units, COALESCE(SUM(oi.quantity * oi.price),0) AS revenue
                        FROM order_items oi
                        JOIN parts p ON p.id = oi.part_id
                        GROUP BY p.id
                        ORDER BY units DESC
                        LIMIT 12");
                    foreach (System.Data.DataRow row in sellDt.Rows)
                    {
                        sellers.Add(new
                        {
                            name = row["part_name"]?.ToString() ?? "",
                            sku = row["sku"]?.ToString() ?? "",
                            units = Convert.ToInt32(row["units"]),
                            revenue = Convert.ToDecimal(row["revenue"])
                        });
                    }

                    decimal retail = DatabaseHelper.ExecuteScalar<decimal>(@"
                        SELECT COALESCE(SUM(total_amount),0) FROM orders
                        WHERE strftime('%Y', order_date) = strftime('%Y','now')
                          AND COALESCE(channel,'Retail') = 'Retail'
                          AND COALESCE(status,'') NOT IN ('Quotation','Draft','Cancelled')");
                    decimal wholesale = DatabaseHelper.ExecuteScalar<decimal>(@"
                        SELECT COALESCE(SUM(total_amount),0) FROM orders
                        WHERE strftime('%Y', order_date) = strftime('%Y','now')
                          AND channel = 'Wholesale'
                          AND COALESCE(status,'') NOT IN ('Quotation','Draft','Cancelled')");
                    decimal online = DatabaseHelper.ExecuteScalar<decimal>(@"
                        SELECT COALESCE(SUM(total_amount),0) FROM orders
                        WHERE strftime('%Y', order_date) = strftime('%Y','now')
                          AND channel = 'Online'
                          AND COALESCE(status,'') NOT IN ('Quotation','Draft','Cancelled')");
                    decimal refunds = DatabaseHelper.ExecuteScalar<decimal>(
                        "SELECT COALESCE(SUM(total_refund),0) FROM returns WHERE strftime('%Y', return_date) = strftime('%Y','now')");

                    decimal[] retailM = new decimal[12], wholesaleM = new decimal[12], onlineM = new decimal[12], refundM = new decimal[12];
                    var channelDt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT CAST(strftime('%m', order_date) AS INTEGER) AS m,
                               COALESCE(NULLIF(channel,''),'Retail') AS channel,
                               COALESCE(SUM(total_amount),0) AS t
                        FROM orders
                        WHERE strftime('%Y', order_date) = strftime('%Y','now')
                          AND COALESCE(status,'') NOT IN ('Quotation','Draft','Cancelled')
                        GROUP BY m, channel");
                    foreach (System.Data.DataRow row in channelDt.Rows)
                    {
                        int m = Convert.ToInt32(row["m"]);
                        if (m < 1 || m > 12) continue;
                        string channel = row["channel"]?.ToString() ?? "Retail";
                        decimal amount = Convert.ToDecimal(row["t"]);
                        if (channel.Equals("Wholesale", StringComparison.OrdinalIgnoreCase)) wholesaleM[m - 1] += amount;
                        else if (channel.Equals("Online", StringComparison.OrdinalIgnoreCase)) onlineM[m - 1] += amount;
                        else retailM[m - 1] += amount;
                    }
                    var refundDt = DatabaseHelper.ExecuteDataTable(@"
                        SELECT CAST(strftime('%m', return_date) AS INTEGER) AS m, COALESCE(SUM(total_refund),0) AS t
                        FROM returns
                        WHERE strftime('%Y', return_date) = strftime('%Y','now')
                        GROUP BY m");
                    foreach (System.Data.DataRow row in refundDt.Rows)
                    {
                        int m = Convert.ToInt32(row["m"]);
                        if (m >= 1 && m <= 12) refundM[m - 1] = Convert.ToDecimal(row["t"]);
                    }
                    var byMonth = new List<object>();
                    for (int i = 0; i < 12; i++)
                    {
                        byMonth.Add(new
                        {
                            retail = retailM[i],
                            wholesale = wholesaleM[i],
                            online = onlineM[i],
                            refunds = refundM[i],
                            total = retailM[i] + wholesaleM[i] + onlineM[i] - refundM[i]
                        });
                    }

                    return Results.Ok(new
                    {
                        year = DateTime.Now.Year,
                        months,
                        byMonth,
                        categories,
                        sellers,
                        retail,
                        wholesale,
                        online,
                        refunds,
                        total = retail + wholesale + online - refunds
                    });
                }
                catch (Exception ex) { return Results.Problem(ex.Message); }
            });
        }

        private static string FormatReference(string type, object id)
        {
            if (id == null || id == DBNull.Value) return "";
            string kind = type ?? "";
            if (kind.Equals("PO", StringComparison.OrdinalIgnoreCase)) return "PO-" + id;
            if (string.IsNullOrWhiteSpace(kind)) return "";
            return kind + " #" + id;
        }

        private class PoLine
        {
            public int PartId { get; set; }
            public int Quantity { get; set; }
            public decimal Cost { get; set; }
        }

        private class PoPayload
        {
            public int SupplierId { get; set; }
            public int WarehouseId { get; set; }
            public string DeliveryDate { get; set; }
            public string Notes { get; set; }
            public List<PoLine> Items { get; set; }
        }

        private class TransferPayload
        {
            public int FromWarehouseId { get; set; }
            public int ToWarehouseId { get; set; }
            public int PartId { get; set; }
            public int Quantity { get; set; }
            public string TransferDate { get; set; }
            public string Notes { get; set; }
        }
    }
}
