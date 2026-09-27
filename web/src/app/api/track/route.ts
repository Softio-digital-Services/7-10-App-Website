import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { phonesMatch } from "@/lib/format";
import { normalizeOrderNumber, orderInclude } from "@/lib/orders";

const schema = z.object({
  orderNumber: z.string().trim().min(4).max(20),
  phone: z.string().trim().min(6).max(24),
});

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function limited(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "rate" }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { orderNumber: normalizeOrderNumber(parsed.data.orderNumber) },
    include: orderInclude,
  });

  if (!order || !phonesMatch(order.customerPhone, parsed.data.phone)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    city: order.city,
    region: order.region,
    items: order.items.map((i) => ({
      id: i.id,
      name: i.variant.product.name,
      nameAr: i.variant.product.nameAr,
      slug: i.variant.product.slug,
      image: i.variant.product.imageUrl,
      size: i.variant.size,
      quantity: i.quantity,
      price: i.price,
    })),
  });
}
