"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";

export default function CartPage() {
  const { items, updateQuantity, removeItem, total } = useCart();

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">Your cart is empty</h1>
        <Link href="/" className="mt-6 inline-block text-stone-700 underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-semibold">Cart</h1>
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.variantId}
            className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4"
          >
            <div className="relative h-20 w-16 overflow-hidden rounded-xl bg-stone-100">
              <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{item.productName}</p>
              <p className="text-sm text-stone-500">
                {item.size} / {item.color}
              </p>
            </div>
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => updateQuantity(item.variantId, Number(e.target.value))}
              className="w-16 rounded-lg border border-stone-300 px-2 py-1"
            />
            <p className="w-20 text-right font-medium">
              ${(item.price * item.quantity).toFixed(2)}
            </p>
            <button
              type="button"
              onClick={() => removeItem(item.variantId)}
              className="text-sm text-stone-500 hover:text-stone-900"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-stone-200 pt-6">
        <p className="text-lg font-semibold">Total: ${total.toFixed(2)}</p>
        <Link
          href="/checkout"
          className="rounded-full bg-stone-900 px-6 py-3 text-white hover:bg-stone-800"
        >
          Checkout
        </Link>
      </div>
    </main>
  );
}
