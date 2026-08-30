import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await requireAdmin();
  if (!session) redirect("/login");

  const [productCount, orderCount, lowStock, comments] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.productVariant.count({
      where: { stock: { lte: Number(process.env.LOW_STOCK_THRESHOLD ?? 5) } },
    }),
    prisma.comment.count({ where: { reply: null } }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Admin dashboard</h1>
      <p className="mt-2 text-stone-600">
        Manage orders, inventory alerts, and comment replies.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <StatCard label="Products" value={productCount} />
        <StatCard label="Orders" value={orderCount} />
        <StatCard label="Low stock variants" value={lowStock} />
        <StatCard label="Open comments" value={comments} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/orders" className="rounded-full bg-stone-900 px-4 py-2 text-white">
          View orders
        </Link>
        <Link href="/admin/inventory" className="rounded-full border border-stone-300 px-4 py-2">
          Inventory alerts
        </Link>
        <Link href="/admin/comments" className="rounded-full border border-stone-300 px-4 py-2">
          Reply to comments
        </Link>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
