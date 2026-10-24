import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { desktopUnauthorized, verifyDesktopKey } from "@/lib/utils";

export async function GET(request: Request) {
  const auth = verifyDesktopKey(request);
  if (!auth.ok) return desktopUnauthorized(auth.error);

  const [products, orders, categories] = await Promise.all([
    prisma.product.findMany({
      include: { variants: true, categoryRef: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.order.findMany({
      take: 100,
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    syncedAt: new Date().toISOString(),
    products,
    orders,
    categories,
  });
}
