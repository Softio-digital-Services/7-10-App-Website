import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.checkout.title, robots: { index: false } };
}

export default async function CheckoutPage() {
  const session = await auth();
  // Signed-in customers start with their default saved address (account page > Addresses).
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, phone: true, addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], take: 1 } },
      })
    : null;
  const addr = user?.addresses[0];
  const account = user
    ? {
        name: addr?.name ?? user.name ?? "",
        email: user.email,
        phone: addr?.phone ?? user.phone ?? "",
        region: addr?.region ?? "",
        city: addr?.city ?? "",
        address: addr ? [addr.street, addr.floor, addr.landmark && `near ${addr.landmark}`].filter(Boolean).join(", ") : "",
      }
    : null;
  return (
    <CheckoutView
      account={account}
    />
  );
}
