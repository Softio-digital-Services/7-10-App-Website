import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId: session.user.id }, { customerEmail: session.user.email }],
    },
    include: {
      items: {
        include: {
          variant: { include: { product: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Your orders</h1>
      <p className="mt-2 text-stone-600">
        Same orders appear here and in the mobile app via <code>/api/sync</code>.
      </p>

      <div className="mt-8 space-y-4">
        {orders.map((order) => (
          <article key={order.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{order.orderNumber}</p>
              <p className="text-sm text-stone-600">{order.status}</p>
            </div>
            <p className="mt-1 text-sm text-stone-500">
              Payment: {order.paymentStatus} — ${order.total.toFixed(2)}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-stone-700">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.variant.product.name} ({item.variant.size}/{item.variant.color}) x
                  {item.quantity}
                </li>
              ))}
            </ul>
          </article>
        ))}
        {orders.length === 0 && (
          <p className="text-stone-600">
            No orders yet.{" "}
            <Link href="/" className="underline">
              Start shopping
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
