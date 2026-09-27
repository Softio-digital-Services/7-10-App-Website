import { authDevice } from "@/lib/hub/auth";
import { snapshotHead, snapshotRows } from "@/lib/hub/store";

const PAGE = 1000;

/**
 * Full copy of the shop's data for a laptop that is joining (or re-joining after a long time offline).
 * Page 1 (no `t`) also carries the log position and the counter totals; rows are paged by (table, id).
 */
export async function GET(request: Request) {
  const auth = await authDevice(request);
  if (auth.error) return auth.error;

  const params = new URL(request.url).searchParams;
  const afterTbl = params.get("t") ?? "";
  const afterGid = params.get("g") ?? "";

  const parts: string[] = [];
  if (!afterTbl) {
    const { head, counters } = await snapshotHead();
    parts.push(`"head":${head}`);
    parts.push(`"counters":${JSON.stringify(counters.map((c) => ({ t: c.tbl, g: c.gid, c: c.col, v: c.value })))}`);
  }

  const rows = await snapshotRows(afterTbl, afterGid, PAGE);
  parts.push(`"rows":[${rows.map((r) => `{"t":${JSON.stringify(r.tbl)},"g":${JSON.stringify(r.gid)},"d":${r.data}}`).join(",")}]`);
  const last = rows.at(-1);
  parts.push(`"next":${rows.length === PAGE && last ? JSON.stringify({ t: last.tbl, g: last.gid }) : "null"}`);

  return new Response(`{${parts.join(",")}}`, { headers: { "Content-Type": "application/json" } });
}
