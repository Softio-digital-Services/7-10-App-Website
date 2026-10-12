import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@libsql/client";

const webClient = createClient({ url: "file:prisma/dev.db" });
const desktopClient = createClient({ url: "file:C:/Users/Baraa/AppData/Local/SevenTenInventory/Data/inventory.db" });

// High-resolution distinct fashion apparel imagery from Unsplash CDN
const distinctImages = [
  // TEST1 (T-SHIRTS)
  {
    productName: "Vintage Heavyweight Boxy Tee",
    color: "Washed Black",
    url: "https://images.unsplash.com/photo-1618517351616-38fb9c5210c6?auto=format&fit=crop&w=800&q=80",
    filename: "tshirt_washed_black.jpg"
  },
  {
    productName: "Vintage Heavyweight Boxy Tee",
    color: "Vintage White",
    url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    filename: "tshirt_vintage_white.jpg"
  },
  {
    productName: "Raw Edge Athletic Muscle Tee",
    color: "Heather Grey",
    url: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80",
    filename: "tshirt_heather_grey.jpg"
  },
  {
    productName: "Raw Edge Athletic Muscle Tee",
    color: "Sage Green",
    url: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80",
    filename: "tshirt_sage_green.jpg"
  },
  {
    productName: "Archival Acid Wash Graphic Tee",
    color: "Charcoal Fade",
    url: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=800&q=80",
    filename: "tshirt_graphic_acid.jpg"
  },

  // TEST2 (HOODIES)
  {
    productName: "Signature 450GSM Pullover Hoodie",
    color: "Matte Black",
    url: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80",
    filename: "hoodie_matte_black.jpg"
  },
  {
    productName: "Signature 450GSM Pullover Hoodie",
    color: "Warm Sand",
    url: "https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=800&q=80",
    filename: "hoodie_warm_sand.jpg"
  },
  {
    productName: "Quarter-Zip Thermal Fleece Pullover",
    color: "Forest Green",
    url: "https://images.unsplash.com/photo-1614975059251-992f11792b9f?auto=format&fit=crop&w=800&q=80",
    filename: "fleece_forest_green.jpg"
  },
  {
    productName: "Quarter-Zip Thermal Fleece Pullover",
    color: "Oatmeal",
    url: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80",
    filename: "fleece_oatmeal.jpg"
  },

  // TEST3 (JACKETS & PANTS)
  {
    productName: "MA-1 Flight Tech Bomber Jacket",
    color: "Military Olive",
    url: "https://images.unsplash.com/photo-1548883354-94bcfe321cbb?auto=format&fit=crop&w=800&q=80",
    filename: "jacket_bomber_olive.jpg"
  },
  {
    productName: "MA-1 Flight Tech Bomber Jacket",
    color: "Stealth Black",
    url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80",
    filename: "jacket_bomber_black.jpg"
  },
  {
    productName: "Relaxed Modular Cargo Trouser",
    color: "Washed Black",
    url: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80",
    filename: "pants_cargo_black.jpg"
  },
  {
    productName: "Relaxed Modular Cargo Trouser",
    color: "Tactical Olive",
    url: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=80",
    filename: "pants_cargo_olive.jpg"
  }
];

async function run() {
  console.log("Downloading and assigning distinct high-quality clothing photos...");

  const desktopAssetDir = path.resolve("..", "desktop", "Assets");
  const desktopDistDir = path.resolve("..", "desktop", "dist", "app", "Assets");
  const desktopWwwDir = path.resolve("..", "desktop", "wwwroot", "Assets");
  const desktopUserDir = path.join(process.env.LOCALAPPDATA || "", "SevenTenInventory", "Product_Images");
  const publicMediaDir = path.resolve("public", "media");

  [desktopAssetDir, desktopDistDir, desktopWwwDir, desktopUserDir, publicMediaDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  await desktopClient.execute("PRAGMA busy_timeout = 10000;");

  for (const item of distinctImages) {
    console.log(`Processing photo for ${item.productName} (${item.color})...`);
    const res = await fetch(item.url);
    if (!res.ok) {
      console.warn(`Failed to download ${item.url}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32) + ".jpg";

    // 1. Save locally to all desktop asset locations
    [desktopAssetDir, desktopDistDir, desktopWwwDir, desktopUserDir, publicMediaDir].forEach(d => {
      fs.writeFileSync(path.join(d, item.filename), buf);
      fs.writeFileSync(path.join(d, hash), buf);
    });

    // 2. Insert into website MediaFile
    await webClient.execute({
      sql: "INSERT INTO MediaFile (name, contentType, size, data, createdAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET size = ?, data = ?",
      args: [hash, "image/jpeg", buf.length, buf, buf.length, buf]
    });

    // 3. Update Web Product Table for matching product and color
    await webClient.execute({
      sql: `UPDATE Product 
            SET imageUrl = ?, images = ? 
            WHERE name = ? AND (colorName = ? OR colorName IS NULL)`,
      args: [`/media/${hash}`, JSON.stringify([`/media/${hash}`]), item.productName, item.color]
    });

    // 4. Update Desktop parts table
    await desktopClient.execute({
      sql: `UPDATE parts 
            SET part_image = ? 
            WHERE part_name LIKE ? AND color = ?`,
      args: [hash, `%${item.productName}%`, item.color]
    });

    console.log(`  ✓ Updated: /media/${hash}`);
  }

  console.log("\nFinished assigning distinct, random photos to all clothing products!");
}

run().catch(console.error);
