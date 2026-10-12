import { createClient } from "@libsql/client";

const dbPath = "file:C:/Users/Baraa/AppData/Local/SevenTenInventory/Data/inventory.db";
const client = createClient({ url: dbPath });

const now = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

async function seed() {
  console.log("Seeding products and categories into SevenTen desktop inventory...");
  await client.execute("PRAGMA busy_timeout = 10000;");

  // 1. Categories TEST1, TEST2, TEST3
  const categories = [
    { name: "TEST1", desc: "Test Category 1 - Apparel & Activewear" },
    { name: "TEST2", desc: "Test Category 2 - Footwear & Accessories" },
    { name: "TEST3", desc: "Test Category 3 - Premium Hardware & Tools" },
  ];

  const catMap = new Map<string, number>();

  for (const cat of categories) {
    const existing = await client.execute({
      sql: "SELECT id FROM categories WHERE category_name = ?",
      args: [cat.name],
    });

    if (existing.rows.length > 0) {
      catMap.set(cat.name, Number(existing.rows[0].id));
      console.log(`Category ${cat.name} already exists with id ${existing.rows[0].id}`);
    } else {
      const res = await client.execute({
        sql: "INSERT INTO categories (category_name, description, date_created) VALUES (?, ?, ?)",
        args: [cat.name, cat.desc, now()],
      });
      const id = Number(res.lastInsertRowid);
      catMap.set(cat.name, id);
      console.log(`Created Category ${cat.name} with id ${id}`);
    }
  }

  // 2. Comprehensive Scenarios per Category
  // We want to test every scenario:
  // - Multi-variant product (multiple sizes, multiple colors)
  // - Single-variant product (standard item)
  // - High stock product
  // - Low stock / Reorder warning scenario
  // - Out of stock (0 stock)
  // - Discount / Sale tier pricing (price2, price3)
  // - Weight-based selling (sell_by_weight = 1)
  // - Inactive / draft product (is_inactive = 1)
  // - Non-sales service item (item_type = 'Service', is_sales_item = 0)

  const items = [
    // ================= CATEGORY TEST1 (Apparel & Activewear) =================
    // Scenario 1: Multi-variant apparel with sizes & colors (Active, High Stock)
    {
      cat: "TEST1",
      name: "Performance Oversized Hoodie",
      brand: "AeroWear",
      style_code: "HOOD-01",
      desc: "Heavyweight 450GSM cotton hoodie with dropped shoulders and kangaroo pocket.",
      unit: "pcs",
      purchase_price: 22.0,
      selling_price: 65.0,
      price2: 60.0,
      price3: 55.0,
      min_stock: 5,
      variants: [
        { size: "S", color: "Obsidian Black", stock: 15, shelf: "A1", location: "Warehouse A" },
        { size: "M", color: "Obsidian Black", stock: 24, shelf: "A1", location: "Warehouse A" },
        { size: "L", color: "Obsidian Black", stock: 18, shelf: "A1", location: "Warehouse A" },
        { size: "XL", color: "Obsidian Black", stock: 8, shelf: "A1", location: "Warehouse A" },
        { size: "M", color: "Heather Grey", stock: 20, shelf: "A2", location: "Warehouse A" },
        { size: "L", color: "Heather Grey", stock: 12, shelf: "A2", location: "Warehouse A" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
    },
    // Scenario 2: Low Stock Warning Item
    {
      cat: "TEST1",
      name: "Seamless Training Ribbed Tank",
      brand: "AeroWear",
      style_code: "TANK-02",
      desc: "Breathable seamless ribbed knit athletic tank top.",
      unit: "pcs",
      purchase_price: 9.5,
      selling_price: 28.0,
      price2: 25.0,
      price3: 22.0,
      min_stock: 10,
      variants: [
        { size: "S", color: "Sage Green", stock: 2, shelf: "A3", location: "Front Store" },
        { size: "M", color: "Sage Green", stock: 3, shelf: "A3", location: "Front Store" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
    },
    // Scenario 3: Out of Stock (0 quantity)
    {
      cat: "TEST1",
      name: "Limited Edition Vintage Track Jacket",
      brand: "RetroClub",
      style_code: "JACK-03",
      desc: "Colorblocked retro nylon track jacket with embroidered vintage crest.",
      unit: "pcs",
      purchase_price: 35.0,
      selling_price: 95.0,
      price2: 90.0,
      price3: 85.0,
      min_stock: 5,
      variants: [
        { size: "L", color: "Navy / Red", stock: 0, shelf: "A4", location: "Backroom" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
    },
    // Scenario 4: Inactive / Draft item (should be filtered out on storefront)
    {
      cat: "TEST1",
      name: "Upcoming Season Thermal Compression Leggings",
      brand: "AeroWear",
      style_code: "COMP-04",
      desc: "Unreleased winter thermal compression tights.",
      unit: "pcs",
      purchase_price: 15.0,
      selling_price: 45.0,
      price2: 40.0,
      price3: 38.0,
      min_stock: 5,
      variants: [
        { size: "M", color: "Charcoal", stock: 30, shelf: "A5", location: "Storage" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 1,
      sell_by_weight: 0,
      status: "Inactive",
      item_type: "Product",
    },

    // ================= CATEGORY TEST2 (Footwear & Accessories) =================
    // Scenario 5: Footwear with numbered shoe sizes
    {
      cat: "TEST2",
      name: "Apex Cushion Cloud Runners",
      brand: "StrideLab",
      style_code: "RUN-01",
      desc: "Responsive high-rebound daily running sneaker with carbon plate stabilization.",
      unit: "pair",
      purchase_price: 48.0,
      selling_price: 130.0,
      price2: 120.0,
      price3: 110.0,
      min_stock: 4,
      variants: [
        { size: "40", color: "Triple White", stock: 8, shelf: "B1", location: "Shoe Rack" },
        { size: "41", color: "Triple White", stock: 12, shelf: "B1", location: "Shoe Rack" },
        { size: "42", color: "Triple White", stock: 15, shelf: "B1", location: "Shoe Rack" },
        { size: "43", color: "Triple White", stock: 10, shelf: "B1", location: "Shoe Rack" },
        { size: "44", color: "Triple White", stock: 6, shelf: "B1", location: "Shoe Rack" },
        { size: "42", color: "Neon Stealth", stock: 9, shelf: "B2", location: "Shoe Rack" },
        { size: "43", color: "Neon Stealth", stock: 7, shelf: "B2", location: "Shoe Rack" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
    },
    // Scenario 6: Single-variant accessory (One Size, Multiple Colors)
    {
      cat: "TEST2",
      name: "Waterproof Cordura Crossbody Bag",
      brand: "UrbanKit",
      style_code: "BAG-02",
      desc: "Weatherproof 3L sling crossbody bag with Fidlock magnetic buckle.",
      unit: "pcs",
      purchase_price: 14.0,
      selling_price: 39.0,
      price2: 35.0,
      price3: 32.0,
      min_stock: 6,
      variants: [
        { size: "OneSize", color: "Matte Black", stock: 25, shelf: "B3", location: "Front Display" },
        { size: "OneSize", color: "Coyote Tan", stock: 14, shelf: "B3", location: "Front Display" },
        { size: "OneSize", color: "Olive Drab", stock: 18, shelf: "B3", location: "Front Display" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
    },
    // Scenario 7: High volume small accessories (Sunglasses / Socks)
    {
      cat: "TEST2",
      name: "Polarized UV400 Matte Sunglasses",
      brand: "ShadeCraft",
      style_code: "SUN-03",
      desc: "Ultra lightweight TR90 memory frame with TAC polarized anti-glare lenses.",
      unit: "pcs",
      purchase_price: 6.5,
      selling_price: 24.0,
      price2: 20.0,
      price3: 18.0,
      min_stock: 5,
      variants: [
        { size: "Standard", color: "Smoke Black", stock: 40, shelf: "B4", location: "Counter" },
        { size: "Standard", color: "Amber Tortoise", stock: 28, shelf: "B4", location: "Counter" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
    },

    // ================= CATEGORY TEST3 (Premium Hardware & Tools) =================
    // Scenario 8: Heavy tool / Hardware sold by item
    {
      cat: "TEST3",
      name: "Brushless 20V Cordless Impact Driver Kit",
      brand: "ProTorque",
      style_code: "TOOL-01",
      desc: "220Nm maximum torque brushless motor with two 4.0Ah lithium battery packs and rapid charger.",
      unit: "set",
      purchase_price: 85.0,
      selling_price: 175.0,
      price2: 165.0,
      price3: 155.0,
      min_stock: 3,
      variants: [
        { size: "Standard Kit", color: "Industrial Teal", stock: 11, shelf: "C1", location: "Tool Bay" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Product",
    },
    // Scenario 9: Bulk Raw Material Sold By Weight (sell_by_weight = 1)
    {
      cat: "TEST3",
      name: "High-Tensile Galvanized Steel Fasteners (Bulk)",
      brand: "BoltMaster",
      style_code: "RAW-02",
      desc: "Grade 8.8 hex bolts and washers sold bulk by weight per kilogram.",
      unit: "kg",
      purchase_price: 3.2,
      selling_price: 8.5,
      price2: 7.8,
      price3: 7.0,
      min_stock: 25,
      variants: [
        { size: "M8x40", color: "Zinc Plated", stock: 120, shelf: "C2", location: "Bulk Bin 4" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 1,
      is_inactive: 0,
      sell_by_weight: 1,
      status: "Active",
      item_type: "Product",
    },
    // Scenario 10: Service item / Calibration & Repair (item_type = 'Service', non-stock)
    {
      cat: "TEST3",
      name: "Tool Precision Calibration & Service",
      brand: "ProTorque Care",
      style_code: "SRV-03",
      desc: "Certified torque calibration, ultrasonic internal cleaning, and safety certification.",
      unit: "service",
      purchase_price: 0.0,
      selling_price: 45.0,
      price2: 45.0,
      price3: 40.0,
      min_stock: 0,
      variants: [
        { size: "Standard Service", color: "N/A", stock: 999, shelf: "-", location: "Service Desk" },
      ],
      is_sales_item: 1,
      is_stock_tracked: 0,
      is_inactive: 0,
      sell_by_weight: 0,
      status: "Active",
      item_type: "Service",
    },
  ];

  let insertedCount = 0;

  for (const item of items) {
    const catId = catMap.get(item.cat)!;

    for (const v of item.variants) {
      // Build a unique part_number / barcode
      const randomCode = Math.floor(100000 + Math.random() * 900000);
      const sku = `${item.style_code}-${v.size.replace(/[^A-Za-z0-9]/g, "")}-${v.color.slice(0, 3).toUpperCase()}-${randomCode}`;
      const barcode = `BC${Date.now().toString().slice(-8)}${randomCode.toString().slice(-4)}`;

      // Distinct variant part name
      const partName = item.variants.length > 1
        ? `${item.name} - ${v.color} - ${v.size}`
        : item.name;

      const dateAdded = now();

      const insertRes = await client.execute({
        sql: `INSERT INTO parts (
          part_number, part_name, description, category_id,
          purchase_price, selling_price, quantity_in_stock, minimum_stock_level, reorder_quantity,
          location, shelf, barcode, status, date_added, item_type, unit_of_measure,
          is_sales_item, is_purchase_item, is_inactive, tax_rate, is_stock_tracked,
          sell_by_weight, price2, price3, brand, size, color, style_code, source_kind
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?
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
          dateAdded,
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
        ],
      });

      const partId = Number(insertRes.lastInsertRowid);
      insertedCount++;

      // Also create stock_level in main warehouse (id 3)
      try {
        await client.execute({
          sql: `INSERT INTO stock_levels (part_id, warehouse_id, quantity, reorder_level) VALUES (?, 3, ?, ?)`,
          args: [partId, v.stock, item.min_stock],
        });
      } catch (err) {
        // Warehouse 3 might not exist or already set
      }
    }
  }

  console.log(`\nSuccessfully inserted ${insertedCount} part variants across categories TEST1, TEST2, TEST3.`);

  // Check outbox
  const outboxRes = await client.execute("SELECT count(*) as c FROM _sync_outbox");
  console.log(`_sync_outbox entries queued for cloud sync: ${outboxRes.rows[0].c}`);
}

seed().catch(console.error);
