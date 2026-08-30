"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">Nothing to checkout</h1>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("Processing payment...");

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerEmail,
        shippingAddress,
        items: items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error ?? "Checkout failed");
      setLoading(false);
      return;
    }

    clearCart();
    setStatus(`Order ${data.orderNumber} placed. Confirmation email sent.`);
    setTimeout(() => router.push("/"), 2000);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-semibold">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
        <input
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Full name"
          className="w-full rounded-xl border border-stone-300 px-3 py-2"
        />
        <input
          required
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="Email for order updates"
          className="w-full rounded-xl border border-stone-300 px-3 py-2"
        />
        <textarea
          required
          value={shippingAddress}
          onChange={(e) => setShippingAddress(e.target.value)}
          placeholder="Shipping address"
          className="min-h-24 w-full rounded-xl border border-stone-300 px-3 py-2"
        />

        <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
          <p>{items.length} item(s)</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">
            Total: ${total.toFixed(2)}
          </p>
          <p className="mt-2">
            Demo checkout marks payment as received and emails you + the store admin.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-stone-900 px-6 py-3 text-white disabled:bg-stone-400"
        >
          {loading ? "Processing..." : "Pay now"}
        </button>
        {status && <p className="text-sm text-stone-600">{status}</p>}
      </form>
    </main>
  );
}
