using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using Microsoft.Data.Sqlite;
using InventorySystem.Helpers;

namespace InventorySystem.Services
{
    public class SalesReportSummary
    {
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public decimal TotalExpenses { get; set; }
        /// <summary>Cost of what was sold, minus the cost of items that came back.</summary>
        public decimal TotalCost { get; set; }
        /// <summary>Net sales: what was sold minus refunds.</summary>
        public decimal TotalSales { get; set; }
        public decimal TotalProfit { get; set; }
        public decimal TotalProfitAfterExpenses { get; set; }
        /// <summary>Sales before refunds.</summary>
        public decimal GrossSales { get; set; }
        /// <summary>Money refunded for returns in the period.</summary>
        public decimal TotalReturns { get; set; }
        /// <summary>False when the report is narrowed to a category / product / collection / supplier:
        /// expenses (rent, salaries...) belong to the whole shop, so they are not charged to a slice.</summary>
        public bool ExpensesIncluded { get; set; } = true;
        /// <summary>Products sold in the period with no known cost: their profit is overstated until a cost is entered.</summary>
        public List<string> MissingCostProducts { get; set; } = new List<string>();
        /// <summary>Money given away by promotions (normal price - promotion price) on items sold in the period.</summary>
        public decimal PromotionDiscounts { get; set; }
    }

    /// <summary>Narrows a report to part of the catalogue. Empty = the whole shop.</summary>
    public class ReportFilter
    {
        public string Category { get; set; }
        /// <summary>Product ids, e.g. every size/colour of one product.</summary>
        public List<int> PartIds { get; set; } = new List<int>();
        public string Collection { get; set; }
        public int? SupplierId { get; set; }
        /// <summary>Only sales made under this promotion (and returns of those sales).</summary>
        public int? PromotionId { get; set; }

        public bool IsEmpty =>
            string.IsNullOrWhiteSpace(Category) && PartIds.Count == 0 &&
            string.IsNullOrWhiteSpace(Collection) && !(SupplierId > 0) && !(PromotionId > 0);

        /// <summary>Extra WHERE conditions on parts alias <c>p</c>, plus their parameters.</summary>
        internal string Sql(List<SqliteParameter> ps)
        {
            var sb = new StringBuilder();
            if (!string.IsNullOrWhiteSpace(Category))
            {
                sb.Append(" AND p.category_id IN (SELECT id FROM categories WHERE category_name = @f_cat)");
                ps.Add(new SqliteParameter("@f_cat", Category.Trim()));
            }
            if (PartIds.Count > 0)
            {
                // Ids are parsed ints, so inlining them is safe
                sb.Append(" AND p.id IN (").Append(string.Join(",", PartIds.Distinct())).Append(')');
            }
            if (!string.IsNullOrWhiteSpace(Collection))
            {
                sb.Append(" AND LOWER(TRIM(COALESCE(p.collection, ''))) = LOWER(@f_col)");
                ps.Add(new SqliteParameter("@f_col", Collection.Trim()));
            }
            if (SupplierId > 0)
            {
                sb.Append(" AND p.supplier_id = @f_sup");
                ps.Add(new SqliteParameter("@f_sup", SupplierId.Value));
            }
            return sb.ToString();
        }
    }

    public class ReportService
    {
        // Draft and quotation orders are not sales; cancelled orders did not happen.
        private const string CompletedOrdersFilter =
            "o.status IS NOT NULL AND o.status NOT IN ('Draft', 'Quotation', 'Cancelled')";

        // Cost recorded when the item was sold; older sales (before that was recorded) use the current cost.
        private const string SaleCost = "COALESCE(oi.cost_price, p.purchase_price, 0)";

