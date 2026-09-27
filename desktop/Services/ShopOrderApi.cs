using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using InventorySystem.Helpers;

namespace InventorySystem.Services
{
    public static class ShopOrderApi
    {
        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        private static readonly string[] CheckKeys = { "match", "size", "color", "qty", "packed", "label" };

        public static void Map(WebApplication app)
        {
            app.MapGet("/api/shop-orders", ListOrders);
            app.MapGet("/api/shop-orders/{id:int}", GetOrder);
            app.MapPost("/api/shop-orders", CreateOrder);
            app.MapPost("/api/shop-orders/{id:int}/start", StartPreparing);
            app.MapPost("/api/shop-orders/{id:int}/checks", ToggleCheck);
            app.MapPost("/api/shop-orders/{id:int}/pack", FinishPacking);
            app.MapPost("/api/shop-orders/{id:int}/dispatch", Dispatch);
            app.MapPost("/api/shop-orders/{id:int}/track", Track);
            app.MapPost("/api/shop-orders/{id:int}/feedback", Feedback);
            app.MapPost("/api/shop-orders/{id:int}/note", AddNote);
            app.MapPost("/api/shop-orders/{id:int}/cancel", Cancel);
        }

        private static IResult ListOrders()
        {
            try
            {
                var dt = DatabaseHelper.ExecuteDataTable(@"
                    SELECT o.order_id, o.order_date, o.total_amount, o.payment_status, o.payment_method,
                           o.fulfillment_type, o.fulfillment_stage, o.delivery_date, o.tracking_status,
                           COALESCE(c.full_name,'') AS customer_name
                    FROM orders o
                    LEFT JOIN customers c ON c.customer_id = o.customer_id
                    WHERE COALESCE(o.fulfillment_type,'') != ''
                    ORDER BY o.order_id DESC");
                var items = DatabaseHelper.ExecuteDataTable(@"
                    SELECT i.order_id, i.quantity, COALESCE(p.part_name, i.item_name, '') AS name,
                           COALESCE(p.size,'') AS size, COALESCE(p.color,'') AS color
                    FROM order_items i
                    LEFT JOIN parts p ON p.id = i.part_id
                    WHERE i.order_id IN (SELECT order_id FROM orders WHERE COALESCE(fulfillment_type,'') != '')");
                var checks = DatabaseHelper.ExecuteDataTable(@"
                    SELECT order_id,
                           SUM(CASE WHEN is_checked = 1 THEN 1 ELSE 0 END) AS done,
                           COUNT(*) AS total
                    FROM order_pack_checks
                    GROUP BY order_id");
                var preview = new Dictionary<int, List<object>>();
                foreach (System.Data.DataRow row in items.Rows)
                {
                    int oid = I(row, "order_id");
                    if (!preview.ContainsKey(oid)) preview[oid] = new List<object>();
                    if (preview[oid].Count >= 3) continue;
                    preview[oid].Add(new { name = S(row, "name"), quantity = I(row, "quantity"), size = S(row, "size"), color = S(row, "color") });
                }
                var progress = new Dictionary<int, (int done, int total)>();
                foreach (System.Data.DataRow row in checks.Rows)
                    progress[I(row, "order_id")] = (I(row, "done"), I(row, "total"));

                var list = new List<object>();
                foreach (System.Data.DataRow row in dt.Rows)
                {
                    int id = I(row, "order_id");
                    progress.TryGetValue(id, out var prog);
                    list.Add(new
                    {
                        id,
                        date = S(row, "order_date"),
                        total = M(row, "total_amount"),
                        paymentStatus = S(row, "payment_status"),
                        paymentMethod = S(row, "payment_method"),
                        type = S(row, "fulfillment_type"),
                        stage = S(row, "fulfillment_stage"),
                        deliveryDate = S(row, "delivery_date"),
                        trackingStatus = S(row, "tracking_status"),
                        customer = S(row, "customer_name"),
                        items = preview.ContainsKey(id) ? preview[id] : new List<object>(),
                        checksDone = prog.done,
                        checksTotal = prog.total
                    });
                }
                return Results.Ok(list);
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static IResult GetOrder(int id)
        {
            try
            {
                var order = Load(id);
                if (order == null) return Results.NotFound();
                return Results.Ok(order);
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> CreateOrder(HttpRequest request)
        {
            try
            {
                var body = await JsonSerializer.DeserializeAsync<ShopOrderPayload>(request.Body, JsonOpts);
                if (body == null) return Fail("Order details are missing.");
                if (body.CustomerId <= 0) return Fail("Select a customer.");
                string type = body.FulfillmentType == "Pickup" ? "Pickup" : "Delivery";
                if (type == "Delivery" && string.IsNullOrWhiteSpace(body.Address)) return Fail("Add a shipping address for delivery.");
                if (body.Items == null || body.Items.Count == 0) return Fail("Add at least one product.");

                var lines = new List<OrderItem>();
                decimal total = 0;
                foreach (var line in body.Items)
                {
                    if (line.PartId <= 0 || line.Quantity <= 0) return Fail("Each line needs a product and a quantity.");
                    var part = DatabaseHelper.ExecuteDataTable(
                        "SELECT part_name, quantity_in_stock, is_stock_tracked, item_type, selling_price FROM parts WHERE id = @id",
                        new SqliteParameter("@id", line.PartId));
                    if (part.Rows.Count == 0) return Fail("A selected product was not found.");
                    var row = part.Rows[0];
                    bool tracked = row["is_stock_tracked"] == DBNull.Value || Convert.ToInt32(row["is_stock_tracked"]) == 1;
                    string itemType = row["item_type"]?.ToString() ?? "";
                    bool service = itemType.Equals("Service", StringComparison.OrdinalIgnoreCase);
                    int stock = row["quantity_in_stock"] == DBNull.Value ? 0 : Convert.ToInt32(row["quantity_in_stock"]);
                    if (tracked && !service && stock < line.Quantity)
                        return Fail("Not enough stock for " + (row["part_name"]?.ToString() ?? "a product") + ".");
                    decimal price = line.Price >= 0 ? line.Price : (row["selling_price"] == DBNull.Value ? 0 : Convert.ToDecimal(row["selling_price"]));
                    lines.Add(new OrderItem
                    {
                        PartId = line.PartId,
                        PartName = row["part_name"]?.ToString() ?? "",
                        Quantity = line.Quantity,
                        UnitPrice = price
                    });
                    total += price * line.Quantity;
                }

                DateTime? when = null;
                if (!string.IsNullOrWhiteSpace(body.DeliveryDate) &&
                    DateTime.TryParse(body.DeliveryDate, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed))
                    when = parsed;

                int orderId = new OrderService().PlaceOrder(
                    body.CustomerId, lines, total, body.IsPaid, "Open", null,
                    type == "Delivery" ? body.Address?.Trim() : null, when);
                if (orderId <= 0)
                    orderId = DatabaseHelper.ExecuteScalar<int>("SELECT COALESCE(MAX(order_id),0) FROM orders");

                string channel = type == "Delivery" ? "Online" : "Retail";
                string pay = string.IsNullOrWhiteSpace(body.PaymentMethod) ? "Cash" : body.PaymentMethod.Trim();
                DatabaseHelper.ExecuteNonQuery(@"
                    UPDATE orders
                    SET fulfillment_type = @type, fulfillment_stage = 'New', channel = @channel,
                        payment_method = @pay, notes = @notes, pickup_note = @pickup
                    WHERE order_id = @id",
                    new SqliteParameter("@type", type),
                    new SqliteParameter("@channel", channel),
                    new SqliteParameter("@pay", pay),
                    new SqliteParameter("@notes", (object)body.Notes?.Trim() ?? DBNull.Value),
                    new SqliteParameter("@pickup", type == "Pickup" ? (object)(body.PickupNote?.Trim() ?? "") : DBNull.Value),
                    new SqliteParameter("@id", orderId));

                var itemRows = DatabaseHelper.ExecuteDataTable(
                    "SELECT order_item_id FROM order_items WHERE order_id = @id",
                    new SqliteParameter("@id", orderId));
                foreach (System.Data.DataRow item in itemRows.Rows)
                {
                    int itemId = Convert.ToInt32(item["order_item_id"]);
                    foreach (string key in CheckKeys)
                    {
                        DatabaseHelper.ExecuteNonQuery(
                            "INSERT INTO order_pack_checks (order_id, order_item_id, check_key, is_checked) VALUES (@o, @i, @k, 0)",
                            new SqliteParameter("@o", orderId),
                            new SqliteParameter("@i", itemId),
                            new SqliteParameter("@k", key));
                    }
                }
                AddEvent(orderId, "created", "Order created", type, body.Actor);
                return Results.Ok(new { id = orderId });
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> StartPreparing(int id, HttpRequest request)
        {
            try
            {
                var body = await Read<ActorPayload>(request);
                var row = Header(id);
                if (row == null) return Results.NotFound();
                if (S(row, "fulfillment_stage") != "New") return Fail("This order is already past the new step.");
                SetStage(id, "Preparing");
                AddEvent(id, "stage", "Preparing", "Preparing", body?.Actor);
                return Results.Ok(Load(id));
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> ToggleCheck(int id, HttpRequest request)
        {
            try
            {
                var body = await Read<CheckPayload>(request);
                var row = Header(id);
                if (row == null) return Results.NotFound();
                if (S(row, "fulfillment_stage") != "Preparing") return Fail("Open the preparing step before checking items.");
                if (body == null || body.CheckId <= 0) return Fail("Checklist item is missing.");
                DatabaseHelper.ExecuteNonQuery(@"
                    UPDATE order_pack_checks
                    SET is_checked = @on, checked_at = CASE WHEN @on = 1 THEN datetime('now','localtime') ELSE NULL END
                    WHERE id = @cid AND order_id = @oid",
                    new SqliteParameter("@on", body.Checked ? 1 : 0),
                    new SqliteParameter("@cid", body.CheckId),
                    new SqliteParameter("@oid", id));
                return Results.Ok(Load(id));
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> FinishPacking(int id, HttpRequest request)
        {
            try
            {
                var body = await Read<ActorPayload>(request);
                var row = Header(id);
                if (row == null) return Results.NotFound();
                if (S(row, "fulfillment_stage") != "Preparing") return Fail("This order is not being prepared.");
                int open = DatabaseHelper.ExecuteScalar<int>(
                    "SELECT COUNT(*) FROM order_pack_checks WHERE order_id = @id AND is_checked = 0",
                    new SqliteParameter("@id", id));
                if (open > 0) return Fail("Finish every checklist item first.");
                SetStage(id, "Ready");
                AddEvent(id, "packed", "Packing complete", "Ready", body?.Actor);
                return Results.Ok(Load(id));
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> Dispatch(int id, HttpRequest request)
        {
            try
            {
                var body = await Read<DispatchPayload>(request);
                var row = Header(id);
                if (row == null) return Results.NotFound();
                if (S(row, "fulfillment_stage") != "Ready") return Fail("Finish packing before sending this order.");
                string type = S(row, "fulfillment_type");
                if (type == "Delivery")
                {
                    if (body == null || string.IsNullOrWhiteSpace(body.Carrier) || string.IsNullOrWhiteSpace(body.TrackingNumber))
                        return Fail("Add a carrier and a tracking number.");
                    DatabaseHelper.ExecuteNonQuery(@"
                        UPDATE orders
                        SET carrier = @c, tracking_number = @n, tracking_status = 'LabelCreated', fulfillment_stage = 'OutForDelivery'
                        WHERE order_id = @id",
                        new SqliteParameter("@c", body.Carrier.Trim()),
                        new SqliteParameter("@n", body.TrackingNumber.Trim()),
                        new SqliteParameter("@id", id));
                    AddEvent(id, "dispatch", body.Carrier.Trim() + " · " + body.TrackingNumber.Trim(), "OutForDelivery", body.Actor);
                }
                else
                {
                    string note = body?.Note?.Trim() ?? "";
                    DatabaseHelper.ExecuteNonQuery(@"
                        UPDATE orders
                        SET tracking_status = 'Waiting', fulfillment_stage = 'ReadyForPickup',
                            pickup_note = CASE WHEN @note = '' THEN pickup_note ELSE @note END
                        WHERE order_id = @id",
                        new SqliteParameter("@note", note),
                        new SqliteParameter("@id", id));
                    AddEvent(id, "dispatch", string.IsNullOrWhiteSpace(note) ? "Ready for pickup" : note, "ReadyForPickup", body?.Actor);
                }
                return Results.Ok(Load(id));
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> Track(int id, HttpRequest request)
        {
            try
            {
                var body = await Read<TrackPayload>(request);
                var row = Header(id);
                if (row == null) return Results.NotFound();
                string stage = S(row, "fulfillment_stage");
                if (stage != "OutForDelivery" && stage != "ReadyForPickup") return Fail("This order is not out for delivery or pickup.");
                string status = body?.Status?.Trim() ?? "";
                if (status.Length == 0) return Fail("Choose a status.");
                bool done = status == "Delivered" || status == "Collected";
                string next = done ? "AwaitingFeedback" : stage;
                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE orders SET tracking_status = @s, fulfillment_stage = @stage WHERE order_id = @id",
                    new SqliteParameter("@s", status),
                    new SqliteParameter("@stage", next),
                    new SqliteParameter("@id", id));
                string note = body.Note?.Trim() ?? "";
                AddEvent(id, "track", string.IsNullOrWhiteSpace(note) ? status : status + " — " + note, status, body.Actor);
                return Results.Ok(Load(id));
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> Feedback(int id, HttpRequest request)
        {
            try
            {
                var body = await Read<FeedbackPayload>(request);
                var row = Header(id);
                if (row == null) return Results.NotFound();
                if (S(row, "fulfillment_stage") != "AwaitingFeedback") return Fail("Collect feedback after delivery or pickup.");
                int rating = body?.Rating ?? 0;
                if (rating < 1 || rating > 5) return Fail("Choose a rating from 1 to 5.");
                DatabaseHelper.ExecuteNonQuery(@"
                    UPDATE orders
                    SET feedback_rating = @r, feedback_comment = @c, fulfillment_stage = 'Completed', status = 'Completed'
                    WHERE order_id = @id",
                    new SqliteParameter("@r", rating),
                    new SqliteParameter("@c", (object)body.Comment?.Trim() ?? DBNull.Value),
                    new SqliteParameter("@id", id));
                AddEvent(id, "feedback", (body.Comment ?? "").Trim(), rating.ToString(CultureInfo.InvariantCulture), body.Actor);
                return Results.Ok(Load(id));
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> AddNote(int id, HttpRequest request)
        {
            try
            {
                var body = await Read<NotePayload>(request);
                var row = Header(id);
                if (row == null) return Results.NotFound();
                string message = body?.Message?.Trim() ?? "";
                if (message.Length == 0) return Fail("Write a note first.");
                AddEvent(id, "note", message, "", body.Actor);
                return Results.Ok(Load(id));
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static async System.Threading.Tasks.Task<IResult> Cancel(int id, HttpRequest request)
        {
            try
            {
                var body = await Read<ActorPayload>(request);
                var row = Header(id);
                if (row == null) return Results.NotFound();
                string stage = S(row, "fulfillment_stage");
                if (stage != "New" && stage != "Preparing" && stage != "Ready")
                    return Fail("This order has already left. Record a return from Sales if it comes back.");
                var items = DatabaseHelper.ExecuteDataTable(
                    "SELECT part_id, quantity FROM order_items WHERE order_id = @id",
                    new SqliteParameter("@id", id));
                foreach (System.Data.DataRow item in items.Rows)
                {
                    if (item["part_id"] == DBNull.Value) continue;
                    int partId = Convert.ToInt32(item["part_id"]);
                    int qty = item["quantity"] == DBNull.Value ? 0 : Convert.ToInt32(item["quantity"]);
                    if (partId <= 0 || qty <= 0) continue;
                    DatabaseHelper.ExecuteNonQuery(
                        "UPDATE parts SET quantity_in_stock = quantity_in_stock + @qty WHERE id = @pid AND is_stock_tracked = 1 AND (item_type IS NULL OR item_type != 'Service')",
                        new SqliteParameter("@qty", qty),
                        new SqliteParameter("@pid", partId));
                    FashionStock.Reconcile(partId);
                    FashionStock.LogMovement(partId, "Adjustment", qty, "Cancel order #" + id, null, "Order", id);
                }
                string paid = S(row, "payment_status");
                int customerId = row["customer_id"] == DBNull.Value ? 0 : Convert.ToInt32(row["customer_id"]);
                if (customerId > 0 && !paid.Equals("Paid", StringComparison.OrdinalIgnoreCase))
                {
                    DatabaseHelper.ExecuteNonQuery(
                        "UPDATE customers SET current_balance = current_balance - @total WHERE customer_id = @cid",
                        new SqliteParameter("@total", M(row, "total_amount")),
                        new SqliteParameter("@cid", customerId));
                }
                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE orders SET fulfillment_stage = 'Cancelled', status = 'Cancelled' WHERE order_id = @id",
                    new SqliteParameter("@id", id));
                AddEvent(id, "cancel", "Order cancelled", "Cancelled", body?.Actor);
                GlobalEvents.RaiseOrdersUpdated();
                GlobalEvents.RaiseInventoryUpdated();
                return Results.Ok(Load(id));
            }
            catch (Exception ex) { return Results.Problem(ex.Message); }
        }

        private static void SetStage(int id, string stage)
        {
            DatabaseHelper.ExecuteNonQuery(
                "UPDATE orders SET fulfillment_stage = @s WHERE order_id = @id",
                new SqliteParameter("@s", stage),
                new SqliteParameter("@id", id));
        }

        private static void AddEvent(int orderId, string type, string message, string detail, string actor)
        {
            DatabaseHelper.ExecuteNonQuery(@"
                INSERT INTO order_events (order_id, event_type, message, detail, actor, created_at)
                VALUES (@o, @t, @m, @d, @a, datetime('now','localtime'))",
                new SqliteParameter("@o", orderId),
                new SqliteParameter("@t", type ?? ""),
                new SqliteParameter("@m", message ?? ""),
                new SqliteParameter("@d", (object)detail ?? DBNull.Value),
                new SqliteParameter("@a", string.IsNullOrWhiteSpace(actor) ? "Staff" : actor.Trim()));
        }

        private static System.Data.DataRow Header(int id)
        {
            var dt = DatabaseHelper.ExecuteDataTable(
                "SELECT * FROM orders WHERE order_id = @id AND COALESCE(fulfillment_type,'') != ''",
                new SqliteParameter("@id", id));
            return dt.Rows.Count == 0 ? null : dt.Rows[0];
        }

        private static object Load(int id)
        {
            var row = Header(id);
            if (row == null) return null;
            int customerId = row["customer_id"] == DBNull.Value ? 0 : Convert.ToInt32(row["customer_id"]);
            string customer = "", phone = "", email = "", address = "";
            if (customerId > 0)
            {
                var cust = DatabaseHelper.ExecuteDataTable(
                    "SELECT full_name, phone, email, address FROM customers WHERE customer_id = @id",
                    new SqliteParameter("@id", customerId));
                if (cust.Rows.Count > 0)
                {
                    customer = S(cust.Rows[0], "full_name");
                    phone = S(cust.Rows[0], "phone");
                    email = S(cust.Rows[0], "email");
                    address = S(cust.Rows[0], "address");
                }
            }
            var itemDt = DatabaseHelper.ExecuteDataTable(@"
                SELECT i.order_item_id, i.part_id, i.quantity, i.price,
                       COALESCE(p.part_name, i.item_name, '') AS name,
                       COALESCE(p.part_number,'') AS sku,
                       COALESCE(p.size,'') AS size,
                       COALESCE(p.color,'') AS color,
                       COALESCE(p.part_image,'') AS image
                FROM order_items i
                LEFT JOIN parts p ON p.id = i.part_id
                WHERE i.order_id = @id", new SqliteParameter("@id", id));
            var items = new List<object>();
            foreach (System.Data.DataRow item in itemDt.Rows)
            {
                int qty = I(item, "quantity");
                decimal price = M(item, "price");
                items.Add(new
                {
                    id = I(item, "order_item_id"),
                    partId = item["part_id"] == DBNull.Value ? 0 : Convert.ToInt32(item["part_id"]),
                    name = S(item, "name"),
                    sku = S(item, "sku"),
                    size = S(item, "size"),
                    color = S(item, "color"),
                    image = S(item, "image"),
                    quantity = qty,
                    price,
                    total = price * qty
                });
            }
            var checkDt = DatabaseHelper.ExecuteDataTable(
                "SELECT id, order_item_id, check_key, is_checked FROM order_pack_checks WHERE order_id = @id ORDER BY id",
                new SqliteParameter("@id", id));
            var checks = new List<object>();
            foreach (System.Data.DataRow check in checkDt.Rows)
            {
                checks.Add(new
                {
                    id = I(check, "id"),
                    itemId = I(check, "order_item_id"),
                    key = S(check, "check_key"),
                    done = I(check, "is_checked") == 1
                });
            }
            var eventDt = DatabaseHelper.ExecuteDataTable(
                "SELECT id, event_type, message, detail, actor, created_at FROM order_events WHERE order_id = @id ORDER BY id DESC",
                new SqliteParameter("@id", id));
            var events = new List<object>();
            foreach (System.Data.DataRow ev in eventDt.Rows)
            {
                events.Add(new
                {
                    id = I(ev, "id"),
                    type = S(ev, "event_type"),
                    message = S(ev, "message"),
                    detail = S(ev, "detail"),
                    actor = S(ev, "actor"),
                    at = S(ev, "created_at")
                });
            }
            return new
            {
                id = I(row, "order_id"),
                date = S(row, "order_date"),
                total = M(row, "total_amount"),
                status = S(row, "status"),
                paymentStatus = S(row, "payment_status"),
                paymentMethod = S(row, "payment_method"),
                type = S(row, "fulfillment_type"),
                stage = S(row, "fulfillment_stage"),
                address = S(row, "shipping_address"),
                deliveryDate = S(row, "delivery_date"),
                notes = S(row, "notes"),
                carrier = S(row, "carrier"),
                trackingNumber = S(row, "tracking_number"),
                trackingStatus = S(row, "tracking_status"),
                pickupNote = S(row, "pickup_note"),
                rating = row["feedback_rating"] == DBNull.Value ? 0 : Convert.ToInt32(row["feedback_rating"]),
                feedback = S(row, "feedback_comment"),
                customer = new { id = customerId, name = customer, phone, email, address },
                items,
                checks,
                events
            };
        }

        private static async System.Threading.Tasks.Task<T> Read<T>(HttpRequest request) where T : class
        {
            if (request.ContentLength.GetValueOrDefault() == 0) return null;
            return await JsonSerializer.DeserializeAsync<T>(request.Body, JsonOpts);
        }

        private static IResult Fail(string message) => Results.BadRequest(new { error = message });
        private static string S(System.Data.DataRow row, string col) => row[col] == DBNull.Value ? "" : row[col]?.ToString() ?? "";
        private static int I(System.Data.DataRow row, string col) => row[col] == DBNull.Value ? 0 : Convert.ToInt32(row[col]);
        private static decimal M(System.Data.DataRow row, string col) => row[col] == DBNull.Value ? 0m : Convert.ToDecimal(row[col]);

        private class ShopOrderPayload
        {
            public int CustomerId { get; set; }
            public string FulfillmentType { get; set; }
            public string Address { get; set; }
            public string PickupNote { get; set; }
            public string DeliveryDate { get; set; }
            public string PaymentMethod { get; set; }
            public bool IsPaid { get; set; }
            public string Notes { get; set; }
            public string Actor { get; set; }
            public List<ShopOrderLine> Items { get; set; }
        }

        private class ShopOrderLine
        {
            public int PartId { get; set; }
            public int Quantity { get; set; }
            public decimal Price { get; set; }
        }

        private class ActorPayload { public string Actor { get; set; } }
        private class CheckPayload { public int CheckId { get; set; } public bool Checked { get; set; } }
        private class DispatchPayload { public string Carrier { get; set; } public string TrackingNumber { get; set; } public string Note { get; set; } public string Actor { get; set; } }
        private class TrackPayload { public string Status { get; set; } public string Note { get; set; } public string Actor { get; set; } }
        private class FeedbackPayload { public int Rating { get; set; } public string Comment { get; set; } public string Actor { get; set; } }
        private class NotePayload { public string Message { get; set; } public string Actor { get; set; } }
    }
}
