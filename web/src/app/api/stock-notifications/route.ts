import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const subscribeSchema = z.object({
  productId: z.string(),
  email: z.string().email(),
});

export async function POST(request: Request) {
  const session = await auth();
  const body = await request.json();
  const parsed = subscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const subscription = await prisma.stockNotification.upsert({
    where: {
      productId_email: {
        productId: product.id,
        email: parsed.data.email.toLowerCase(),
      },
    },
    update: { notified: false, userId: session?.user?.id },
    create: {
      productId: product.id,
      email: parsed.data.email.toLowerCase(),
      userId: session?.user?.id,
    },
  });

  return NextResponse.json(subscription, { status: 201 });
}