        // Share of the order's discount carried by each line, in proportion to its value
        // (1 when the order had no discount, or was placed before discounts were recorded).
        private const string DiscountFactor = @"(1.0 - COALESCE(CASE
            WHEN COALESCE(o.discount_amount, 0) <= 0 THEN 0
            ELSE MIN(1.0, o.discount_amount / NULLIF((SELECT SUM(oi3.quantity * oi3.price) FROM order_items oi3
                                                      WHERE oi3.order_id = o.order_id), 0))
            END, 0))";

        // A returned item gives back the cost it was sold at, when the original sale line is known.
        private const string ReturnCost = @"COALESCE(
            (SELECT oi2.cost_price FROM order_items oi2
              WHERE oi2.order_id = r.order_id AND oi2.part_id = ri.part_id AND oi2.cost_price IS NOT NULL LIMIT 1),
            p.purchase_price, 0)";

        // The promotion of the original sale line, for a returned item
        private const string ReturnPromotion = @"(SELECT oi4.promotion_id FROM order_items oi4
              WHERE oi4.order_id = r.order_id AND oi4.part_id = ri.part_id LIMIT 1)";

        public (DateTime from, DateTime to) GetPresetRange(string preset)
        {
            DateTime today = DateTime.Today;
            return (preset ?? "Daily") switch
            {
                "Weekly" => (today.AddDays(-(int)today.DayOfWeek), today),
                "Monthly" => (new DateTime(today.Year, today.Month, 1), today),
                "Yearly" => (new DateTime(today.Year, 1, 1), today),
                "Custom" => (today, today),
                _ => (today, today) // Daily
            };
        }

        /// <summary>
        /// Every sale line and every returned line in the period as one signed list
        /// (returns are negative), so all reports add up the same way.
        /// Columns: kind ('sale' | 'return'), part_id, day, qty, sales, cost.
        /// </summary>
        private static string LinesCte(ReportFilter filter, List<SqliteParameter> ps)
        {
            filter ??= new ReportFilter();
            string where = filter.Sql(ps);
            string promoSale = "", promoReturn = "";
            if (filter.PromotionId > 0)
            {
                promoSale = " AND oi.promotion_id = @f_promo";
                promoReturn = $" AND {ReturnPromotion} = @f_promo";
                ps.Add(new SqliteParameter("@f_promo", filter.PromotionId.Value));
            }
            return $@"
                WITH lines AS (
                    SELECT 'sale' AS kind, oi.part_id AS part_id, date(o.order_date) AS day,
                           oi.quantity AS qty,
                           oi.quantity * oi.price * {DiscountFactor} AS sales,
                           oi.quantity * {SaleCost} AS cost,
                           oi.promotion_id AS promotion_id,
                           CASE WHEN oi.promotion_id IS NOT NULL AND oi.list_price > oi.price
                                THEN oi.quantity * (oi.list_price - oi.price) ELSE 0 END AS promo_discount,
                           CASE WHEN oi.promotion_id IS NOT NULL
                                THEN oi.quantity * COALESCE(oi.list_price, oi.price) ELSE 0 END AS list_value
                    FROM order_items oi
                    INNER JOIN orders o ON oi.order_id = o.order_id
                    LEFT JOIN parts p ON oi.part_id = p.id
                    WHERE date(o.order_date) BETWEEN date(@from) AND date(@to)
                      AND {CompletedOrdersFilter}{where}{promoSale}
                    UNION ALL
                    SELECT 'return', ri.part_id, date(r.return_date),
                           -COALESCE(ri.quantity, 0),
                           -COALESCE(ri.refund_amount, 0),
                           -COALESCE(ri.quantity, 0) * {ReturnCost},
                           {ReturnPromotion},
                           0, 0
                    FROM return_items ri
                    INNER JOIN returns r ON ri.return_id = r.return_id
                    LEFT JOIN parts p ON ri.part_id = p.id
                    WHERE date(r.return_date) BETWEEN date(@from) AND date(@to){where}{promoReturn}
                )";
        }

        private static List<SqliteParameter> RangeParams(DateTime fromDate, DateTime toDate) => new List<SqliteParameter>
        {
            new SqliteParameter("@from", fromDate.Date.ToString("yyyy-MM-dd")),
            new SqliteParameter("@to", toDate.Date.ToString("yyyy-MM-dd"))
        };

        public SalesReportSummary GetSummary(DateTime fromDate, DateTime toDate, ReportFilter filter = null)
        {
            filter ??= new ReportFilter();
            var ps = RangeParams(fromDate, toDate);
            var dt = DatabaseHelper.ExecuteDataTable(LinesCte(filter, ps) + @"
                SELECT
                    COALESCE(SUM(CASE WHEN kind = 'sale' THEN sales END), 0) AS gross_sales,
                    COALESCE(-SUM(CASE WHEN kind = 'return' THEN sales END), 0) AS returns,
                    COALESCE(SUM(sales), 0) AS net_sales,
                    COALESCE(SUM(cost), 0) AS net_cost,
                    COALESCE(SUM(promo_discount), 0) AS promo_discount
                FROM lines", ps.ToArray());
            var row = dt.Rows.Count > 0 ? dt.Rows[0] : null;
            decimal D(string col) => row == null || row[col] == DBNull.Value ? 0m : Convert.ToDecimal(row[col]);

            decimal totalExpenses = 0m;
            if (filter.IsEmpty)
            {
                totalExpenses = DatabaseHelper.ExecuteScalar<decimal>(@"
                    SELECT COALESCE(SUM(amount), 0)
                    FROM expenses
                    WHERE date(expense_date) BETWEEN date(@from) AND date(@to)
                      AND date_deleted IS NULL", RangeParams(fromDate, toDate).ToArray());
            }

            var missingPs = RangeParams(fromDate, toDate);
            var missing = DatabaseHelper.ExecuteDataTable(LinesCte(filter, missingPs) + @"
                SELECT DISTINCT p.part_name AS name
                FROM lines l INNER JOIN parts p ON l.part_id = p.id
                WHERE l.kind = 'sale' AND l.qty > 0 AND COALESCE(l.cost, 0) = 0
                  AND COALESCE(p.item_type, 'Product') <> 'Service'
                ORDER BY p.part_name LIMIT 50", missingPs.ToArray());

            decimal sales = D("net_sales");
            decimal cost = D("net_cost");
            decimal profit = sales - cost;
            return new SalesReportSummary
            {
                MissingCostProducts = missing.Rows.Cast<DataRow>().Select(r => r["name"]?.ToString() ?? "").Where(n => n.Length > 0).ToList(),
                FromDate = fromDate.Date,
                ToDate = toDate.Date,
                GrossSales = D("gross_sales"),
                PromotionDiscounts = D("promo_discount"),
                TotalReturns = D("returns"),
                TotalSales = sales,
                TotalCost = cost,
                TotalExpenses = totalExpenses,
                TotalProfit = profit,
                TotalProfitAfterExpenses = profit - totalExpenses,
                ExpensesIncluded = filter.IsEmpty
            };
        }

        public DataTable GetTopSellingProducts(DateTime fromDate, DateTime toDate, int limit = 20, ReportFilter filter = null)
        {
            var ps = RangeParams(fromDate, toDate);
            string sql = LinesCte(filter, ps) + $@"
                SELECT
                    p.part_name AS product_name,
                    SUM(l.qty) AS quantity_sold,
                    CASE WHEN SUM(l.qty) > 0 THEN SUM(l.sales) / SUM(l.qty) ELSE 0 END AS unit_price,
                    SUM(l.sales) AS total_sales,
                    SUM(l.cost) AS total_cost,
                    SUM(l.sales) - SUM(l.cost) AS profit
                FROM lines l
                INNER JOIN parts p ON l.part_id = p.id
                GROUP BY p.part_name
                ORDER BY quantity_sold DESC, total_sales DESC
                LIMIT {Math.Max(1, limit)}";
            return DatabaseHelper.ExecuteDataTable(sql, ps.ToArray());
        }

        public DataTable GetTopSellingCategories(DateTime fromDate, DateTime toDate, int limit = 20, ReportFilter filter = null)
        {
            var ps = RangeParams(fromDate, toDate);
            string sql = LinesCte(filter, ps) + $@"
                SELECT
                    COALESCE(c.category_name, 'Uncategorized') AS category_name,
                    SUM(l.qty) AS quantity_sold,
                    SUM(l.sales) AS total_sales,
                    SUM(l.cost) AS total_cost,
                    SUM(l.sales) - SUM(l.cost) AS profit
                FROM lines l
                INNER JOIN parts p ON l.part_id = p.id
                LEFT JOIN categories c ON p.category_id = c.id
                GROUP BY COALESCE(c.category_name, 'Uncategorized')
                ORDER BY profit DESC
                LIMIT {Math.Max(1, limit)}";
            return DatabaseHelper.ExecuteDataTable(sql, ps.ToArray());
        }

        /// <summary>Full sold-products list for Excel export (no limit).</summary>
        public DataTable GetSoldProductsDetail(DateTime fromDate, DateTime toDate, ReportFilter filter = null)
        {
            var ps = RangeParams(fromDate, toDate);
            string sql = LinesCte(filter, ps) + @"
                SELECT
                    p.part_name AS product_name,
                    SUM(l.qty) AS quantity_sold,
                    CASE WHEN SUM(l.qty) > 0 THEN SUM(l.sales) / SUM(l.qty) ELSE 0 END AS unit_price,
                    SUM(l.sales) AS total_sales,
                    SUM(l.cost) AS total_cost,
                    SUM(l.sales) - SUM(l.cost) AS profit
                FROM lines l
                INNER JOIN parts p ON l.part_id = p.id
                GROUP BY p.part_name
                ORDER BY total_sales DESC";
            return DatabaseHelper.ExecuteDataTable(sql, ps.ToArray());
        }

        /// <summary>
        /// Results per promotion for items sold in the period: units, what they would have sold for at the
        /// normal price, the discount given, and net sales / cost / profit (after refunds and order discounts).
        /// </summary>
        public List<object> GetPromotionResults(DateTime fromDate, DateTime toDate, ReportFilter filter = null)
        {
            var ps = RangeParams(fromDate, toDate);
            var dt = DatabaseHelper.ExecuteDataTable(LinesCte(filter, ps) + @"
                SELECT l.promotion_id AS id,
                       COALESCE(pr.name, '') AS name, pr.kind AS kind, pr.value AS value,
                       pr.date_from AS date_from, pr.date_to AS date_to,
                       SUM(CASE WHEN l.kind = 'sale' THEN l.qty ELSE 0 END) AS units,
                       SUM(l.list_value) AS list_value,
                       SUM(l.promo_discount) AS discount,
                       SUM(l.sales) AS net_sales,
                       SUM(l.cost) AS cost,
                       SUM(l.sales) - SUM(l.cost) AS profit
                FROM lines l
                LEFT JOIN promotions pr ON pr.id = l.promotion_id
                WHERE l.promotion_id IS NOT NULL
                GROUP BY l.promotion_id
                ORDER BY discount DESC", ps.ToArray());
            decimal D(DataRow r, string c) => r[c] == DBNull.Value ? 0m : Convert.ToDecimal(r[c]);
            return dt.Rows.Cast<DataRow>().Select(r => (object)new
            {
                id = Convert.ToInt32(r["id"]),
                name = r["name"]?.ToString() ?? "",
                kind = r["kind"]?.ToString() ?? "",
                value = D(r, "value"),
                dateFrom = r["date_from"]?.ToString() ?? "",
                dateTo = r["date_to"]?.ToString() ?? "",
                units = D(r, "units"),
                listValue = D(r, "list_value"),
                discount = D(r, "discount"),
                sales = D(r, "net_sales"),
                cost = D(r, "cost"),
                profit = D(r, "profit")
            }).ToList();
        }

        /// <summary>One row per month of the year: net sales, refunds, cost, profit (and expenses when unfiltered).</summary>
        public List<object> GetMonthly(int year, ReportFilter filter = null)
        {
            filter ??= new ReportFilter();
            var from = new DateTime(year, 1, 1);
            var to = new DateTime(year, 12, 31);
            var ps = RangeParams(from, to);
            var dt = DatabaseHelper.ExecuteDataTable(LinesCte(filter, ps) + @"
                SELECT CAST(strftime('%m', day) AS INTEGER) AS m,
                       COALESCE(SUM(CASE WHEN kind = 'sale' THEN sales END), 0) AS gross_sales,
                       COALESCE(-SUM(CASE WHEN kind = 'return' THEN sales END), 0) AS returns,
                       COALESCE(SUM(sales), 0) AS net_sales,
                       COALESCE(SUM(cost), 0) AS net_cost
                FROM lines GROUP BY m", ps.ToArray());

            var expenses = new Dictionary<int, decimal>();
            if (filter.IsEmpty)
            {
                var ex = DatabaseHelper.ExecuteDataTable(@"
                    SELECT CAST(strftime('%m', expense_date) AS INTEGER) AS m, COALESCE(SUM(amount), 0) AS total
                    FROM expenses
                    WHERE date(expense_date) BETWEEN date(@from) AND date(@to) AND date_deleted IS NULL
                    GROUP BY m", RangeParams(from, to).ToArray());
                foreach (DataRow r in ex.Rows)
                    if (r["m"] != DBNull.Value) expenses[Convert.ToInt32(r["m"])] = Convert.ToDecimal(r["total"]);
            }

            var byMonth = dt.Rows.Cast<DataRow>().Where(r => r["m"] != DBNull.Value)
                .ToDictionary(r => Convert.ToInt32(r["m"]));
            var list = new List<object>();
            for (int m = 1; m <= 12; m++)
            {
                byMonth.TryGetValue(m, out DataRow r);
                decimal D(string col) => r == null || r[col] == DBNull.Value ? 0m : Convert.ToDecimal(r[col]);
                decimal sales = D("net_sales"), cost = D("net_cost");
                decimal exp = expenses.TryGetValue(m, out var e) ? e : 0m;
                list.Add(new
                {
                    month = m,
                    grossSales = D("gross_sales"),
                    returns = D("returns"),
                    sales,
                    cost,
                    profit = sales - cost,
                    expenses = exp,
                    profitAfterExpenses = sales - cost - exp
                });
            }
            return list;
        }
    }
}
