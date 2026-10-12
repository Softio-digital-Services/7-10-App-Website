import { createClient } from "@libsql/client";

const client = createClient({ url: "file:C:/Users/Baraa/AppData/Local/SevenTenInventory/Data/inventory.db" });

async function main() {
  await client.execute("PRAGMA busy_timeout = 10000;");

  const c1 = await client.execute("SELECT id FROM categories WHERE category_name = 'TEST1'");
  const c2 = await client.execute("SELECT id FROM categories WHERE category_name = 'TEST2'");
  const c3 = await client.execute("SELECT id FROM categories WHERE category_name = 'TEST3'");

  if (c1.rows.length) {
    await client.execute({
      sql: "UPDATE parts SET part_image = ? WHERE category_id = ?",
      args: ["6f7ee767c18a917e9e807aa57454756b.jpg", c1.rows[0].id],
    });
    await client.execute({
      sql: "UPDATE categories SET category_image = ? WHERE id = ?",
      args: ["6f7ee767c18a917e9e807aa57454756b.jpg", c1.rows[0].id],
    });
  }

  if (c2.rows.length) {
    await client.execute({
      sql: "UPDATE parts SET part_image = ? WHERE category_id = ?",
      args: ["b010f0a7f900fb58fac7a9719fe653d5.jpg", c2.rows[0].id],
    });
    await client.execute({
      sql: "UPDATE categories SET category_image = ? WHERE id = ?",
      args: ["b010f0a7f900fb58fac7a9719fe653d5.jpg", c2.rows[0].id],
    });
  }

  if (c3.rows.length) {
    await client.execute({
      sql: "UPDATE parts SET part_image = ? WHERE category_id = ?",
      args: ["301f5e534ba4d43b354f0957b233cb04.jpg", c3.rows[0].id],
    });
    await client.execute({
      sql: "UPDATE categories SET category_image = ? WHERE id = ?",
      args: ["301f5e534ba4d43b354f0957b233cb04.jpg", c3.rows[0].id],
    });
  }

  console.log("Updated desktop parts and categories with media photo names.");
}

main().catch(console.error);
