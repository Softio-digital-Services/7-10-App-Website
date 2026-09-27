import { NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkStockAlerts } from "@/lib/inventory";
import { notifyOrderPlaced } from "@/lib/email";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { ORDER_COOKIE, generateOrderNumber, rememberedOrders, withRemembered } from "@/lib/orders";
import { deliveryFeeFor, regions } from "@/lib/store-config";
import { discountedPrice } from "@/lib/utils";
import { startWhishCheckout } from "@/lib/whish-start";
import { whishConfigured } from "@/lib/whish";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(24),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(120)]).optional(),
  region: z.string(),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(240),
  notes: z.string().trim().max(500).optional(),
  payment: z.enum(["COD", "WHISH", "CARD"]),
  locale: z.enum(["en", "ar"]).default("en"),
  items: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(40),
});

class StockError extends Error {
  constructor(public stock: Record<string, number>) {
    super("stock");
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", fields: Object.keys(parsed.error.flatten().fieldErrors) }, { status: 400 });
  }
  const input = parsed.data;

  const region = regions.find((r) => r.id === input.region);
  if (!region) return NextResponse.json({ error: "invalid", fields: ["region"] }, { status: 400 });
  if (!isValidPhone(input.phone)) return NextResponse.json({ error: "invalid", fields: ["phone"] }, { status: 400 });

  const wanted = new Map<string, number>();
  for (const item of input.items) wanted.set(item.variantId, (wanted.get(item.variantId) ?? 0) + item.quantity);

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...wanted.keys()] } },
    include: { product: true },
  });

  const available: Record<string, number> = {};
  for (const id of wanted.keys()) {
    const v = variants.find((x) => x.id === id);
    available[id] = v && v.product.active ? Math.max(0, v.stock) : 0;
  }
  if ([...wanted].some(([id, qty]) => available[id] < qty)) {
    return NextResponse.json({ error: "stock", stock: available }, { status: 409 });
  }

  const lines = [...wanted].map(([id, quantity]) => {
    const v = variants.find((x) => x.id === id)!;
    return { variant: v, quantity, price: discountedPrice(v.product.price, v.product.discount) };
  });
  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
  const deliveryFee = deliveryFeeFor(region.id, subtotal);
  const total = round2(subtotal + deliveryFee);

  const paymentMethod = input.payment === "COD" ? "COD" : "WHISH";
  if (paymentMethod === "WHISH" && !whishConfigured()) {
    return NextResponse.json({ error: "whish_not_configured" }, { status: 503 });
  }

  const session = await auth();
  const phone = `+961 ${normalizePhone(input.phone)}`;
  const email = input.email || null;
  const shippingAddress = `${input.address}, ${input.city}, ${region.en}`;

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const res = await tx.productVariant.updateMany({
          where: { id: line.variant.id, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (res.count === 0) {
          const fresh = await tx.productVariant.findMany({ where: { id: { in: [...wanted.keys()] } } });
          throw new StockError(Object.fromEntries(fresh.map((v) => [v.id, Math.max(0, v.stock)])));
        }
      }

      let orderNumber = generateOrderNumber();
      while (await tx.order.findUnique({ where: { orderNumber }, select: { id: true } })) {
        orderNumber = generateOrderNumber();
      }

      return tx.order.create({
        data: {
          orderNumber,
          userId: session?.user?.id,
          customerName: input.name,
          customerPhone: phone,
          customerEmail: email,
          region: region.id,
          city: input.city,
          notes: input.notes || null,
          shippingAddress,
          paymentMethod,
          status: "PENDING",
          paymentStatus: "PENDING",
          subtotal,
          deliveryFee,
          total,
          locale: input.locale,
          source: "WEB",
          items: {
            create: lines.map((l) => ({ variantId: l.variant.id, quantity: l.quantity, price: l.price })),
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof StockError) {
      return NextResponse.json({ error: "stock", stock: error.stock }, { status: 409 });
    }
    console.error("[checkout]", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  const placed = order;
  after(async () => {
    try {
      const updated = await prisma.productVariant.findMany({
        where: { id: { in: lines.map((l) => l.variant.id) } },
        include: { product: true },
      });
      for (const v of updated) await checkStockAlerts(v);
      await notifyOrderPlaced({
        orderNumber: placed.orderNumber,
        customerName: placed.customerName,
        customerEmail: placed.customerEmail,
        customerPhone: placed.customerPhone,
        paymentMethod: placed.paymentMethod,
        address: shippingAddress,
        subtotal,
        deliveryFee,
        total,
        items: lines.map((l) => ({ name: l.variant.product.name, size: l.variant.size, quantity: l.quantity, price: l.price })),
      });
    } catch (error) {
      console.error("[checkout:after]", error);
    }
  });

  let payUrl: string | null = null;
  if (paymentMethod === "WHISH") {
    try {
      payUrl = await startWhishCheckout(placed);
    } catch (err) {
      console.error("[checkout:whish]", err);
    }
  }

  const response = NextResponse.json({ orderNumber: placed.orderNumber, total, payUrl }, { status: 201 });
  response.cookies.set(ORDER_COOKIE, withRemembered(await rememberedOrders(), placed.orderNumber), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
