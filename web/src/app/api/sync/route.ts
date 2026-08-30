import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [products, orders] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      include: { variants: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    syncedAt: new Date().toISOString(),
    products,
    orders,
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    },
  });
}
