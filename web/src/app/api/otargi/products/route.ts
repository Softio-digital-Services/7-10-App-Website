import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { otargiUnauthorized, slugify, verifyOtargiKey } from "@/lib/utils";
import { setVariantStock } from "@/lib/inventory";

const variantSchema = z.object({
  externalId: z.string(),
  size: z.string(),
  color: z.string(),
  stock: z.number().int().min(0),
});

const productSchema = z.object({
  externalId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number().positive(),
  cost: z.number().min(0).optional(),
  discount: z.number().min(0).max(100).optional(),
  imageUrl: z.string().optional(),
  category: z.string().optional(),
  active: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
});

const upsertSchema = z.object({
  products: z.array(productSchema),
});

export async function GET(request: Request) {
  const auth = verifyOtargiKey(request);
  if (!auth.ok) return otargiUnauthorized(auth.error);

  const products = await prisma.product.findMany({
    include: { variants: true, categoryRef: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(request: Request) {
  const auth = verifyOtargiKey(request);
  if (!auth.ok) return otargiUnauthorized(auth.error);

  const body = await request.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const results = [];

  for (const item of parsed.data.products) {
    const categoryName = item.category ?? "General";
    const category = await prisma.category.upsert({
      where: { slug: slugify(categoryName) },
      update: { name: categoryName },
      create: { name: categoryName, slug: slugify(categoryName) },
    });

    const slug = slugify(item.name);
    const product = await prisma.product.upsert({
      where: { externalId: item.externalId },
      update: {
        name: item.name,
        description: item.description ?? "",
        price: item.price,
        cost: item.cost ?? 0,
        discount: item.discount ?? 0,
        imageUrl: item.imageUrl ?? "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
        category: categoryName,
        categoryId: category.id,
        active: item.active ?? true,
      },
      create: {
        externalId: item.externalId,
        name: item.name,
        slug,
        description: item.description ?? "",
        price: item.price,
        cost: item.cost ?? 0,
        discount: item.discount ?? 0,
        imageUrl: item.imageUrl ?? "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
        category: categoryName,
        categoryId: category.id,
        active: item.active ?? true,
      },
    });

    if (item.variants?.length) {
      for (const variant of item.variants) {
        await prisma.productVariant.upsert({
          where: { externalId: variant.externalId },
          update: {
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
          },
          create: {
            externalId: variant.externalId,
            productId: product.id,
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
          },
        });
      }
    }

    results.push(product);
  }

  return NextResponse.json({ upserted: results.length, products: results });
}

const stockSchema = z.object({
  externalId: z.string(),
  stock: z.number().int().min(0),
});

export async function PATCH(request: Request) {
  const auth = verifyOtargiKey(request);
  if (!auth.ok) return otargiUnauthorized(auth.error);

  const body = await request.json();
  const parsed = stockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const variant = await prisma.productVariant.findUnique({
    where: { externalId: parsed.data.externalId },
  });

  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const updated = await setVariantStock(variant.id, parsed.data.stock);
  return NextResponse.json(updated);
}
