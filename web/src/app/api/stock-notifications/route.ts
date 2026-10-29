import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HOUR, isRateLimited, limitByIp } from "@/lib/rate-limit";

const subscribeSchema = z.object({
  productId: z.string().min(1).max(64),
  email: z.string().trim().toLowerCase().email().max(120),
});

export async function POST(request: Request) {
  const limited = await limitByIp(request, "stock-notify", 20, HOUR);
  if (limited) return limited;

  const parsed = subscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { productId, email } = parsed.data;

  // One address can't be signed up from many IPs to flood someone's inbox.
  if (await isRateLimited(`stock-notify-email:${email}`, 10, 24 * HOUR)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, active: true } });
  if (!product?.active) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const session = await auth();
  await prisma.stockNotification.upsert({
    where: { productId_email: { productId: product.id, email } },
    update: { notified: false, userId: session?.user?.id },
    create: { productId: product.id, email, userId: session?.user?.id },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
