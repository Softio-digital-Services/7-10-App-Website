import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authDevice, hubError } from "@/lib/hub/auth";
import { applyChanges, changeSchema, getMeta, hubState, prunedThrough, pruneLog, readChanges } from "@/lib/hub/store";
import { markStorefrontDirty, refreshStorefront } from "@/lib/hub/storefront";
import { ackSchema, applyAcks, applyStatuses, claimWebOrders, statusSchema } from "@/lib/hub/web-orders";

export const maxDuration = 60;

const schema = z.object({
  /** last hub seq this laptop has applied */
  cursor: z.number().int().min(0),
  changes: z.array(changeSchema).max(1000).default([]),
  acks: z.array(ackSchema).max(100).default([]),
  statuses: z.array(statusSchema).max(500).default([]),
  claim: z.boolean().default(false),
  limit: z.number().int().min(1).max(2000).default(500),
  appVersion: z.string().max(40).optional(),
});

const STOREFRONT_TABLES = new Set(["parts", "categories", "product_images"]);

/**
 * One round trip per sync cycle: store the laptop's changes and website-order results,
 * then hand back everyone else's changes and any website orders it should take in.
 */
export async function POST(request: Request) {
  const auth = await authDevice(request);
  if (auth.error) return auth.error;
  const device = auth.device;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return hubError("invalid", 400, { issues: parsed.error.issues.slice(0, 5) });
  const body = parsed.data;

  const state = await hubState();
  if (state !== "ready") {
    const founder = await getMeta("founder");
    if (state === "empty" || founder !== device.id) return hubError("shop_not_ready", 409, { state });
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const pushed = await applyChanges(tx, device.id, body.changes);
      const acked = await applyAcks(tx, device.id, body.acks);
      const statuses = await applyStatuses(tx, body.statuses);
      if (acked > 0 || pushed.accepted.some((c) => STOREFRONT_TABLES.has(c.t))) await markStorefrontDirty(tx);
      return { ...pushed, acked, statuses };
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  await prisma.syncDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date(), cursor: body.cursor, ...(body.appVersion ? { appVersion: body.appVersion } : {}) },
  });

  const resync = body.cursor < (await prunedThrough());
  const pulled = resync ? { items: [], cursor: body.cursor, more: false } : await readChanges(device.id, body.cursor, body.limit);
  const webOrders = body.claim && state === "ready" && !resync ? await claimWebOrders(device.id) : [];

  let storefrontError: string | null = null;
  if (state === "ready") {
    try {
      await refreshStorefront();
    } catch (err) {
      storefrontError = err instanceof Error ? err.message : String(err);
      console.error("refreshStorefront failed", err);
    }
  }

  if (Math.random() < 0.02) pruneLog().catch((err) => console.error("pruneLog failed", err));

  const meta = {
    applied: result.accepted.length,
    acked: result.acked,
    statuses: result.statuses,
    head: result.head,
    cursor: pulled.cursor,
    more: pulled.more,
    resync,
    state,
    webOrders,
    storefrontError,
  };
  const json = JSON.stringify(meta);
  return new Response(`${json.slice(0, -1)},"changes":[${pulled.items.join(",")}]}`, {
    headers: { "Content-Type": "application/json" },
  });
}
