using System;
using System.Collections.Generic;
using System.IO;
using System.Windows.Forms;
using InventorySystem.Helpers;
using Microsoft.Data.Sqlite;

namespace InventorySystem.Services
{
    /// <summary>
    /// Content for the 7.10 website that is managed in this app: store facts, placed images, the gallery and reviews.
    /// The tables (site_settings, site_media, site_reviews) sync to the website like products do.
    /// </summary>
    public static class SiteContent
    {
        /// <summary>Store facts the website shows. Key, English label for the editor, default English, default Arabic.</summary>
        public static readonly (string Key, string Label, string En, string Ar)[] Facts =
        {
            ("delivery_time", "Delivery time", "1-3 working days", "١-٣ أيام عمل"),
            ("return_window", "Return window", "7 days", "٧ أيام"),
            ("fabric_spec", "Fabric spec (homepage)", "Quick-dry, breathable knit", "نسيج يتنفّس وسريع الجفاف"),
            ("care_instructions", "Fabric and care", "Machine wash cold, hang to dry.", "اغسل بماء بارد، وجفّف بالتعليق."),
            ("reply_time", "WhatsApp reply time", "a few hours", "ساعات قليلة"),
            ("whish_number", "Whish number", "+961 81 628259", "+961 81 628259"),
            ("currency_note", "Prices shown in", "USD", "الدولار الأميركي"),
            ("instagram_handle", "Instagram handle", "@7.10brand", "@7.10brand"),
        };

        /// <summary>Image slots on the website. Gallery tiles use slot "gallery".</summary>
        public static readonly (string Slot, string Label)[] Slots =
        {
            ("hero", "Homepage campaign photo"),
            ("fabric", "Fabric close-up"),
            ("about", "About us: founders photo"),
            ("gallery", "Gallery tile"),
        };

        private static string DemoDir => Path.Combine(Application.StartupPath, "Assets", "Demo");

        /// <summary>Copies a demo picture into the product images folder and returns its stored path.</summary>
        private static string DemoImage(string name)
        {
            string src = Path.Combine(DemoDir, name + ".png");
            if (!File.Exists(src)) return null;
            string dest = Path.Combine(DatabaseConfig.PartsImagesDirectory, "demo-" + name + ".png");
            File.Copy(src, dest, true);
            return dest;
        }

        /// <summary>Makes sure every fact has a row, so the editor always lists them.</summary>
        public static void EnsureFacts()
        {
            foreach (var f in Facts)
            {
                DatabaseHelper.ExecuteNonQuery(
                    "INSERT OR IGNORE INTO site_settings (setting_key, value_en, value_ar, note) VALUES (@k, @en, @ar, @note)",
                    new SqliteParameter("@k", f.Key), new SqliteParameter("@en", f.En),
                    new SqliteParameter("@ar", f.Ar), new SqliteParameter("@note", f.Label));
            }
        }

        /// <summary>
        /// Loads the trail-collection demo shown in the website designs: categories, 8 products with sizes and colours,
        /// store facts, campaign images, the gallery and placeholder reviews. Safe to run again: it skips rows already there.
        /// </summary>
        public static object SeedTrailDemo()
        {
            DatabaseHelper.EnsureSchema();
            EnsureFacts();

            int mainWh = 1;
            object wh = DatabaseHelper.ExecuteScalar<object>("SELECT id FROM warehouses WHERE code = 'MAIN' LIMIT 1");
            if (wh != null && wh != DBNull.Value) mainWh = Convert.ToInt32(wh);

            int Category(string name, string ar, int sort, string image)
            {
                object id = DatabaseHelper.ExecuteScalar<object>("SELECT id FROM categories WHERE category_name = @n", new SqliteParameter("@n", name));
                if (id != null && id != DBNull.Value) return Convert.ToInt32(id);
                DatabaseHelper.ExecuteNonQuery(
                    "INSERT INTO categories (category_name, category_name_ar, sort_order, category_image, description) VALUES (@n, @ar, @s, @img, @n)",
                    new SqliteParameter("@n", name), new SqliteParameter("@ar", ar), new SqliteParameter("@s", sort),
                    new SqliteParameter("@img", (object)DemoImage(image) ?? DBNull.Value));
                return (int)DatabaseHelper.ExecuteScalar<long>("SELECT last_insert_rowid()");
            }

