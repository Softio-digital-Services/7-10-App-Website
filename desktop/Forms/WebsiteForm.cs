using System;
using System.Data;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using InventorySystem.Helpers;
using InventorySystem.Services;
using Microsoft.Data.Sqlite;

namespace InventorySystem.Forms
{
    /// <summary>
    /// Website screen: everything the 7.10 website shows besides products — store facts, placed images,
    /// the gallery and customer reviews. Saved rows sync to the website with the rest of the shop data.
    /// </summary>
    public class WebsiteForm : UserControl
    {
        private readonly TabControl tabs = new() { Dock = DockStyle.Fill };
        private readonly DataGridView gridFacts = NewGrid();
        private readonly DataGridView gridImages = NewGrid();
        private readonly DataGridView gridGallery = NewGrid();
        private readonly DataGridView gridReviews = NewGrid();
        private readonly PictureBox preview = new() { Dock = DockStyle.Right, Width = 320, SizeMode = PictureBoxSizeMode.Zoom, BackColor = Color.FromArgb(244, 243, 236) };
        private readonly Label status = new() { AutoSize = true, ForeColor = Color.FromArgb(85, 88, 74), Padding = new Padding(0, 10, 0, 0) };

        public WebsiteForm()
        {
            Size = new Size(1100, 750);
            BackColor = ThemeConfig.SurfaceColor;

            var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3, Padding = new Padding(20) };
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            Controls.Add(layout);

            var title = ThemeConfig.CreateStandardHeader(LocalizationManager.GetString("Nav_Website", "Website"));
            var btnDemo = new Button { Text = "Load demo data", Size = new Size(170, 35) };
            ThemeConfig.ApplyPrimaryButton(btnDemo);
            btnDemo.Click += (s, e) => LoadDemo();
            var btnSave = new Button { Text = "Save changes", Size = new Size(150, 35) };
            ThemeConfig.ApplyPrimaryButton(btnSave);
            btnSave.Click += (s, e) => SaveAll();
            layout.Controls.Add(ThemeConfig.CreateGlobalFormHeader(title, null, new Control[] { btnDemo, btnSave }), 0, 0);

            tabs.TabPages.Add(Page("Store facts", gridFacts, null));
            tabs.TabPages.Add(Page("Images", gridImages, Buttons(("Choose image…", () => ChooseImage(gridImages)))));
            tabs.TabPages.Add(Page("Gallery", gridGallery, Buttons(
                ("Add tile", () => AddRow("INSERT INTO site_media (slot, caption_en, caption_ar, span, sort_order) VALUES ('gallery', '', '', 'normal', (SELECT COALESCE(MAX(sort_order),0)+1 FROM site_media WHERE slot='gallery'))")),
                ("Choose image…", () => ChooseImage(gridGallery)),
                ("Remove", () => RemoveRow(gridGallery, "site_media")))));
            tabs.TabPages.Add(Page("Reviews", gridReviews, Buttons(
                ("Add review", () => AddRow("INSERT INTO site_reviews (quote, lang, rating, is_approved, is_placeholder, sort_order) VALUES ('', 'en', 5, 0, 0, (SELECT COALESCE(MAX(sort_order),0)+1 FROM site_reviews))")),
                ("Remove", () => RemoveRow(gridReviews, "site_reviews")))));
            layout.Controls.Add(tabs, 0, 1);
            layout.Controls.Add(status, 0, 2);

            gridImages.SelectionChanged += (s, e) => ShowPreview(gridImages);
            gridGallery.SelectionChanged += (s, e) => ShowPreview(gridGallery);
            tabs.SelectedIndexChanged += (s, e) => preview.Image = null;

            ThemeConfig.ApplyGlobalTheme(this);
            LoadAll();
        }

        private static DataGridView NewGrid() => new()
        {
            Dock = DockStyle.Fill,
            BackgroundColor = Color.White,
            BorderStyle = BorderStyle.None,
            RowHeadersVisible = false,
            AllowUserToAddRows = false,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            MultiSelect = false,
        };

        private TabPage Page(string text, DataGridView grid, Control toolbar)
        {
            var page = new TabPage(text) { Padding = new Padding(8), BackColor = Color.White };
            page.Controls.Add(grid);
            if (grid == gridImages || grid == gridGallery) page.Controls.Add(preview);
            if (toolbar != null) page.Controls.Add(toolbar);
            return page;
        }

