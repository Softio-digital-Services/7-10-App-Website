import { createClient } from "@libsql/client";

const client = createClient({ url: "file:prisma/dev.db" });

async function update() {
  const tCat = await client.execute("SELECT id FROM Category WHERE name = 'TEST1'");
  const hCat = await client.execute("SELECT id FROM Category WHERE name = 'TEST2'");
  const jCat = await client.execute("SELECT id FROM Category WHERE name = 'TEST3'");

  if (tCat.rows.length) {
    await client.execute({
      sql: "UPDATE Product SET images = ? WHERE categoryId = ? AND active = 1",
      args: [JSON.stringify(["/media/tshirt.jpg"]), tCat.rows[0].id],
    });
  }

  if (hCat.rows.length) {
    await client.execute({
      sql: "UPDATE Product SET images = ? WHERE categoryId = ? AND active = 1",
      args: [JSON.stringify(["/media/hoodie.jpg"]), hCat.rows[0].id],
    });
  }

  if (jCat.rows.length) {
    await client.execute({
      sql: "UPDATE Product SET images = ? WHERE categoryId = ? AND active = 1",
      args: [JSON.stringify(["/media/jackets_pants.jpg"]), jCat.rows[0].id],
    });
  }

  const prods = await client.execute(
    "SELECT p.name, p.images, c.name as category FROM Product p JOIN Category c ON p.categoryId = c.id WHERE c.name IN ('TEST1', 'TEST2', 'TEST3') AND p.active = 1"
  );
  console.table(prods.rows);
}

update().catch(console.error);
