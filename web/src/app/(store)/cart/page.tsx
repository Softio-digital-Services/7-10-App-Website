import type { Metadata } from "next";
import { BagView } from "@/components/checkout/bag-view";
import { getProducts } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.bag.title, robots: { index: false } };
}

export default async function CartPage() {
  const { locale } = await getI18n();
  const products = await getProducts({ sort: "featured", inStock: true }, locale);
  return <BagView suggestions={products.slice(0, 10)} />;
}
