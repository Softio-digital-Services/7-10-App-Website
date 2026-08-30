import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const discountOnly = searchParams.get("discount") === "1";
  const sort = searchParams.get("sort") ?? "newest";

  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(category ? { categoryRef: { slug: category } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
      ...(discountOnly ? { discount: { gt: 0 } } : {}),
    },
    include: {
      variants: { select: { id: true, size: true, color: true, stock: true } },
      categoryRef: true,
    },
    orderBy:
      sort === "price-asc"
        ? { price: "asc" }
        : sort === "price-desc"
          ? { price: "desc" }
          : sort === "name"
            ? { name: "asc" }
            : { createdAt: "desc" },
  });

  return NextResponse.json(products);
}
