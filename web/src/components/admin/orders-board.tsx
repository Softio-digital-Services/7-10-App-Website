"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronDown, ExternalLink, LoaderCircle, MonitorSmartphone, Phone, Search } from "lucide-react";
import { orderStatuses, StatusPill, statusLabel } from "@/components/admin/status-pill";
import { WhatsAppIcon } from "@/components/icons";
import { Img } from "@/components/img";
import { formatPrice } from "@/lib/format";

type AdminOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  shippingAddress: string;
  notes: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: "COD" | "CARD" | "WHISH";
  source: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  desktopRef: string | null;
  syncError: string | null;
  createdAt: string;
  items: { id: string; quantity: number; price: number; variant: { size: string; color: string; product: { name: string; slug: string; imageUrl: string } } }[];
};

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function OrdersBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";

  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState(q);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [version, setVersion] = useState(0);
  const autoOpened = useRef(false);

  useEffect(() => {
    let ignore = false;
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (q) qs.set("q", q);
    fetch(`/api/admin/orders?${qs}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ orders: AdminOrder[]; counts: Record<string, number> }>) : Promise.reject(res.status)))
      .then((data) => {
        if (ignore) return;
        setOrders(data.orders);
        setCounts(data.counts);
        if (!autoOpened.current && q && data.orders.length === 1) {
          autoOpened.current = true;
          setOpen(data.orders[0].id);
        }
      })
      .catch(() => {
        if (ignore) return;
        setNotice({ tone: "error", text: "Could not load orders." });
        setOrders([]);
      });
    return () => {
      ignore = true;
    };
  }, [status, q, version]);

  function navigate(next: { status?: string; q?: string }) {
    const qs = new URLSearchParams();
    const s = next.status ?? status;
    const term = next.q ?? q;
    if (s) qs.set("status", s);
    if (term) qs.set("q", term);
    router.replace(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function patch(order: AdminOrder, body: { status?: string; paymentStatus?: string }) {
    setBusy(order.id);
    setNotice(null);
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, ...body }),
    });
    setBusy(null);
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      setNotice({
        tone: "error",
        text:
          error === "synced"
            ? `${order.orderNumber} is managed in the desktop app — change its status there.`
            : error === "claimed"
              ? `A laptop is taking ${order.orderNumber} into the desktop app right now. Try again in a minute.`
              : error === "stock"
              ? `Not enough stock to restore ${order.orderNumber}.`
              : "Update failed.",
      });
      return;
    }
    setNotice({ tone: "ok", text: `${order.orderNumber} updated.` });
    setVersion((v) => v + 1);
    router.refresh();
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const tabs = [{ id: "", label: "All", count: total }, ...orderStatuses.map((s) => ({ id: s, label: statusLabel(s), count: counts[s] ?? 0 }))];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id || "all"}
              type="button"
              onClick={() => navigate({ status: tab.id })}
              aria-pressed={status === tab.id}
              className={`flex items-center gap-2 border px-3.5 py-2 text-[13.5px] transition-colors ${
                status === tab.id ? "border-charcoal bg-charcoal text-cream" : "border-charcoal/15 hover:border-charcoal"
              }`}
            >
              {tab.label}
              <span className="font-display text-[11px] opacity-60" dir="ltr">{tab.count}</span>
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            autoOpened.current = false;
            navigate({ q: query.trim() });
          }}
          className="flex w-full items-center border border-charcoal/20 focus-within:border-charcoal sm:w-80"
        >
          <Search className="ms-3 h-4 w-4 shrink-0 text-charcoal/45" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order number, name or phone"
            aria-label="Search orders"
            className="w-full bg-transparent px-3 py-2.5 text-[14px] outline-none"
          />
        </form>
      </div>

      {notice && (
        <p role="status" className={`mt-5 flex items-center gap-2.5 px-4 py-3 text-[14px] ${notice.tone === "ok" ? "bg-olive/10" : "bg-signal/10 text-signal"}`}>
          {notice.tone === "error" && <AlertTriangle className="h-4 w-4" />}
          {notice.text}
        </p>
      )}

      <div className="mt-6 divide-y divide-charcoal/10 border border-charcoal/15">
        {orders === null &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-5">
              <span className="skeleton h-5 w-28" />
              <span className="skeleton h-5 w-40" />
              <span className="skeleton ms-auto h-5 w-16" />
            </div>
          ))}
        {orders?.length === 0 && <p className="px-5 py-14 text-center text-charcoal/55">No orders match.</p>}
        {orders?.map((order) => {
          const expanded = open === order.id;
          const phoneDigits = order.customerPhone.replace(/\D/g, "");
          const units = order.items.reduce((s, i) => s + i.quantity, 0);
          return (
            <div key={order.id}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : order.id)}
                aria-expanded={expanded}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 text-start transition-colors hover:bg-cream-2/60 md:grid-cols-[150px_1fr_130px_110px_100px_24px]"
              >
                <span className="font-display tracking-wider" dir="ltr">{order.orderNumber}</span>
                <span className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
                  <span className="block truncate text-[14.5px]">{order.customerName}</span>
                  <span className="block text-[12.5px] text-charcoal/50">
                    {dateFmt.format(new Date(order.createdAt))} · {units} item{units === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="hidden md:block">
                  <StatusPill status={order.status} />
                </span>
                <span className="hidden text-[12.5px] md:block">
                  {order.paymentMethod === "COD" ? "COD" : "Whish"} ·{" "}
                  <span className={order.paymentStatus === "PAID" ? "text-olive" : "text-charcoal/55"}>{order.paymentStatus.toLowerCase()}</span>
                </span>
                <span className="text-end font-medium md:order-none" dir="ltr">{formatPrice(order.total)}</span>
                <ChevronDown className={`hidden h-4 w-4 transition-transform md:block ${expanded ? "rotate-180" : ""}`} />
              </button>

              {expanded && (
                <div className="grid gap-8 border-t border-charcoal/10 bg-cream-2/40 px-5 py-6 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <p className="eyebrow text-[10.5px] text-charcoal/55">Items</p>
                    <ul className="mt-3 space-y-3">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-3">
                          <span className="card-img relative h-14 w-11 shrink-0">
                            {item.variant.product.imageUrl && <Img src={item.variant.product.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
                          </span>
                          <span className="min-w-0 flex-1 text-[14px]">
                            <a href={`/products/${item.variant.product.slug}`} target="_blank" rel="noreferrer" className="block truncate hover:underline">
                              {item.variant.product.name}
                            </a>
                            <span className="text-[12.5px] text-charcoal/55">
                              Size {item.variant.size} · ×{item.quantity}
                            </span>
                          </span>
                          <span className="text-[14px]" dir="ltr">{formatPrice(item.price * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <dl className="mt-4 space-y-1.5 border-t border-charcoal/10 pt-3 text-[13.5px]">
                      <div className="flex justify-between"><dt className="text-charcoal/60">Subtotal</dt><dd dir="ltr">{formatPrice(order.subtotal)}</dd></div>
                      <div className="flex justify-between"><dt className="text-charcoal/60">Delivery</dt><dd dir="ltr">{order.deliveryFee ? formatPrice(order.deliveryFee) : "Free"}</dd></div>
                      <div className="flex justify-between font-medium"><dt>Total</dt><dd dir="ltr">{formatPrice(order.total)}</dd></div>
                    </dl>
                  </div>

                  <div className="space-y-4 text-[14px] lg:col-span-4">
                    <div>
                      <p className="eyebrow text-[10.5px] text-charcoal/55">Customer</p>
                      <p className="mt-2 font-medium">{order.customerName}</p>
                      {order.customerEmail && <p className="text-charcoal/65">{order.customerEmail}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={`tel:+${phoneDigits}`} className="inline-flex items-center gap-2 border border-charcoal/20 px-3 py-1.5 text-[13px] hover:border-charcoal" dir="ltr">
                          <Phone className="h-3.5 w-3.5" /> {order.customerPhone}
                        </a>
                        <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-charcoal/20 px-3 py-1.5 text-[13px] hover:border-charcoal">
                          <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" /> WhatsApp
                        </a>
                      </div>
                    </div>
                    <div>
                      <p className="eyebrow text-[10.5px] text-charcoal/55">Deliver to</p>
                      <p className="mt-2 text-charcoal/80">{order.shippingAddress}</p>
                    </div>
                    {order.notes && (
                      <div>
                        <p className="eyebrow text-[10.5px] text-charcoal/55">Notes</p>
                        <p className="mt-2 bg-cream px-3 py-2 text-charcoal/80">{order.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 lg:col-span-3">
                    {order.desktopRef ? (
                      <p className="flex items-start gap-2.5 bg-olive/10 p-3 text-[13px]">
                        <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-olive" />
                        In the desktop Orders board. Status updates come from there.
                      </p>
                    ) : order.syncError && order.status !== "CANCELLED" ? (
                      <p className="flex items-start gap-2.5 bg-signal/10 p-3 text-[13px] text-signal">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Not in the desktop app yet: {order.syncError}</span>
                      </p>
                    ) : null}
                    <label className="block">
                      <span className="field-label">Status</span>
                      <select
                        value={order.status}
                        disabled={busy === order.id || !!order.desktopRef}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === "CANCELLED" && !confirm(`Cancel ${order.orderNumber}? Its items go back into stock.`)) return;
                          patch(order, { status: next });
                        }}
                        className="field"
                      >
                        {orderStatuses.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={busy === order.id}
                      onClick={() => patch(order, { paymentStatus: order.paymentStatus === "PAID" ? "PENDING" : "PAID" })}
                      className={`btn btn-sm w-full ${order.paymentStatus === "PAID" ? "btn-outline" : "btn-olive"}`}
                    >
                      {busy === order.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                      {order.paymentStatus === "PAID" ? "Mark as unpaid" : "Mark as paid"}
                    </button>
                    <a href={`/order/${order.orderNumber}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[13px] text-charcoal/60 hover:text-charcoal">
                      Customer view <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
