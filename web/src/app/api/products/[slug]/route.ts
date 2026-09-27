import { NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/catalog";
import { getLocale } from "@/lib/i18n/server";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug, await getLocale());

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product);
}
