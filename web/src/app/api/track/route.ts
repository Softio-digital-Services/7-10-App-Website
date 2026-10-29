import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { phonesMatch } from "@/lib/format";
import { normalizeOrderNumber, orderInclude } from "@/lib/orders";
import { MINUTE, limitByIp } from "@/lib/rate-limit";

const schema = z.object({
  orderNumber: z.string().trim().min(4).max(20),
  phone: z.string().trim().min(6).max(24),
});

export async function POST(request: Request) {
  const limited = await limitByIp(request, "track", 20, 10 * MINUTE);
  if (limited) return limited;

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
