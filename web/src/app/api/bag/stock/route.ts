import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { discountedPrice } from "@/lib/utils";

const schema = z.object({ variantIds: z.array(z.string()).max(100) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: parsed.data.variantIds }, product: { active: true } },
    select: { id: true, stock: true, product: { select: { price: true, discount: true } } },
  });

  const stock: Record<string, number> = Object.fromEntries(parsed.data.variantIds.map((id) => [id, 0]));
  const prices: Record<string, { price: number; compareAt: number | null }> = {};
  for (const v of variants) {
    stock[v.id] = Math.max(0, v.stock);
    prices[v.id] = {
      price: discountedPrice(v.product.price, v.product.discount),
      compareAt: v.product.discount > 0 ? v.product.price : null,
    };
  }

  return NextResponse.json({ stock, prices });
}
