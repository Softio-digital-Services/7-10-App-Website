import Link from "next/link";
import { ArrowRight, MonitorSmartphone } from "lucide-react";
import { StatusPill } from "@/components/admin/status-pill";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { store } from "@/lib/store-config";
import { unsyncedOrderCount } from "@/lib/hub/web-orders";

function ranges() {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  return { dayStart, monthAgo: new Date(dayStart.getTime() - 29 * 86_400_000) };
}

export default async function AdminPage() {
  const { dayStart, monthAgo } = ranges();

  const [today, pending, revenue, lowStock, soldOut, unsynced, recent] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: monthAgo }, status: { not: "CANCELLED" } } }),
    prisma.productVariant.count({ where: { stock: { gt: 0, lte: store.lowStockAt }, product: { active: true } } }),
    prisma.productVariant.count({ where: { stock: 0, product: { active: true } } }),
    unsyncedOrderCount(),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, orderNumber: true, customerName: true, status: true, total: true, createdAt: true, paymentMethod: true } }),
  ]);

  const stats = [
    { label: "Orders today", value: String(today) },
    { label: "Awaiting confirmation", value: String(pending), alert: pending > 0, href: "/admin/orders?status=PENDING" },
    { label: "Revenue · 30 days", value: formatPrice(revenue._sum.total ?? 0), sub: `${revenue._count} orders` },
    { label: "Low / sold-out sizes", value: `${lowStock} / ${soldOut}`, alert: soldOut > 0, href: "/admin/inventory?view=low" },
  ];

  return (
    <div className="space-y-12">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-[13px] text-charcoal/60">{s.label}</p>
              <p className="mt-3 flex items-center gap-3 font-display text-4xl font-medium" dir="ltr">
                {s.value}
                {s.alert && <span className="dot-signal pulse-signal" />}
              </p>
              {s.sub && <p className="mt-1 text-[12.5px] text-charcoal/50">{s.sub}</p>}
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="border border-charcoal/15 p-6 transition-colors hover:border-charcoal">
              {body}
            </Link>
          ) : (
            <div key={s.label} className="border border-charcoal/15 p-6">
              {body}
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-4 bg-olive/10 p-5 text-[14px]">
        <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-olive" strokeWidth={1.5} />
        <p>
          <strong className="font-medium">Desktop sync.</strong> Website orders flow into the 7.10 desktop app&apos;s Orders pipeline, and products and stock come from the desktop app.{" "}
          {unsynced > 0 ? `${unsynced} open web order${unsynced === 1 ? " is" : "s are"} waiting to be pulled.` : "All open web orders are in the desktop app."}
        </p>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="display text-3xl">Latest orders</h2>
          <Link href="/admin/orders" className="link-line text-[14px]">
            All orders
          </Link>
        </div>
        <div className="mt-5 overflow-x-auto border border-charcoal/15">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead className="bg-cream-2 text-start text-[12px] text-charcoal/60">
              <tr>
                <th className="px-5 py-3 text-start font-normal">Order</th>
                <th className="px-5 py-3 text-start font-normal">Customer</th>
                <th className="px-5 py-3 text-start font-normal">Status</th>
                <th className="px-5 py-3 text-start font-normal">Payment</th>
                <th className="px-5 py-3 text-end font-normal">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-t border-charcoal/10">
                  <td className="px-5 py-3.5 font-display tracking-wider" dir="ltr">{o.orderNumber}</td>
                  <td className="px-5 py-3.5">{o.customerName}</td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-5 py-3.5 text-charcoal/70">{o.paymentMethod === "COD" ? "Cash on delivery" : "Whish Money"}</td>
                  <td className="px-5 py-3.5 text-end" dir="ltr">{formatPrice(o.total)}</td>
                  <td className="px-3">
                    <Link href={`/admin/orders?q=${o.orderNumber}`} aria-label={`Open ${o.orderNumber}`} className="grid h-8 w-8 place-items-center hover:bg-cream-2">
                      <ArrowRight className="flip-rtl h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-charcoal/55">No orders yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}