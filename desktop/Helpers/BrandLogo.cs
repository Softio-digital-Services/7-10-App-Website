using System;
using System.Drawing;
using System.Drawing.Drawing2D;

namespace InventorySystem.Helpers
{
    /// <summary>
    /// Draws the 7.10 logo (mark + "7.10" wordmark) from the same shapes as the website's logo kit
    /// (web/public/brand/logo), so it stays sharp at any display scale.
    /// </summary>
    public static class BrandLogo
    {
        // The mark on a 463 x 366 grid.
        private static readonly PointF[] Bar = Pts(0, 0, 92, 0, 219, 217, 180, 284);
        private static readonly PointF[] Seven = Pts(118, 0, 463, 0, 231, 366, 194, 304, 322, 77, 162, 77);
        private static readonly PointF[] Triangle = Pts(174, 97, 290, 97, 232, 195);

        private static readonly Color Olive = Color.FromArgb(49, 59, 43);
        private static readonly Color Khaki = Color.FromArgb(138, 136, 99);
        private static readonly Color Khaki60 = Color.FromArgb(185, 184, 161);
        private static readonly Color Linen = Color.FromArgb(213, 212, 194);
        private static readonly Color Crimson = Color.FromArgb(181, 21, 21);

        private static PointF[] Pts(params float[] xy)
        {
            var p = new PointF[xy.Length / 2];
            for (int i = 0; i < p.Length; i++) p[i] = new PointF(xy[i * 2], xy[i * 2 + 1]);
            return p;
        }

        /// <summary>Renders the logo at the given pixel height. onDark uses the linen artwork for olive grounds.</summary>
        public static Bitmap Render(int height, bool onDark, bool withWordmark = true)
        {
            const float markW = 463f, markH = 366f, gap = 60f, wordW = 202f * 2.3f;
            float fullW = withWordmark ? markW + gap + wordW : markW;
            float scale = height / markH;
            var bmp = new Bitmap(Math.Max(1, (int)Math.Ceiling(fullW * scale)), Math.Max(1, height));
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.Clear(Color.Transparent);
                g.ScaleTransform(scale, scale);
                using (var bar = new SolidBrush(onDark ? Khaki60 : Khaki))
                using (var seven = new SolidBrush(onDark ? Linen : Olive))
                using (var tri = new SolidBrush(Crimson))
                {
                    g.FillPolygon(bar, Bar);
                    g.FillPolygon(seven, Seven);
                    g.FillPolygon(tri, Triangle);
                    if (withWordmark)
                    {
                        g.TranslateTransform(markW + gap, (markH - 100f * 2.3f) / 2f);
                        g.ScaleTransform(2.3f, 2.3f);
                        using (var path = Wordmark())
                            g.FillPath(seven, path);
                    }
                }
            }
            return bmp;
        }

        /// <summary>Squared jersey-style "7.10", 202 x 100 units.</summary>
        private static GraphicsPath Wordmark()
        {
            var path = new GraphicsPath(FillMode.Alternate);
            path.AddPolygon(Pts(0, 0, 64, 0, 64, 18, 32, 100, 12, 100, 42, 18, 0, 18)); // 7
            path.AddRectangle(new RectangleF(74, 82, 18, 18)); // .
            path.AddPolygon(Pts(102, 0, 126, 0, 126, 100, 106, 100, 106, 20, 102, 20)); // 1
            path.AddPath(RoundedRect(new RectangleF(146, 0, 56, 100), 12), false); // 0
            path.AddRectangle(new RectangleF(164, 18, 20, 64)); // 0's counter (cut out by the alternate fill)
            return path;
        }

        public static GraphicsPath RoundedRect(RectangleF r, float radius)
        {
            float d = radius * 2;
            var p = new GraphicsPath();
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }
    }
}
