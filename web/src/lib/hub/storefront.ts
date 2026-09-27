import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { isMediaName, missingMedia } from "@/lib/hub/media";
import { reservedByExternalId } from "@/lib/hub/web-orders";

export const PLACEHOLDER_IMAGE = "/brand/placeholder.svg";
export const PART_PREFIX = "part-";

type Row = Record<string, unknown>;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const flag = (v: unknown, fallback: boolean) => (v === null || v === undefined || v === "" ? fallback : num(v) === 1);

function sellable(p: Row) {
  if (str(p.date_deleted)) return false;
  if (flag(p.is_inactive, false)) return false;
  if (!flag(p.is_sales_item, true)) return false;
  if (str(p.item_type).toLowerCase() === "service") return false;
  if (["inactive", "deleted", "archived"].includes(str(p.status).toLowerCase())) return false;
  return num(p.selling_price) > 0 && !!str(p.part_name);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "Utility Tee - Black - M" → "Utility Tee" when the part's size and colour are known. */
function baseName(name: string, size: string, color: string) {
  let out = name;
  for (let pass = 0; pass < 2; pass++) {
    for (const token of [size, color]) {
      if (!token) continue;
      out = out.replace(new RegExp(`[\\s\\-/|,(]*\\b${escapeRe(token)}\\b\\)?\\s*$`, "i"), "").trim();
    }
  }
  return out || name;
}

/** Desktop paths arrive as "Assets/Products/<hash>.<ext>" once the laptop uploaded the file. */
function mediaNameOf(path: string) {
  const file = path.replace(/\\/g, "/").split("/").pop() ?? "";
  return isMediaName(file.toLowerCase()) ? file.toLowerCase() : null;
}

type Desired = {
  externalId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  colorName: string | null;
  images: string[];
  variants: { externalId: string; size: string; color: string; stock: number }[];
};

async function desiredCatalog(): Promise<Desired[]> {
  const rows = await prisma.syncRow.findMany({
    where: { tbl: { in: ["parts", "categories", "product_images"] }, deleted: false },
    select: { tbl: true, gid: true, data: true },
  });
  const counters = await prisma.syncCounter.findMany({ where: { tbl: "parts", col: "quantity_in_stock" } });
  const stock = new Map(counters.map((c) => [c.gid, Math.max(0, Math.floor(c.value))]));

  const categories = new Map<string, string>();
  const gallery = new Map<string, { path: string; order: number }[]>();
  const parts: { gid: string; row: Row }[] = [];
  for (const r of rows) {
    let data: Row;
    try {
      data = JSON.parse(r.data) as Row;
    } catch {
      continue;
    }
    if (r.tbl === "categories") categories.set(r.gid, str(data.category_name));
    else if (r.tbl === "product_images") {
      const part = str(data.part_id);
      if (!part) continue;
      const list = gallery.get(part) ?? [];
      list.push({ path: str(data.image_path), order: num(data.sort_order) });
      gallery.set(part, list);
    } else if (sellable(data)) parts.push({ gid: r.gid, row: data });
  }

  const allImageNames = new Set<string>();
  const imagePaths = (gid: string, row: Row) => {
    const list = (gallery.get(gid) ?? []).sort((a, b) => a.order - b.order).map((g) => g.path);
    list.push(str(row.part_image));
    return list.filter(Boolean);
  };
  for (const p of parts) for (const path of imagePaths(p.gid, p.row)) {
    const name = mediaNameOf(path);
    if (name) allImageNames.add(name);
  }
  const missing = new Set(await missingMedia([...allImageNames]));

  const groups = new Map<string, { gid: string; row: Row }[]>();
  for (const p of parts) {
    const size = str(p.row.size);
    const color = str(p.row.color);
    const style = str(p.row.style_code);
    const key = `${style ? `s:${style}` : `n:${baseName(str(p.row.part_name), size, color)}`}|${color}`.toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const reserved = await reservedByExternalId();
  const out: Desired[] = [];
  for (const [key, members] of groups) {
    members.sort((a, b) => a.gid.localeCompare(b.gid));
    const first = members[0].row;
    const color = str(first.color);

    const images: string[] = [];
    for (const m of members) {
      for (const path of imagePaths(m.gid, m.row)) {
        const name = mediaNameOf(path);
        const url = name && !missing.has(name) ? `/media/${name}` : path.startsWith("https://images.unsplash.com/") ? path : null;
        if (url && !images.includes(url)) images.push(url);
      }
    }

    const bySize = new Map<string, { gid: string; row: Row }>();
    for (const m of members) {
      const size = str(m.row.size) || "One Size";
      if (!bySize.has(size.toLowerCase())) bySize.set(size.toLowerCase(), m);
    }

    const names = members.map((m) => baseName(str(m.row.part_name), str(m.row.size), str(m.row.color)));
    out.push({
      externalId: `g-${createHash("sha1").update(key).digest("hex").slice(0, 16)}`,
      name: names.sort((a, b) => a.length - b.length)[0],
      description: members.map((m) => str(m.row.description)).find(Boolean) ?? "",
      category: categories.get(str(first.category_id)) || "General",
      price: Math.max(...members.map((m) => num(m.row.selling_price))),
      colorName: color || null,
      images: images.slice(0, 8),
      variants: [...bySize.values()].map((m) => {
        const externalId = `${PART_PREFIX}${m.gid}`;
        return {
          externalId,
          size: str(m.row.size) || "One Size",
          color: color || "Default",
          stock: Math.max(0, (stock.get(m.gid) ?? 0) - (reserved.get(externalId) ?? 0)),
        };
      }),
    });
  }
  return out;
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "item";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    const hit = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!hit) return slug;
  }
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Makes the storefront match the desktop catalogue held in the hub. Only rows that differ are written,
 * so it is cheap to call after every sync exchange. With a budget it stops early (done: false) and the
 * next call carries on, which keeps a first build of a large catalogue inside serverless time limits.
 */
export async function rebuildStorefront(budgetMs = Number.POSITIVE_INFINITY) {
  const deadline = Date.now() + budgetMs;
  const desired = await desiredCatalog();
  const existing = await prisma.product.findMany({ include: { variants: true } });
  const byExternal = new Map(existing.filter((p) => p.externalId).map((p) => [p.externalId as string, p]));
  const categoryIds = new Map<string, string>();
  let written = 0;

  for (const d of desired) {
    if (Date.now() > deadline) return { products: desired.length, written, hidden: 0, done: false };
    let categoryId = categoryIds.get(d.category);
    if (!categoryId) {
      const slug = slugify(d.category) || "general";
      const cat = await prisma.category.upsert({ where: { slug }, update: {}, create: { name: d.category, slug } });
      categoryId = cat.id;
      categoryIds.set(d.category, categoryId);
    }

    const [imageUrl = PLACEHOLDER_IMAGE, ...gallery] = d.images;
    const fields = {
      name: d.name,
      description: d.description,
      price: d.price,
      imageUrl,
      images: JSON.stringify(gallery),
      colorName: d.colorName,
      category: d.category,
      categoryId,
      active: true,
    };

    let product = byExternal.get(d.externalId);
    if (!product) {
      const created = await prisma.product.create({
        data: { ...fields, externalId: d.externalId, slug: await uniqueSlug(`${d.name} ${d.colorName ?? ""}`) },
      });
      product = { ...created, variants: [] };
      written++;
    } else {
      const changed =
        product.name !== fields.name ||
        product.description !== fields.description ||
        product.price !== fields.price ||
        product.imageUrl !== fields.imageUrl ||
        !sameList(JSON.parse(product.images || "[]"), gallery) ||
        product.colorName !== fields.colorName ||
        product.categoryId !== categoryId ||
        !product.active;
      if (changed) {
        await prisma.product.update({ where: { id: product.id }, data: fields });
        written++;
      }
    }

    const keep = new Set<string>();
    for (const v of d.variants) {
      keep.add(v.externalId);
      const current =
        product.variants.find((x) => x.externalId === v.externalId) ??
        (await prisma.productVariant.findUnique({ where: { externalId: v.externalId } }));
      if (current) {
        if (current.stock === v.stock && current.size === v.size && current.color === v.color && current.productId === product.id) continue;
        const clash = await prisma.productVariant.findFirst({
          where: { productId: product.id, size: v.size, color: v.color, NOT: { id: current.id } },
          select: { id: true },
        });
        await prisma.productVariant.update({
          where: { id: current.id },
          data: clash ? { stock: v.stock, productId: product.id } : { stock: v.stock, productId: product.id, size: v.size, color: v.color },
        });
      } else {
        await prisma.productVariant.upsert({
          where: { productId_size_color: { productId: product.id, size: v.size, color: v.color } },
          update: { externalId: v.externalId, stock: v.stock },
          create: { externalId: v.externalId, productId: product.id, size: v.size, color: v.color, stock: v.stock },
        });
      }
      written++;
    }

    const stale = product.variants.filter((x) => x.externalId && !keep.has(x.externalId) && x.stock !== 0);
    if (stale.length) {
      await prisma.productVariant.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { stock: 0 } });
      written += stale.length;
    }
  }

  let hidden = 0;
  if (desired.length > 0) {
    const wanted = desired.map((d) => d.externalId);
    const res = await prisma.product.updateMany({
      where: { active: true, OR: [{ externalId: null }, { externalId: { notIn: wanted } }] },
      data: { active: false },
    });
    hidden = res.count;
  }

  return { products: desired.length, written, hidden, done: true };
}

type Db = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma;

/** Records that the storefront no longer matches the hub; the rebuild itself happens outside the sync transaction. */
export async function markStorefrontDirty(db: Db = prisma) {
  await db.$executeRawUnsafe(
    `INSERT INTO "SyncMeta" (key, value) VALUES ('storefront_want', '1')
     ON CONFLICT(key) DO UPDATE SET value = CAST(CAST("SyncMeta".value AS INTEGER) + 1 AS TEXT)`,
  );
}

async function metaNumber(key: string) {
  const row = await prisma.syncMeta.findUnique({ where: { key } });
  return Number(row?.value ?? 0);
}

/** Brings the storefront up to date when the hub changed since the last complete rebuild. */
export async function refreshStorefront(budgetMs = 6000) {
  const want = await metaNumber("storefront_want");
  if (want <= (await metaNumber("storefront_done"))) return null;
  const result = await rebuildStorefront(budgetMs);
  if (result.done) {
    await prisma.syncMeta.upsert({
      where: { key: "storefront_done" },
      update: { value: String(want) },
      create: { key: "storefront_done", value: String(want) },
    });
  }
  return result;
}
