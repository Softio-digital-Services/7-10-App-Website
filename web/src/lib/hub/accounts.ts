import { prisma } from "@/lib/prisma";
import { applyChanges, hubState, type IncomingChange } from "@/lib/hub/store";

/**
 * Website customer accounts ⇄ the desktop app.
 *
 * The website writes the desktop tables `web_accounts` and `web_addresses` into the hub log as the pseudo-device
 * "website", so every laptop applies them like another laptop's change. Edits made on a laptop come back through
 * the exchange route and are applied here to User / Address. Accounts are deleted only by the customer.
 */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | Tx;

export const WEBSITE_DEVICE = "website";
export const ACCOUNT_TABLES = new Set(["web_accounts", "web_addresses"]);

const ACCT = "w-acct-";
const ADDR = "w-addr-";
const CUST = "w-cust-";

export const accountGid = (userId: string) => ACCT + userId;
const addressGid = (a: { id: string; hubGid: string | null }) => a.hubGid ?? ADDR + a.id;

/** Marks the account as changed so the next laptop sync sends it. */
export async function markAccountDirty(userId: string, db: Db = prisma) {
  await db.user.updateMany({ where: { id: userId }, data: { hubSyncedAt: null } });
}

async function nextClientSeq(tx: Tx) {
  const rows = await tx.$queryRawUnsafe<{ n: bigint | number | null }[]>(
    `SELECT MAX(clientSeq) AS n FROM "SyncChange" WHERE deviceId = ?`,
    WEBSITE_DEVICE,
  );
  return Number(rows[0]?.n ?? 0) + 1;
}

/** Stores website-made changes in the hub log; laptops pull them on their next sync. */
async function emit(tx: Tx, changes: Omit<IncomingChange, "n">[]) {
  if (changes.length === 0) return;
  let n = await nextClientSeq(tx);
  await applyChanges(tx, WEBSITE_DEVICE, changes.map((c) => ({ ...c, n: n++ })));
}

/**
 * The customer entry for this account. The website never sees the shop's customer list, so it always offers
 * its own entry (just this person's own details); the admin PC matches it to an existing customer by
 * email / phone when it takes it in.
 */
async function customerFor(
  tx: Tx,
  user: { id: string; name: string | null; email: string; phone: string | null },
  address: string,
  out: Omit<IncomingChange, "n">[],
) {
  const own = CUST + user.id;
  const mine = await tx.syncRow.findUnique({ where: { tbl_gid: { tbl: "customers", gid: own } }, select: { deleted: true } });
  if (mine && !mine.deleted) return own;

  // The admin PC may already have linked this account to one of its customers: keep that link.
  const prev = await tx.syncRow.findUnique({ where: { tbl_gid: { tbl: "web_accounts", gid: accountGid(user.id) } } });
  if (prev && !prev.deleted) {
    const linked = (JSON.parse(prev.data) as { customer_id?: unknown }).customer_id;
    if (typeof linked === "string" && linked) return linked;
  }

  out.push({
    t: "customers",
    g: own,
    o: "U",
    d: { full_name: user.name || user.email, phone: user.phone, email: user.email, address, type: "Online", status: "Active" },
  });
  return own;
}

