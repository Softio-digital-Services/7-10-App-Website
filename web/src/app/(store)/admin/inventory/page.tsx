import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { Img } from "@/components/img";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sortSizes, store } from "@/lib/store-config";

type SearchParams = Promise<{ view?: string }>;

export default async function AdminInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { view = "all" } = await searchParams;
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { variants: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const rows = products
    .map((p) => {
      const total = p.variants.reduce((s, v) => s + v.stock, 0);
      const out = p.variants.filter((v) => v.stock <= 0).length;
      const low = p.variants.filter((v) => v.stock > 0 && v.stock <= store.lowStockAt).length;
      return { ...p, total, out, low };
    })
    .filter((p) => (view === "low" ? p.out > 0 || p.low > 0 : view === "out" ? p.total === 0 : true));

  const tabs = [
    { id: "all", label: "All products" },
    { id: "low", label: "Needs restock" },
    { id: "out", label: "Sold out" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "all" ? "/admin/inventory" : `/admin/inventory?view=${tab.id}`}
              aria-current={view === tab.id ? "page" : undefined}
              className={`border px-3.5 py-2 text-[13.5px] transition-colors ${
                view === tab.id ? "border-charcoal bg-charcoal text-cream" : "border-charcoal/15 hover:border-charcoal"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <p className="flex items-center gap-2 text-[13px] text-charcoal/60">
          <MonitorSmartphone className="h-4 w-4 text-olive" strokeWidth={1.5} />
          Products and stock are managed in the 7.10 desktop app.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto border border-charcoal/15">
        <table className="w-full min-w-[760px] text-[14px]">
          <thead className="bg-cream-2 text-[12px] text-charcoal/60">
            <tr>
              <th className="px-5 py-3 text-start font-normal">Product</th>
              <th className="px-5 py-3 text-start font-normal">Sizes · units left</th>
              <th className="px-5 py-3 text-end font-normal">Price</th>
              <th className="px-5 py-3 text-end font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const variants = sortSizes(p.variants.map((v) => v.size)).map((size) => p.variants.find((v) => v.size === size)!);
              return (
                <tr key={p.id} className="border-t border-charcoal/10 align-top">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="card-img relative h-14 w-11 shrink-0">
                        {p.imageUrl && <Img src={p.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
                      </span>
                      <span>
                        <a href={`/products/${p.slug}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                          {p.name}
                        </a>
                        <span className="block text-[12.5px] text-charcoal/50">{p.category}{p.colorName ? ` · ${p.colorName}` : ""}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {variants.map((v) => (
                        <span
                          key={v.id}
                          className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[12.5px] ${
                            v.stock <= 0 ? "border-signal/40 bg-signal/5 text-signal" : v.stock <= store.lowStockAt ? "border-charcoal bg-cream-2" : "border-charcoal/15"
                          }`}
                          dir="ltr"
                        >
                          <span className="font-medium">{v.size}</span>
                          <span className="opacity-70">{v.stock}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-end" dir="ltr">
                    {formatPrice(p.discount ? Math.round(p.price * (100 - p.discount)) / 100 : p.price)}
                    {p.discount > 0 && <span className="block text-[12px] text-signal">−{p.discount}%</span>}
                  </td>
                  <td className={`px-5 py-4 text-end font-display text-lg ${p.total === 0 ? "text-signal" : ""}`} dir="ltr">{p.total}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-14 text-center text-charcoal/55">
                  {view === "all" ? "No products yet — add them in the desktop app and sync." : "Nothing here — stock looks healthy."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
