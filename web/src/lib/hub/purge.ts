import type { PrismaClient } from "@prisma/client";
import { PUBLISHED_TABLES, WEBSITE_TABLES, allowedData } from "@/lib/hub/scope";

type Db = Pick<PrismaClient, "$executeRawUnsafe" | "$queryRawUnsafe">;

/** Tables whose stored rows may carry columns older versions sent (cost, supplier...): scrubbed in place. */
const SCRUBBED = ["parts", "categories", "product_images"];

/**
 * Removes everything that is not website data from the hub store: business tables stored by older versions
 * (sales, costs, expenses, suppliers, staff, the shop's customer list...), stock counters, and their log.
 * Catalogue rows that are kept lose any private columns (e.g. cost, supplier).
 * With `catalogue`, the published catalogue goes too (the admin PC republishes it after re-linking).
 * Website accounts, addresses and the customer entries the website created for them are kept.
 */
export async function purgeNonWebsiteData(db: Db, opts: { catalogue?: boolean } = {}) {
  const keep = [...WEBSITE_TABLES, ...(opts.catalogue ? [] : [...PUBLISHED_TABLES])];
  const marks = keep.map(() => "?").join(",");
  // Customer rows are kept only when the website created them (gid prefix "w-cust-"); the shop's own list goes.
  const outside = `tbl NOT IN (${marks}) OR (tbl = 'customers' AND gid NOT LIKE 'w-cust-%')`;
  const rows = await db.$executeRawUnsafe(`DELETE FROM "SyncRow" WHERE ${outside}`, ...keep);
  const log = await db.$executeRawUnsafe(`DELETE FROM "SyncChange" WHERE ${outside}`, ...keep);
  const counters = await db.$executeRawUnsafe(`DELETE FROM "SyncCounter"`);

  let scrubbed = 0;
  if (!opts.catalogue) {
    for (const table of ["SyncRow", "SyncChange"] as const) {
      const key = table === "SyncRow" ? "gid" : "seq";
      const found = await db.$queryRawUnsafe<{ id: string | number | bigint; tbl: string; data: string }[]>(
        `SELECT ${key} AS id, tbl, data FROM "${table}" WHERE tbl IN (${SCRUBBED.map(() => "?").join(",")})`,
        ...SCRUBBED,
      );
      for (const r of found) {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(r.data);
        } catch {
          continue;
        }
        const clean = JSON.stringify(allowedData(r.tbl, data));
        if (clean === r.data) continue;
        await db.$executeRawUnsafe(`UPDATE "${table}" SET data = ? WHERE ${key} = ? AND tbl = ?`, clean, String(r.id), r.tbl);
        scrubbed++;
      }
    }
  }

  // Cost prices must not be on the website either
  await db.$executeRawUnsafe(`UPDATE "Product" SET cost = 0 WHERE cost <> 0`);
  return { rows, log, counters, scrubbed };
}
