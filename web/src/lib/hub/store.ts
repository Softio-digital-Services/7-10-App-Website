import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** Hub lifecycle: empty → founding (first laptop uploading its data) → ready (other laptops may join). */
export type HubState = "empty" | "founding" | "ready";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | Tx;

export async function getMeta(key: string, db: Db = prisma) {
  const row = await db.syncMeta.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string, db: Db = prisma) {
  await db.syncMeta.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function hubState(db: Db = prisma): Promise<HubState> {
  const state = await getMeta("state", db);
  return state === "founding" || state === "ready" ? state : "empty";
}

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const changeSchema = z.object({
  /** laptop outbox number */
  n: z.number().int().positive(),
  t: z.string().regex(/^[a-z_]{1,48}$/),
  g: z.string().min(3).max(96),
  o: z.enum(["U", "D", "C"]),
  d: z.record(z.string().max(64), z.union([scalar, z.object({ $enc: z.string() }), z.object({ $b64: z.string() })])).default({}),
});

export type IncomingChange = z.infer<typeof changeSchema>;

/** Highest seq ever issued; sqlite_sequence survives pruning, MAX(seq) wouldn't. */
async function head(db: Db) {
  const rows = await db.$queryRawUnsafe<{ seq: bigint | number | null }[]>(
    `SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'SyncChange'), 0) AS seq`,
  );
  return Number(rows[0]?.seq ?? 0);
}

export async function currentHead() {
  return head(prisma);
}

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Appends a laptop's changes to the log and folds them into the current row state and counter totals.
 * Retried pushes are harmless: (device, outbox number) is unique, so a change is only ever counted once.
 */
export async function applyChanges(tx: Tx, deviceId: string, changes: IncomingChange[]) {
  if (changes.length === 0) return { accepted: [] as IncomingChange[], head: await head(tx) };

  const seen = new Set<number>();
  for (const part of chunk(changes, 400)) {
    const marks = part.map(() => "?").join(",");
    const rows = await tx.$queryRawUnsafe<{ clientSeq: bigint | number }[]>(
      `SELECT clientSeq FROM "SyncChange" WHERE deviceId = ? AND clientSeq IN (${marks})`,
      deviceId,
      ...part.map((c) => c.n),
    );
    for (const r of rows) seen.add(Number(r.clientSeq));
  }

  const accepted: IncomingChange[] = [];
  for (const c of changes) {
    if (seen.has(c.n)) continue;
    seen.add(c.n);
    accepted.push(c);
  }
  if (accepted.length === 0) return { accepted, head: await head(tx) };

  const now = Date.now();
  for (const part of chunk(accepted, 150)) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "SyncChange" (deviceId, clientSeq, tbl, gid, op, data, at) VALUES ${part.map(() => "(?,?,?,?,?,?,?)").join(",")}`,
      ...part.flatMap((c) => [deviceId, c.n, c.t, c.g, c.o, JSON.stringify(c.d), now]),
    );
  }
  const newHead = await head(tx);

  const rowState = new Map<string, { tbl: string; gid: string; data: string; deleted: boolean }>();
  const counters = new Map<string, { tbl: string; gid: string; col: string; value: number }>();
  for (const c of accepted) {
    const key = `${c.t}\u0000${c.g}`;
    if (c.o === "U") rowState.set(key, { tbl: c.t, gid: c.g, data: JSON.stringify(c.d), deleted: false });
    else if (c.o === "D") rowState.set(key, { tbl: c.t, gid: c.g, data: "{}", deleted: true });
    else {
      for (const [col, raw] of Object.entries(c.d)) {
        const delta = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(delta) || delta === 0) continue;
        const ck = `${key}\u0000${col}`;
        const cur = counters.get(ck) ?? { tbl: c.t, gid: c.g, col, value: 0 };
        cur.value += delta;
        counters.set(ck, cur);
      }
    }
  }

  for (const part of chunk([...rowState.values()], 150)) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "SyncRow" (tbl, gid, data, deleted, seq) VALUES ${part.map(() => "(?,?,?,?,?)").join(",")}
       ON CONFLICT(tbl, gid) DO UPDATE SET
         data = CASE WHEN excluded.deleted = 1 THEN "SyncRow".data ELSE excluded.data END,
         deleted = excluded.deleted,
         seq = excluded.seq`,
      ...part.flatMap((r) => [r.tbl, r.gid, r.data, r.deleted ? 1 : 0, newHead]),
    );
  }

  for (const part of chunk([...counters.values()], 200)) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "SyncCounter" (tbl, gid, col, value) VALUES ${part.map(() => "(?,?,?,?)").join(",")}
       ON CONFLICT(tbl, gid, col) DO UPDATE SET value = "SyncCounter".value + excluded.value`,
      ...part.flatMap((c) => [c.tbl, c.gid, c.col, c.value]),
    );
  }

  return { accepted, head: newHead };
}

type LogRow = { seq: bigint | number; deviceId: string; tbl: string; gid: string; op: string; data: string };

/**
 * Changes after `after`, minus the caller's own. Returned as pre-serialised JSON fragments
 * (the stored payloads are already JSON) so large pulls don't pay for a parse/stringify round trip.
 */
export async function readChanges(deviceId: string, after: number, limit: number) {
  const rows = await prisma.$queryRawUnsafe<LogRow[]>(
    `SELECT seq, deviceId, tbl, gid, op, data FROM "SyncChange" WHERE seq > ? ORDER BY seq LIMIT ?`,
    after,
    limit,
  );
  const items: string[] = [];
  let cursor = after;
  for (const r of rows) {
    cursor = Number(r.seq);
    if (r.deviceId === deviceId) continue;
    items.push(`{"s":${cursor},"t":${JSON.stringify(r.tbl)},"g":${JSON.stringify(r.gid)},"o":"${r.op}","d":${r.data}}`);
  }
  return { items, cursor, more: rows.length === limit };
}

/** First page of a join: the log position and every counter total, read together so they agree. */
export async function snapshotHead() {
  return prisma.$transaction(async (tx) => {
    const at = await head(tx);
    const counters = await tx.syncCounter.findMany();
    return { head: at, counters };
  });
}

export async function snapshotRows(afterTbl: string, afterGid: string, limit: number) {
  return prisma.$queryRawUnsafe<{ tbl: string; gid: string; data: string }[]>(
    `SELECT tbl, gid, data FROM "SyncRow" WHERE deleted = 0 AND (tbl > ? OR (tbl = ? AND gid > ?)) ORDER BY tbl, gid LIMIT ?`,
    afterTbl,
    afterTbl,
    afterGid,
    limit,
  );
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Drops log entries every active laptop has already applied (kept at least 14 days).
 * Laptops silent for 45+ days don't hold the log back; they re-download a snapshot when they return.
 */
export async function pruneLog() {
  const activeSince = new Date(Date.now() - 45 * DAY);
  const devices = await prisma.syncDevice.findMany({
    where: { revokedAt: null, lastSeenAt: { gte: activeSince } },
    select: { cursor: true },
  });
  if (devices.length === 0) return 0;
  const safe = Math.min(...devices.map((d) => d.cursor));
  const rows = await prisma.$queryRawUnsafe<{ seq: bigint | number | null }[]>(
    `SELECT MAX(seq) AS seq FROM "SyncChange" WHERE seq <= ? AND at < ?`,
    safe,
    Date.now() - 14 * DAY,
  );
  const through = Number(rows[0]?.seq ?? 0);
  if (through <= 0) return 0;
  const removed = await prisma.$executeRawUnsafe(`DELETE FROM "SyncChange" WHERE seq <= ?`, through);
  const prev = Number((await getMeta("pruned_through")) ?? 0);
  if (through > prev) await setMeta("pruned_through", String(through));
  return removed;
}

export async function prunedThrough() {
  return Number((await getMeta("pruned_through")) ?? 0);
}
