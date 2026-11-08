import type { Metadata } from "next";
import { BagView } from "@/components/checkout/bag-view";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.bag.title, robots: { index: false } };
}

export default function CartPage() {
  return <BagView />;
}