        private static FlowLayoutPanel Buttons(params (string Text, Action Click)[] items)
        {
            var bar = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 46, Padding = new Padding(0, 4, 0, 4) };
            foreach (var (text, click) in items)
            {
                var b = new Button { Text = text, Size = new Size(150, 34) };
                ThemeConfig.ApplyPrimaryButton(b);
                b.Click += (s, e) => click();
                bar.Controls.Add(b);
            }
            return bar;
        }

        private void LoadAll()
        {
            try
            {
                SiteContent.EnsureFacts();
                Bind(gridFacts, "SELECT id, note AS Fact, value_en AS English, value_ar AS Arabic FROM site_settings ORDER BY id", "Fact");
                Bind(gridImages, "SELECT id, slot AS Slot, caption_en AS [Caption EN], caption_ar AS [Caption AR], image_path AS Image FROM site_media WHERE slot <> 'gallery' ORDER BY slot", "Slot", "Image");
                Bind(gridGallery, "SELECT id, caption_en AS [Caption EN], caption_ar AS [Caption AR], span AS Size, sort_order AS [Order], is_active AS Shown, image_path AS Image FROM site_media WHERE slot = 'gallery' ORDER BY sort_order", "Image");
                Bind(gridReviews, "SELECT id, quote AS Quote, lang AS Language, product_name AS Product, customer_name AS Customer, city AS City, rating AS Stars, is_approved AS Approved, is_placeholder AS Placeholder, sort_order AS [Order] FROM site_reviews ORDER BY sort_order");
                status.Text = "Changes reach the website on the next sync.";
            }
            catch (Exception ex)
            {
                status.Text = "Could not load website content: " + ex.Message;
            }
        }

        private static void Bind(DataGridView grid, string sql, params string[] readOnly)
        {
            DataTable table = DatabaseHelper.ExecuteDataTable(sql);
            grid.DataSource = table;
            if (grid.Columns.Contains("id")) grid.Columns["id"].Visible = false;
            foreach (string col in readOnly)
                if (grid.Columns.Contains(col)) grid.Columns[col].ReadOnly = true;
        }

        private void SaveAll()
        {
            try
            {
                gridFacts.EndEdit(); gridImages.EndEdit(); gridGallery.EndEdit(); gridReviews.EndEdit();
                foreach (DataGridViewRow r in gridFacts.Rows)
                    DatabaseHelper.ExecuteNonQuery("UPDATE site_settings SET value_en = @en, value_ar = @ar WHERE id = @id",
                        P("@en", r.Cells["English"].Value), P("@ar", r.Cells["Arabic"].Value), P("@id", r.Cells["id"].Value));
                foreach (DataGridViewRow r in gridImages.Rows)
                    DatabaseHelper.ExecuteNonQuery("UPDATE site_media SET caption_en = @en, caption_ar = @ar WHERE id = @id",
                        P("@en", r.Cells["Caption EN"].Value), P("@ar", r.Cells["Caption AR"].Value), P("@id", r.Cells["id"].Value));
                foreach (DataGridViewRow r in gridGallery.Rows)
                    DatabaseHelper.ExecuteNonQuery("UPDATE site_media SET caption_en = @en, caption_ar = @ar, span = @span, sort_order = @o, is_active = @a WHERE id = @id",
                        P("@en", r.Cells["Caption EN"].Value), P("@ar", r.Cells["Caption AR"].Value), P("@span", r.Cells["Size"].Value),
                        P("@o", r.Cells["Order"].Value), P("@a", r.Cells["Shown"].Value), P("@id", r.Cells["id"].Value));
                foreach (DataGridViewRow r in gridReviews.Rows)
                    DatabaseHelper.ExecuteNonQuery(@"UPDATE site_reviews SET quote = @q, lang = @l, product_name = @p, customer_name = @n, city = @c,
                                                     rating = @s, is_approved = @a, is_placeholder = @ph, sort_order = @o WHERE id = @id",
                        P("@q", r.Cells["Quote"].Value), P("@l", r.Cells["Language"].Value), P("@p", r.Cells["Product"].Value),
                        P("@n", r.Cells["Customer"].Value), P("@c", r.Cells["City"].Value), P("@s", r.Cells["Stars"].Value),
                        P("@a", r.Cells["Approved"].Value), P("@ph", r.Cells["Placeholder"].Value), P("@o", r.Cells["Order"].Value),
                        P("@id", r.Cells["id"].Value));
                status.Text = "Saved. The website updates on the next sync.";
            }
            catch (Exception ex)
            {
                status.Text = "Could not save: " + ex.Message;
            }
        }

        private static SqliteParameter P(string name, object value) => new(name, value ?? DBNull.Value);

        private void AddRow(string sql)
        {
            SaveAll();
            DatabaseHelper.ExecuteNonQuery(sql);
            LoadAll();
        }

        private void RemoveRow(DataGridView grid, string table)
        {
            if (grid.CurrentRow == null) return;
            if (MessageBox.Show("Remove this row from the website?", "Website", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            DatabaseHelper.ExecuteNonQuery($"DELETE FROM {table} WHERE id = @id", P("@id", grid.CurrentRow.Cells["id"].Value));
            LoadAll();
        }

        private void ChooseImage(DataGridView grid)
        {
            if (grid.CurrentRow == null) return;
            using var dlg = new OpenFileDialog { Filter = "Images|*.jpg;*.jpeg;*.png;*.webp" };
            if (dlg.ShowDialog() != DialogResult.OK) return;
            string dest = Path.Combine(DatabaseConfig.PartsImagesDirectory, "site-" + Guid.NewGuid().ToString("N")[..12] + Path.GetExtension(dlg.FileName).ToLowerInvariant());
            File.Copy(dlg.FileName, dest, true);
            DatabaseHelper.ExecuteNonQuery("UPDATE site_media SET image_path = @p WHERE id = @id", P("@p", dest), P("@id", grid.CurrentRow.Cells["id"].Value));
            LoadAll();
        }

        private void ShowPreview(DataGridView grid)
        {
            try
            {
                string path = grid.CurrentRow?.Cells["Image"].Value as string;
                if (string.IsNullOrEmpty(path) || !File.Exists(path)) { preview.Image = null; return; }
                using var fs = new FileStream(path, FileMode.Open, FileAccess.Read);
                preview.Image = Image.FromStream(fs);
            }
            catch { preview.Image = null; }
        }

        private void LoadDemo()
        {
            if (MessageBox.Show("Load the trail demo collection (categories, 8 products, gallery and placeholder reviews)?", "Website",
                    MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            try
            {
                SiteContent.SeedTrailDemo();
                LoadAll();
                status.Text = "Demo collection loaded. It reaches the website on the next sync.";
            }
            catch (Exception ex)
            {
                status.Text = "Could not load the demo: " + ex.Message;
            }
        }
    }
}
