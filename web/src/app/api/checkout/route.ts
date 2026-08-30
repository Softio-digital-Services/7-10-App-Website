import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrementStock } from "@/lib/inventory";
import { notifyPaymentReceived } from "@/lib/email";
import { discountedPrice } from "@/lib/utils";

const checkoutSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  shippingAddress: z.string().min(10),
  items: z
    .array(
      z.object({
        variantId: z.string(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

function generateOrderNumber() {
  return `710-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(request: Request) {
  const session = await auth();
  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { customerName, customerEmail, shippingAddress, items } = parsed.data;

  try {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: items.map((i) => i.variantId) } },
      include: { product: true },
    });

    if (variants.length !== items.length) {
      return NextResponse.json({ error: "Invalid cart items" }, { status: 400 });
    }

    let total = 0;
    const orderItems = items.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId)!;
      const unitPrice = discountedPrice(variant.product.price, variant.product.discount);
      total += unitPrice * item.quantity;
      return {
        variantId: variant.id,
        quantity: item.quantity,
        price: unitPrice,
      };
    });

    const order = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await decrementStock(item.variantId, item.quantity, tx);
      }

      return tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: session?.user?.id,
          customerName,
          customerEmail,
          shippingAddress,
          total,
          status: "CONFIRMED",
          paymentStatus: "PAID",
          items: { create: orderItems },
        },
        include: { items: true },
      });
    });

    await notifyPaymentReceived({
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      total,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
