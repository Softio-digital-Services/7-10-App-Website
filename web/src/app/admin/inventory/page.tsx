import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminInventoryPage() {
  const session = await requireAdmin();
  if (!session) redirect("/login");

  const threshold = Number(process.env.LOW_STOCK_THRESHOLD ?? 5);
  const variants = await prisma.productVariant.findMany({
    where: { stock: { lte: threshold } },
    include: { product: true },
    orderBy: { stock: "asc" },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Inventory alerts</h1>
      <p className="mt-2 text-stone-600">
        Variants at or below {threshold} units. Email alerts fire once per threshold
        crossing.
      </p>

      <div className="mt-8 space-y-3">
        {variants.map((variant) => (
          <div
            key={variant.id}
            className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4"
          >
            <div>
              <p className="font-medium">{variant.product.name}</p>
              <p className="text-sm text-stone-600">
                {variant.size} / {variant.color}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm ${
                variant.stock === 0
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {variant.stock === 0 ? "Out of stock" : `Low: ${variant.stock}`}
            </span>
          </div>
        ))}
        {variants.length === 0 && (
          <p className="text-stone-600">All variants are above the low-stock threshold.</p>
        )}
      </div>
    </main>
  );
}