            int women = Category("Women", "نساء", 1, "c-women");
            int men = Category("Men", "رجال", 2, "c-men");
            int hijabs = Category("Sports hijabs", "حجاب رياضي", 3, "c-sports-hijabs");
            int gear = Category("Trail & gear", "المسارات والمعدّات", 4, "c-trail-gear");

            string[] apparel = { "XS", "S", "M", "L", "XL" };
            string[] menSizes = { "S", "M", "L", "XL", "XXL" };
            string[] one = { "One size" };

            // Name, style, category, gender, fabric, image key, price, new?, sizes, extra colours?
            var products = new (string Name, string Style, int Cat, string Gender, string Fabric, string Img, decimal Price, bool New, string[] Sizes, bool Colours, string Desc)[]
            {
                ("Trail long-sleeve top", "TRAIL-TOP", women, "Women", "quick-dry knit", "trail-top", 28m, true, apparel, true,
                    "Built for the climb. Long sleeves, a loose cut and a longer hem, in a breathable knit that keeps up from summit to street."),
                ("Summit hoodie", "SUMMIT-HOOD", men, "Men", "breathable fleece", "summit-hoodie", 45m, false, menSizes, true,
                    "A loose-fit fleece hoodie for cold starts and summit breaks."),
                ("Ridge training tee", "RIDGE-TEE", men, "Men", "loose fit", "ridge-tee", 22m, false, menSizes, true,
                    "A loose training tee with a longer cut, for the gym and the trail."),
                ("Pull-on sports hijab", "PULL-HIJAB", hijabs, "Women", "breathable mesh", "sports-hijab", 15m, true, one, true,
                    "A pull-on sports hijab in breathable mesh that stays put on the move."),
                ("Switchback trail pants", "SWITCH-PANT", gear, "Unisex", "loose, stretch", "trail-pants", 38m, false, apparel, true,
                    "Loose, stretchy trail pants with room to climb."),
                ("Basecamp shell jacket", "BASECAMP-JKT", gear, "Unisex", "wind and light rain", "shell-jacket", 65m, true, apparel, true,
                    "A light shell for wind and light rain, cut long for coverage."),
                ("Flag cap", "FLAG-CAP", gear, "Accessories", "adjustable", "flag-cap", 14m, false, one, false,
                    "An adjustable cap with the 7.10 flag."),
                ("Daypack 22L", "DAYPACK-22", gear, "Gear", "water-resistant", "daypack", 35m, false, one, false,
                    "A water-resistant 22-litre daypack for a full day out."),
            };

            int added = 0;
            foreach (var p in products)
            {
                var colours = new List<(string Colour, string Img)> { ("Olive", $"p-{p.Img}-olive") };
                if (p.Colours) { colours.Add(("Khaki", $"p-{p.Img}-khaki")); colours.Add(("Linen", $"p-{p.Img}-linen")); }

                foreach (var (colour, img) in colours)
                {
                    string image = DemoImage(img);
                    foreach (string size in p.Sizes)
                    {
                        string sku = $"{p.Style}-{colour.ToUpperInvariant()}-{size.Replace(" ", "").ToUpperInvariant()}";
                        int exists = DatabaseHelper.ExecuteScalar<int>("SELECT COUNT(*) FROM parts WHERE part_number = @sku AND date_deleted IS NULL",
                            new SqliteParameter("@sku", sku));
                        if (exists > 0) continue;

                        int stock = size == "M" || size == "One size" ? 18 : size == "XS" || size == "XXL" ? 4 : 10;
                        DatabaseHelper.ExecuteNonQuery(@"
                            INSERT INTO parts (part_name, part_number, description, category_id, purchase_price, selling_price,
                                quantity_in_stock, minimum_stock_level, status, date_added, item_type, is_sales_item, is_stock_tracked,
                                brand, size, color, style_code, source_kind, gender, fabric, collection, part_image, is_new)
                            VALUES (@name, @sku, @desc, @cat, @cost, @price, @stock, 3, 'Active', datetime('now'), 'Product', 1, 1,
                                '7.10', @size, @colour, @style, 'made', @gender, @fabric, 'Trail Series', @img, @new)",
                            new SqliteParameter("@name", p.Name), new SqliteParameter("@sku", sku), new SqliteParameter("@desc", p.Desc),
                            new SqliteParameter("@cat", p.Cat), new SqliteParameter("@cost", Math.Round(p.Price * 0.45m, 2)),
                            new SqliteParameter("@price", p.Price), new SqliteParameter("@stock", stock),
                            new SqliteParameter("@size", size), new SqliteParameter("@colour", colour), new SqliteParameter("@style", p.Style),
                            new SqliteParameter("@gender", p.Gender), new SqliteParameter("@fabric", p.Fabric),
                            new SqliteParameter("@img", (object)image ?? DBNull.Value), new SqliteParameter("@new", p.New ? 1 : 0));
                        int id = (int)DatabaseHelper.ExecuteScalar<long>("SELECT last_insert_rowid()");
                        DatabaseHelper.ExecuteNonQuery("INSERT OR REPLACE INTO stock_levels (part_id, warehouse_id, quantity, reorder_level) VALUES (@p, @w, @q, 3)",
                            new SqliteParameter("@p", id), new SqliteParameter("@w", mainWh), new SqliteParameter("@q", stock));
                        added++;
                    }
                }
            }

