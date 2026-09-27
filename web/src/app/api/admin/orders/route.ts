import { NextResponse, after } from "next/server";
import { z } from "zod";
import type { OrderStatus, Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth";
import { notifyOrderStatus, notifyPaymentReceived } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const STATUSES = ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

const updateSchema = z
  .object({
    orderId: z.string(),
    status: z.enum(STATUSES).optional(),
    paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
  })
  .refine((v) => v.status || v.paymentStatus, "Nothing to update");

class StockError extends Error {}

export async function GET(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();

  const where: Prisma.OrderWhereInput = {};
  if (status && (STATUSES as readonly string[]).includes(status)) where.status = status as OrderStatus;
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { orderNumber: { contains: q.toUpperCase() } },
      { customerName: { contains: q } },
      ...(digits.length >= 3 ? [{ customerPhone: { contains: digits.slice(-8) } }] : []),
    ];
  }

  const [orders, grouped] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { variant: { include: { product: { select: { name: true, slug: true, imageUrl: true } } } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
  ]);

  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  return NextResponse.json({ orders, counts });
}

export async function PATCH(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { orderId, status, paymentStatus } = parsed.data;

  const current = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (status && status !== current.status && current.desktopRef) {
    return NextResponse.json({ error: "synced" }, { status: 409 });
  }
  const claimFresh = current.claimedAt && Date.now() - current.claimedAt.getTime() < 10 * 60 * 1000;
  if (status && status !== current.status && current.claimedBy && claimFresh && !current.syncError) {
    return NextResponse.json({ error: "claimed" }, { status: 409 });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      if (status && status !== current.status) {
        if (status === "CANCELLED") {
          for (const item of current.items) {
            await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
          }
        } else if (current.status === "CANCELLED") {
          for (const item of current.items) {
            const res = await tx.productVariant.updateMany({
              where: { id: item.variantId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
            if (res.count === 0) throw new StockError();
          }
        }
      }
      return tx.order.update({
        where: { id: orderId },
        data: { ...(status ? { status } : {}), ...(paymentStatus ? { paymentStatus } : {}) },
      });
    });

    after(async () => {
      if (status && status !== current.status) await notifyOrderStatus(order).catch(console.error);
      if (paymentStatus === "PAID" && current.paymentStatus !== "PAID") await notifyPaymentReceived(order).catch(console.error);
    });

    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof StockError) return NextResponse.json({ error: "stock" }, { status: 409 });
    throw error;
  }
}
