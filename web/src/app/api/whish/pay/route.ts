import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rememberedOrders } from "@/lib/orders";
import { startWhishCheckout } from "@/lib/whish-start";
import { isWhishMethod, whishConfigured } from "@/lib/whish";

const schema = z.object({ orderNumber: z.string().min(4) });

/** Starts (or restarts) Whish payment for an unpaid website order the visitor can see. */
export async function POST(request: Request) {
  if (!whishConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { orderNumber: parsed.data.orderNumber },
    select: { id: true, orderNumber: true, total: true, externalId: true, paymentStatus: true, paymentMethod: true },
  });
  if (!order || !isWhishMethod(order.paymentMethod)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.paymentStatus === "PAID") return NextResponse.json({ paid: true });
  if (!(await rememberedOrders()).includes(order.orderNumber)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const payUrl = await startWhishCheckout(order);
    if (!payUrl) return NextResponse.json({ error: "not_configured" }, { status: 503 });
    return NextResponse.json({ payUrl });
  } catch (err) {
    console.error("[whish:retry]", err);
    return NextResponse.json({ error: "whish" }, { status: 502 });
  }
}