            void Media(string slot, string img, string en, string ar, string span, int sort)
            {
                int exists = DatabaseHelper.ExecuteScalar<int>("SELECT COUNT(*) FROM site_media WHERE slot = @s AND sort_order = @o",
                    new SqliteParameter("@s", slot), new SqliteParameter("@o", sort));
                if (exists > 0) return;
                DatabaseHelper.ExecuteNonQuery(
                    "INSERT INTO site_media (slot, image_path, caption_en, caption_ar, span, sort_order) VALUES (@s, @i, @en, @ar, @span, @o)",
                    new SqliteParameter("@s", slot), new SqliteParameter("@i", (object)DemoImage(img) ?? DBNull.Value),
                    new SqliteParameter("@en", en), new SqliteParameter("@ar", ar), new SqliteParameter("@span", span), new SqliteParameter("@o", sort));
            }

            Media("hero", "hero", "Summit hoodie", "هودي القمّة", "normal", 0);
            Media("fabric", "fabric", "Fabric close-up", "لقطة قريبة للقماش", "normal", 0);
            Media("about", "about", "Founders photo · on the trail", "صورة المؤسسين · على المسار", "normal", 0);
            Media("gallery", "g-1", "[Photo · Trail day · Qadisha Valley]", "[صورة · يوم على المسار · وادي قاديشا]", "large", 1);
            Media("gallery", "g-2", "[Photo · Sports hijab on the run]", "[صورة · الحجاب الرياضي أثناء الجري]", "normal", 2);
            Media("gallery", "g-3", "[Photo · Summit · Qurnat as Sawda]", "[صورة · القمّة · القرنة السوداء]", "tall", 3);
            Media("gallery", "g-4", "[Photo · Fabric in motion]", "[صورة · القماش في الحركة]", "normal", 4);
            Media("gallery", "g-5", "[Photo · Community hike · Chouf cedars]", "[صورة · مشي جماعي · أرز الشوف]", "normal", 5);
            Media("gallery", "g-6", "[Photo · Basecamp at dawn]", "[صورة · المخيّم عند الفجر]", "wide", 6);
            Media("gallery", "g-7", "[Photo · Golden hour · Tannourine]", "[صورة · الساعة الذهبية · تنّورين]", "normal", 7);

            void Review(string quote, string lang, string product, string name, string city, int sort)
            {
                int exists = DatabaseHelper.ExecuteScalar<int>("SELECT COUNT(*) FROM site_reviews WHERE sort_order = @o AND is_placeholder = 1",
                    new SqliteParameter("@o", sort));
                if (exists > 0) return;
                DatabaseHelper.ExecuteNonQuery(
                    @"INSERT INTO site_reviews (quote, lang, product_name, customer_name, city, rating, is_placeholder, is_approved, sort_order)
                      VALUES (@q, @l, @p, @n, @c, 5, 1, 1, @o)",
                    new SqliteParameter("@q", quote), new SqliteParameter("@l", lang), new SqliteParameter("@p", product),
                    new SqliteParameter("@n", name), new SqliteParameter("@c", city), new SqliteParameter("@o", sort));
            }

            // Placeholders from the design, clearly bracketed until real reviews replace them.
            Review("[Real customer quote: what they bought, where they wore it, and how it held up.]", "en", "[Product name]", "[Customer name]", "[City]", 1);
            Review("[رأي حقيقي من عميل: ماذا اشترى، وأين لبسه، وكيف كان.]", "ar", "[اسم المنتج]", "[اسم العميل]", "[المدينة]", 2);
            Review("[Real customer quote: what they bought, where they wore it, and how it held up.]", "en", "[Product name]", "[Customer name]", "[City]", 3);

            return new { seeded = true, products = added };
        }
    }
}
