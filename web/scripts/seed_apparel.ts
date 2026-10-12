import { createClient } from "@libsql/client";

const dbPath = "file:C:/Users/Baraa/AppData/Local/SevenTenInventory/Data/inventory.db";
const client = createClient({ url: dbPath });

const now = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

async function main() {
  await client.execute("PRAGMA busy_timeout = 10000;");

  console.log("Cleaning and resetting TEST1, TEST2, TEST3 apparel clothing catalog...");

  // 1. Get IDs of existing TEST1, TEST2, TEST3 categories
  const cats = await client.execute("SELECT id, category_name FROM categories WHERE category_name IN ('TEST1', 'TEST2', 'TEST3')");
  const catIds = cats.rows.map(r => Number(r.id));

  if (catIds.length > 0) {
    const placeholders = catIds.map(() => "?").join(",");
    // Delete stock levels for parts in these categories
    await client.execute({
      sql: `DELETE FROM stock_levels WHERE part_id IN (SELECT id FROM parts WHERE category_id IN (${placeholders}))`,
      args: catIds,
    });
    // Delete product_images for parts in these categories
    await client.execute({
      sql: `DELETE FROM product_images WHERE part_id IN (SELECT id FROM parts WHERE category_id IN (${placeholders}))`,
      args: catIds,
    });
    // Delete parts in these categories
    await client.execute({
      sql: `DELETE FROM parts WHERE category_id IN (${placeholders})`,
      args: catIds,
    });
    // Delete categories
    await client.execute({
      sql: `DELETE FROM categories WHERE id IN (${placeholders})`,
      args: catIds,
    });
    console.log("Cleared old test parts and categories.");
  }

  // 2. Insert the fresh categories with designated images:
  // TEST1 = T-SHIRTS
  // TEST2 = HOODIES
  // TEST3 = JACKETS & PANTS
  const categories = [
    { name: "TEST1", desc: "Premium T-Shirts & Basics", img: "tshirt.jpg" },
    { name: "TEST2", desc: "Streetwear Hoodies & Fleece", img: "hoodie.jpg" },
    { name: "TEST3", desc: "Outerwear Jackets & Cargo Pants", img: "jackets_pants.jpg" },
  ];

  const catMap = new Map<string, number>();
  for (const c of categories) {
    const res = await client.execute({
      sql: "INSERT INTO categories (category_name, description, category_image, date_created) VALUES (?, ?, ?, ?)",
      args: [c.name, c.desc, c.img, now()],
    });
    catMap.set(c.name, Number(res.lastInsertRowid));
    console.log(`Created Category ${c.name} with ID ${res.lastInsertRowid}`);
  }

  // 3. Clothing Products Specifications
  const products = [
    // =========================================================================
    // CATEGORY: TEST1 (T-SHIRTS)
    // =========================================================================
    {
      cat: "TEST1",
      name: "Vintage Heavyweight Boxy Tee",
      brand: "Studio 7-10",
      style_code: "TSH-BOX",
      desc: "280 GSM combed cotton vintage wash tee with dropped shoulders and thick ribbed collar.",
      image: "tshirt.jpg",
      purchase_price: 10.0,
      selling_price: 32.0,
      price2: 28.0,
      price3: 25.0,
      min_stock: 4,
      unit: "pcs",
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
      variants: [
        { size: "S", color: "Washed Black", stock: 15, shelf: "T1", location: "Shelf A" },
        { size: "M", color: "Washed Black", stock: 25, shelf: "T1", location: "Shelf A" },
        { size: "L", color: "Washed Black", stock: 20, shelf: "T1", location: "Shelf A" },
        { size: "XL", color: "Washed Black", stock: 12, shelf: "T1", location: "Shelf A" },
        { size: "S", color: "Vintage White", stock: 18, shelf: "T2", location: "Shelf A" },
        { size: "M", color: "Vintage White", stock: 30, shelf: "T2", location: "Shelf A" },
        { size: "L", color: "Vintage White", stock: 22, shelf: "T2", location: "Shelf A" },
        { size: "XL", color: "Vintage White", stock: 10, shelf: "T2", location: "Shelf A" },
      ],
    },
    {
      cat: "TEST1",
      name: "Raw Edge Athletic Muscle Tee",
      brand: "Studio 7-10",
      style_code: "TSH-MUS",
      desc: "Lightweight breathable cotton jersey with distressed cut armholes for gym and casual wear.",
      image: "tshirt.jpg",
      purchase_price: 8.0,
      selling_price: 26.0,
      price2: 24.0,
      price3: 22.0,
      min_stock: 5,
      unit: "pcs",
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
      variants: [
        { size: "M", color: "Heather Grey", stock: 14, shelf: "T3", location: "Shelf B" },
        { size: "L", color: "Heather Grey", stock: 16, shelf: "T3", location: "Shelf B" },
        { size: "M", color: "Sage Green", stock: 3, shelf: "T3", location: "Shelf B" }, // Low stock scenario
        { size: "L", color: "Sage Green", stock: 2, shelf: "T3", location: "Shelf B" }, // Low stock scenario
      ],
    },
    {
      cat: "TEST1",
      name: "Archival Acid Wash Graphic Tee",
      brand: "Studio 7-10",
      style_code: "TSH-ARC",
      desc: "Limited run retro screenprint with distressed enzyme wash.",
      image: "tshirt.jpg",
      purchase_price: 12.0,
      selling_price: 42.0,
      price2: 38.0,
      price3: 35.0,
      min_stock: 5,
      unit: "pcs",
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
      variants: [
        { size: "L", color: "Charcoal Fade", stock: 0, shelf: "T4", location: "Front Display" }, // Out of stock scenario
        { size: "XL", color: "Charcoal Fade", stock: 0, shelf: "T4", location: "Front Display" }, // Out of stock scenario
      ],
    },

    // =========================================================================
    // CATEGORY: TEST2 (HOODIES)
    // =========================================================================
    {
      cat: "TEST2",
      name: "Signature 450GSM Pullover Hoodie",
      brand: "Studio 7-10",
      style_code: "HOD-SIG",
      desc: "Ultra heavyweight brushed French terry cotton with double-layer hood and ribbed side gussets.",
      image: "hoodie.jpg",
      purchase_price: 24.0,
      selling_price: 78.0,
      price2: 72.0,
      price3: 65.0,
      min_stock: 4,
      unit: "pcs",
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
      variants: [
        { size: "S", color: "Matte Black", stock: 12, shelf: "H1", location: "Rack 1" },
        { size: "M", color: "Matte Black", stock: 20, shelf: "H1", location: "Rack 1" },
        { size: "L", color: "Matte Black", stock: 16, shelf: "H1", location: "Rack 1" },
        { size: "XL", color: "Matte Black", stock: 9, shelf: "H1", location: "Rack 1" },
        { size: "S", color: "Warm Sand", stock: 14, shelf: "H2", location: "Rack 1" },
        { size: "M", color: "Warm Sand", stock: 18, shelf: "H2", location: "Rack 1" },
        { size: "L", color: "Warm Sand", stock: 15, shelf: "H2", location: "Rack 1" },
        { size: "XL", color: "Warm Sand", stock: 8, shelf: "H2", location: "Rack 1" },
      ],
    },
    {
      cat: "TEST2",
      name: "Quarter-Zip Thermal Fleece Pullover",
      brand: "Studio 7-10",
      style_code: "HOD-QZP",
      desc: "Plush microfleece with brass zipper and elastic cinch hem.",
      image: "hoodie.jpg",
      purchase_price: 20.0,
      selling_price: 68.0,
      price2: 62.0,
      price3: 58.0,
      min_stock: 4,
      unit: "pcs",
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
      variants: [
        { size: "M", color: "Forest Green", stock: 11, shelf: "H3", location: "Rack 2" },
        { size: "L", color: "Forest Green", stock: 14, shelf: "H3", location: "Rack 2" },
        { size: "M", color: "Oatmeal", stock: 3, shelf: "H3", location: "Rack 2" }, // Low stock scenario
      ],
    },
    {
      cat: "TEST2",
      name: "Exclusive Unreleased Chenille Zip Hoodie",
      brand: "Studio 7-10",
      style_code: "HOD-EXP",
      desc: "Unreleased luxury chenille embroidered patch hoodie (coming next season).",
      image: "hoodie.jpg",
      purchase_price: 30.0,
      selling_price: 98.0,
      price2: 90.0,
      price3: 85.0,
      min_stock: 5,
      unit: "pcs",
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 1, // Inactive / Draft scenario
      sell_by_weight: 0,
      status: "Inactive",
      item_type: "Product",
      variants: [
        { size: "L", color: "Midnight Navy", stock: 25, shelf: "H4", location: "Backroom Vault" },
      ],
    },

    // =========================================================================
    // CATEGORY: TEST3 (JACKETS & PANTS)
    // =========================================================================
    {
      cat: "TEST3",
      name: "MA-1 Flight Tech Bomber Jacket",
      brand: "Studio 7-10",
      style_code: "JKT-BMB",
      desc: "Water-resistant satin flight nylon with orange safety lining and utility arm sleeve pocket.",
      image: "jackets_pants.jpg",
      purchase_price: 45.0,
      selling_price: 135.0,
      price2: 125.0,
      price3: 115.0,
      min_stock: 3,
      unit: "pcs",
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
      variants: [
        { size: "S", color: "Military Olive", stock: 6, shelf: "J1", location: "Jacket Rail" },
        { size: "M", color: "Military Olive", stock: 12, shelf: "J1", location: "Jacket Rail" },
        { size: "L", color: "Military Olive", stock: 10, shelf: "J1", location: "Jacket Rail" },
        { size: "XL", color: "Military Olive", stock: 5, shelf: "J1", location: "Jacket Rail" },
        { size: "M", color: "Stealth Black", stock: 14, shelf: "J2", location: "Jacket Rail" },
        { size: "L", color: "Stealth Black", stock: 11, shelf: "J2", location: "Jacket Rail" },
      ],
    },
    {
      cat: "TEST3",
      name: "Relaxed Modular Cargo Trouser",
      brand: "Studio 7-10",
      style_code: "PNT-CRG",
      desc: "Durable ripstop cotton trousers with 6 ergonomic bellows pockets and adjustable ankle toggles.",
      image: "jackets_pants.jpg",
      purchase_price: 25.0,
      selling_price: 75.0,
      price2: 70.0,
      price3: 65.0,
      min_stock: 4,
      unit: "pcs",
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
      variants: [
        { size: "30", color: "Washed Black", stock: 10, shelf: "P1", location: "Pants Shelf" },
        { size: "32", color: "Washed Black", stock: 18, shelf: "P1", location: "Pants Shelf" },
        { size: "34", color: "Washed Black", stock: 15, shelf: "P1", location: "Pants Shelf" },
        { size: "36", color: "Washed Black", stock: 7, shelf: "P1", location: "Pants Shelf" },
        { size: "32", color: "Tactical Olive", stock: 12, shelf: "P2", location: "Pants Shelf" },
        { size: "34", color: "Tactical Olive", stock: 14, shelf: "P2", location: "Pants Shelf" },
      ],
    },
    {
      cat: "TEST3",
      name: "Custom Tailoring & Alteration Service",
      brand: "Studio 7-10 Atelier",
      style_code: "SRV-TLR",
      desc: "In-house precision pant hemming, sleeve shortening, and custom fitting.",
      image: "jackets_pants.jpg",
      purchase_price: 0.0,
      selling_price: 20.0,
      price2: 20.0,
      price3: 15.0,
      min_stock: 0,
      unit: "service",
      is_sales_item: 1,
      is_stock_tracked: 0,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Service", // Service / Labor scenario
      variants: [
        { size: "Standard Fit", color: "Custom", stock: 999, shelf: "-", location: "Alterations Room" },
      ],
    },
  ];

  let totalVariants = 0;

  for (const item of products) {
    const catId = catMap.get(item.cat)!;

    for (const v of item.variants) {
      const randomCode = Math.floor(100000 + Math.random() * 900000);
      const sku = `${item.style_code}-${v.size.replace(/[^A-Za-z0-9]/g, "")}-${v.color.slice(0, 3).toUpperCase()}-${randomCode}`;
      const barcode = `BC${Date.now().toString().slice(-8)}${randomCode.toString().slice(-4)}`;

      const partName = item.variants.length > 1
        ? `${item.name} - ${v.color} - ${v.size}`
        : item.name;

      const res = await client.execute({
        sql: `INSERT INTO parts (
          part_number, part_name, description, category_id,
          purchase_price, selling_price, quantity_in_stock, minimum_stock_level, reorder_quantity,
          location, shelf, barcode, status, date_added, item_type, unit_of_measure,
          is_sales_item, is_purchase_item, is_inactive, tax_rate, is_stock_tracked,
          sell_by_weight, price2, price3, brand, size, color, style_code, source_kind, part_image
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        )`,
        args: [
          sku,
          partName,
          item.desc,
          catId,
          item.purchase_price,
          item.selling_price,
          v.stock,
          item.min_stock,
          item.min_stock * 2,
          v.location,
          v.shelf,
          barcode,
          item.status,
          now(),
          item.item_type,
          item.unit,
          item.is_sales_item,
          1,
          item.is_inactive,
          0,
          item.is_stock_tracked,
          item.sell_by_weight,
          item.price2,
          item.price3,
          item.brand,
          v.size,
          v.color,
          item.style_code,
          "bought",
          item.image,
        ],
      });

      const partId = Number(res.lastInsertRowid);
      totalVariants++;

      // Also register into product_images table
      await client.execute({
        sql: `INSERT INTO product_images (part_id, image_path, sort_order) VALUES (?, ?, 0)`,
        args: [partId, item.image],
      });

      // Stock level in warehouse 3
      try {
        await client.execute({
          sql: `INSERT INTO stock_levels (part_id, warehouse_id, quantity, reorder_level) VALUES (?, 3, ?, ?)`,
          args: [partId, v.stock, item.min_stock],
        });
      } catch (err) {}
    }
  }

  console.log(`Successfully added ${totalVariants} clothing variants with photos across TEST1, TEST2, TEST3.`);

  const outboxRes = await client.execute("SELECT count(*) as c FROM _sync_outbox");
  console.log(`Outbox queue for cloud sync: ${outboxRes.rows[0].c}`);
}

main().catch(console.error);