/** Sends every account changed since the last sync (runs inside the exchange transaction). */
export async function pushAccounts(tx: Tx, limit = 200) {
  if ((await hubState(tx)) !== "ready") return 0;
  const users = await tx.user.findMany({
    where: { role: "CUSTOMER", hubSyncedAt: null },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      wishlist: { include: { product: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
    take: limit,
  });
  if (users.length === 0) return 0;

  const out: Omit<IncomingChange, "n">[] = [];
  for (const u of users) {
    const acct = accountGid(u.id);
    const main = u.addresses[0];
    const mainText = main ? [main.street, main.floor, main.city].filter(Boolean).join(", ") : "";
    const customer = await customerFor(tx, u, mainText, out);
    out.push({
      t: "web_accounts",
      g: acct,
      o: "U",
      d: {
        customer_id: customer,
        name: u.name,
        email: u.email,
        phone: u.phone,
        locale: u.locale,
        wa_updates: u.waUpdates ? 1 : 0,
        fit_height: u.fitHeight,
        fit_style: u.fitStyle,
        fit_tops: u.fitTops,
        fit_pants: u.fitPants,
        fit_hijab: u.fitHijab,
        wishlist: u.wishlist.map((w) => w.product.name).join(", "),
        created_at: u.createdAt.toISOString(),
        updated_at: u.updatedAt.toISOString(),
      },
    });

    const live = new Set<string>();
    for (const a of u.addresses) {
      const g = addressGid(a);
      live.add(g);
      out.push({
        t: "web_addresses",
        g,
        o: "U",
        d: {
          account_id: acct,
          label: a.label,
          name: a.name,
          phone: a.phone,
          region: a.region,
          city: a.city,
          street: a.street,
          floor: a.floor,
          landmark: a.landmark,
          is_default: a.isDefault ? 1 : 0,
        },
      });
    }
    // Addresses the customer removed since the last sync.
    const sent = await tx.$queryRawUnsafe<{ gid: string }[]>(
      `SELECT gid FROM "SyncRow" WHERE tbl = 'web_addresses' AND deleted = 0 AND json_extract(data, '$.account_id') = ?`,
      acct,
    );
    for (const s of sent) if (!live.has(s.gid)) out.push({ t: "web_addresses", g: s.gid, o: "D", d: {} });
  }

  await emit(tx, out);
  const now = new Date();
  await tx.user.updateMany({ where: { id: { in: users.map((u) => u.id) } }, data: { hubSyncedAt: now } });
  return users.length;
}

/** Removes a deleted account (and its addresses) from every laptop. The linked desktop customer stays. */
export async function emitAccountDeleted(userId: string) {
  if ((await hubState()) !== "ready") return;
  await prisma.$transaction(async (tx) => {
    const acct = accountGid(userId);
    const sent = await tx.$queryRawUnsafe<{ gid: string }[]>(
      `SELECT gid FROM "SyncRow" WHERE tbl = 'web_addresses' AND deleted = 0 AND json_extract(data, '$.account_id') = ?`,
      acct,
    );
    await emit(tx, [
      ...sent.map((s) => ({ t: "web_addresses", g: s.gid, o: "D" as const, d: {} })),
      { t: "web_accounts", g: acct, o: "D", d: {} },
    ]);
  });
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? null : String(v));
const bool = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";
const int = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && v !== null && v !== "" ? Math.round(n) : null;
};

/**
 * Applies edits a laptop made to web_accounts / web_addresses (runs inside the exchange transaction, after
 * the changes are stored). The website's own data stays the authority for email, password and role.
 */
export async function applyAccountChanges(tx: Tx, changes: IncomingChange[]) {
  let n = 0;
  for (const c of changes) {
    if (!ACCOUNT_TABLES.has(c.t)) continue;

    if (c.t === "web_accounts") {
      if (!c.g.startsWith(ACCT)) continue;
      const id = c.g.slice(ACCT.length);
      const user = await tx.user.findUnique({ where: { id }, select: { id: true, role: true } });
      if (!user || user.role !== "CUSTOMER") continue;
      if (c.o === "D") {
        // Only the customer can delete their account: send it back to the laptops.
        await markAccountDirty(id, tx);
        continue;
      }
      if (c.o !== "U") continue;
      const d = c.d as Record<string, unknown>;
      const style = str(d.fit_style);
      const locale = str(d.locale);
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...("name" in d ? { name: str(d.name) || null } : {}),
          ...("phone" in d ? { phone: str(d.phone) || null } : {}),
          ...("locale" in d ? { locale: locale === "ar" || locale === "en" ? locale : null } : {}),
          ...("wa_updates" in d ? { waUpdates: bool(d.wa_updates) } : {}),
          ...("fit_height" in d ? { fitHeight: int(d.fit_height) } : {}),
          ...("fit_style" in d ? { fitStyle: style === "Loose" || style === "Relaxed" || style === "Regular" ? style : null } : {}),
          ...("fit_tops" in d ? { fitTops: str(d.fit_tops) || null } : {}),
          ...("fit_pants" in d ? { fitPants: str(d.fit_pants) || null } : {}),
          ...("fit_hijab" in d ? { fitHijab: str(d.fit_hijab) || null } : {}),
        },
        select: { updatedAt: true },
      });
      // Already identical on every laptop: don't send it back.
      await tx.user.update({ where: { id }, data: { hubSyncedAt: updated.updatedAt } });
      n++;
      continue;
    }

    // web_addresses
    const existing = await tx.address.findFirst({
      where: c.g.startsWith(ADDR) ? { OR: [{ id: c.g.slice(ADDR.length) }, { hubGid: c.g }] } : { hubGid: c.g },
    });
    if (c.o === "D") {
      if (existing) {
        await tx.address.delete({ where: { id: existing.id } });
        if (existing.isDefault) {
          const next = await tx.address.findFirst({ where: { userId: existing.userId }, orderBy: { createdAt: "asc" } });
          if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
        }
        n++;
      }
      continue;
    }
    if (c.o !== "U") continue;
    const d = c.d as Record<string, unknown>;
    const acct = str(d.account_id);
    const userId = existing?.userId ?? (acct?.startsWith(ACCT) ? acct.slice(ACCT.length) : null);
    if (!userId || !(await tx.user.findUnique({ where: { id: userId }, select: { id: true } }))) continue;
    const isDefault = bool(d.is_default);
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    const data = {
      label: str(d.label) || "Home",
      name: str(d.name) ?? "",
      phone: str(d.phone) ?? "",
      region: str(d.region) ?? "",
      city: str(d.city) ?? "",
      street: str(d.street) ?? "",
      floor: str(d.floor) ?? "",
      landmark: str(d.landmark) ?? "",
      isDefault,
    };
    if (existing) await tx.address.update({ where: { id: existing.id }, data });
    else {
      const first = (await tx.address.count({ where: { userId } })) === 0;
      await tx.address.create({ data: { ...data, isDefault: isDefault || first, userId, hubGid: c.g } });
    }
    n++;
  }
  return n;
}
