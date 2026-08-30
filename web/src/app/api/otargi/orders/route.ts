import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { otargiUnauthorized, verifyOtargiKey } from "@/lib/utils";
import { decrementStock } from "@/lib/inventory";

const orderItemSchema = z.object({
  externalVariantId: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

const orderSchema = z.object({
  externalId: z.string(),
  customerName: z.string(),
  customerEmail: z.string().email(),
  shippingAddress: z.string(),
  total: z.number().positive(),
  items: z.array(orderItemSchema).min(1),
});

export async function GET(request: Request) {
  const auth = verifyOtargiKey(request);
  if (!auth.ok) return otargiUnauthorized(auth.error);

  const orders = await prisma.order.findMany({
    include: {
      items: {
        include: {
          variant: { include: { product: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const auth = verifyOtargiKey(request);
  if (!auth.ok) return otargiUnauthorized(auth.error);

  const body = await request.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({
    where: { externalId: parsed.data.externalId },
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      externalId: { in: parsed.data.items.map((i) => i.externalVariantId) },
    },
  });

  if (variants.length !== parsed.data.items.length) {
    return NextResponse.json({ error: "One or more variants not found" }, { status: 400 });
  }

  const order = await prisma.$transaction(async (tx) => {
    for (const item of parsed.data.items) {
      const variant = variants.find((v) => v.externalId === item.externalVariantId)!;
      await decrementStock(variant.id, item.quantity, tx);
    }

    return tx.order.create({
      data: {
        externalId: parsed.data.externalId,
        orderNumber: `OTG-${parsed.data.externalId}`,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
        shippingAddress: parsed.data.shippingAddress,
        total: parsed.data.total,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        source: "OTARGI",
        items: {
          create: parsed.data.items.map((item) => {
            const variant = variants.find((v) => v.externalId === item.externalVariantId)!;
            return {
              variantId: variant.id,
              quantity: item.quantity,
              price: item.price,
            };
          }),
        },
      },
      include: { items: true },
    });
  });

  return NextResponse.json(order, { status: 201 });
}
