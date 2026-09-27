import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

/**
 * Applies prisma/migrations to a Turso (libSQL) or local SQLite database.
 * `prisma migrate deploy` cannot talk to Turso, so this is the free-hosting path.
 */
const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const client = /^(libsql|https?|wss?):\/\//.test(url)
  ? createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
  : createClient({ url });

const root = join(process.cwd(), "prisma", "migrations");
const names = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d{14}_/.test(e.name))
  .map((e) => e.name)
  .sort();

await client.executeMultiple(`
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  );
`);

const done = new Set(
  (await client.execute("SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL")).rows.map(
    (r) => String(r.migration_name),
  ),
);

let applied = 0;
for (const name of names) {
  if (done.has(name)) continue;
  const sql = readFileSync(join(root, name, "migration.sql"), "utf8").trim();
  if (!sql) continue;
  const checksum = createHash("sha256").update(sql).digest("hex");
  const id = createHash("sha256").update(name).digest("hex").slice(0, 32);
  console.log("applying", name);
  await client.executeMultiple(sql);
  await client.execute({
    sql: `INSERT INTO "_prisma_migrations"
          (id, checksum, finished_at, migration_name, applied_steps_count)
          VALUES (?, ?, CURRENT_TIMESTAMP, ?, 1)`,
    args: [id, checksum, name],
  });
  applied++;
}

console.log(applied === 0 ? "Database is up to date." : `Applied ${applied} migration(s).`);
