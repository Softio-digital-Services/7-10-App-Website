import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;

  const product = await prisma.product.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
      active: true,
    },
    include: {
      variants: true,
      comments: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product);
}
