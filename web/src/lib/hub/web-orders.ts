import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isWhishMethod } from "@/lib/whish";
import { confirmWhishOrder } from "@/lib/whish-settle";

const PART_PREFIX = "part-";
/** A laptop that claimed an order but went quiet loses the claim after this long. */
const CLAIM_TTL_MS = 10 * 60 * 1000;

type Tx = Prisma.TransactionClient;

/** Website orders not yet inside the desktop pipeline still hold their units. */
const unsyncedWhere = { source: "WEB", desktopRef: null, status: { not: "CANCELLED" } } satisfies Prisma.OrderWhereInput;

export async function reservedByExternalId() {
  const items = await prisma.orderItem.findMany({
    where: { order: unsyncedWhere },
    select: { quantity: true, variant: { select: { externalId: true } } },
  });
  const map = new Map<string, number>();
  for (const i of items) {
    const id = i.variant.externalId;
    if (id) map.set(id, (map.get(id) ?? 0) + i.quantity);
  }
  return map;
}

export async function unsyncedOrderCount() {
  return prisma.order.count({ where: unsyncedWhere });
}

/**
 * Hands up to 20 waiting website orders to this laptop. The conditional update makes the claim atomic,
 * so two laptops syncing at the same moment never both take the same order.
 */
export async function claimWebOrders(deviceId: string) {
  const staleBefore = new Date(Date.now() - CLAIM_TTL_MS);
  const claimable: Prisma.OrderWhereInput = {
    ...unsyncedWhere,
    OR: [{ claimedBy: null }, { claimedBy: deviceId }, { claimedAt: { lt: staleBefore } }],
  };
  const candidates = await prisma.order.findMany({
    where: claimable,
    include: { items: { include: { variant: { include: { product: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const claimed = [];
  for (const o of candidates) {
    let paymentStatus = o.paymentStatus;
    if (isWhishMethod(o.paymentMethod) && paymentStatus === "PENDING") {
      const next = await confirmWhishOrder(o);
      if (next !== "PAID") continue;
      paymentStatus = "PAID";
    }
    const unlinked = o.items.filter((i) => !i.variant.externalId?.startsWith(PART_PREFIX));
    if (unlinked.length) {
      const message = `Not linked to a desktop product: ${unlinked.map((i) => `${i.variant.product.name} (${i.variant.size})`).join(", ")}`;
      if (o.syncError !== message) await prisma.order.update({ where: { id: o.id }, data: { syncError: message } });
      continue;
    }
    const res = await prisma.order.updateMany({
      where: { id: o.id, ...claimable },
      data: { claimedBy: deviceId, claimedAt: new Date() },
    });
    if (res.count !== 1) continue;
    claimed.push({
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerEmail: o.customerEmail,
      region: o.region,
      city: o.city,
      address: o.shippingAddress,
      notes: o.notes,
      paymentMethod: o.paymentMethod,
      paymentStatus,
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      total: o.total,
      items: o.items.map((i) => ({
        partGid: (i.variant.externalId ?? "").slice(PART_PREFIX.length),
        productName: i.variant.product.name,
        size: i.variant.size,
        quantity: i.quantity,
        price: i.price,
      })),
    });
  }
  return claimed;
}

export const ackSchema = z.object({
  orderNumber: z.string().min(1),
  /** hub id of the desktop order */
  ref: z.string().min(3).max(96).optional(),
  error: z.string().max(500).optional(),
});

export const WEB_STATUSES = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export const statusSchema = z.object({
  orderNumber: z.string().min(1),
  status: z.enum(WEB_STATUSES),
  paid: z.boolean().optional(),
});

/** Runs inside the exchange transaction, after the laptop's changes (including the new desktop order) are stored. */
export async function applyAcks(tx: Tx, deviceId: string, acks: z.infer<typeof ackSchema>[]) {
  let n = 0;
  for (const a of acks) {
    const order = await tx.order.findUnique({ where: { orderNumber: a.orderNumber } });
    if (!order || order.desktopRef) continue;
    if (a.ref) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          desktopRef: a.ref,
          claimedBy: deviceId,
          syncError: null,
          syncedAt: new Date(),
          status: order.status === "PENDING" ? "CONFIRMED" : order.status,
        },
      });
      n++;
    } else if (a.error && order.syncError !== a.error) {
      await tx.order.update({ where: { id: order.id }, data: { syncError: a.error } });
    }
  }
  return n;
}

/**
 * Returns the order numbers the laptop can stop re-sending: applied, already current, or unknown here.
 * An order whose desktop link hasn't arrived yet is left out so the laptop retries it next cycle.
 */
export async function applyStatuses(tx: Tx, statuses: z.infer<typeof statusSchema>[]) {
  const settled: string[] = [];
  for (const s of statuses) {
    const order = await tx.order.findUnique({
      where: { orderNumber: s.orderNumber },
      select: { id: true, desktopRef: true, status: true, paymentStatus: true },
    });
    if (!order) {
      settled.push(s.orderNumber);
      continue;
    }
    if (!order.desktopRef) continue;
    const markPaid = s.paid === true && order.paymentStatus !== "PAID";
    if (order.status !== s.status || markPaid) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: s.status, ...(markPaid ? { paymentStatus: "PAID" as const } : {}), syncedAt: new Date() },
      });
    }
    settled.push(s.orderNumber);
  }
  return settled;
}
