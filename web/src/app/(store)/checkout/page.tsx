import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { auth } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.checkout.title, robots: { index: false } };
}

export default async function CheckoutPage() {
  const session = await auth();
  return (
    <CheckoutView
      account={session?.user ? { name: session.user.name ?? "", email: session.user.email ?? "" } : null}
    />
  );
}
