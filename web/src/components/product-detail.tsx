"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { discountedPrice } from "@/lib/utils";

type ProductDetailProps = {
  product: {
    id: string;
    name: string;
    price: number;
    discount: number;
    description: string;
    imageUrl: string;
    category: string;
    variants: { id: string; size: string; color: string; stock: number }[];
  };
  isLoggedIn: boolean;
  userEmail?: string | null;
};

export function ProductDetail({ product, isLoggedIn, userEmail }: ProductDetailProps) {
  const { addItem } = useCart();
  const [size, setSize] = useState(product.variants[0]?.size ?? "");
  const [color, setColor] = useState(product.variants[0]?.color ?? "");
  const [message, setMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(userEmail ?? "");

  const salePrice = discountedPrice(product.price, product.discount);

  const sizes = useMemo(
    () => [...new Set(product.variants.map((v) => v.size))],
    [product.variants],
  );
  const colors = useMemo(
    () => [...new Set(product.variants.map((v) => v.color))],
    [product.variants],
  );

  const selectedVariant = product.variants.find(
    (v) => v.size === size && v.color === color,
  );

  function handleAddToCart() {
    if (!selectedVariant || selectedVariant.stock <= 0) return;
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      size: selectedVariant.size,
      color: selectedVariant.color,
      price: salePrice,
      imageUrl: product.imageUrl,
    });
    setMessage("Added to cart");
  }

  async function handleRequest(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, message: requestMessage }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Request sent to manager." : data.error ?? "Request failed");
  }

  async function handleStockNotify(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/stock-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, email: notifyEmail }),
    });
    const data = await response.json();
    setMessage(response.ok ? "We will email you when back in stock." : data.error ?? "Subscribe failed");
  }

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-stone-100">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
        {product.discount > 0 && (
          <span className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white">
            {product.discount}% OFF
          </span>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-amber-600">{product.category}</p>
          <h1 className="mt-2 text-3xl font-semibold">{product.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-2xl font-semibold text-stone-900">${salePrice.toFixed(2)}</p>
            {product.discount > 0 && (
              <p className="text-lg text-red-500 line-through">${product.price.toFixed(2)}</p>
            )}
          </div>
        </div>

        <p className="text-stone-600">{product.description}</p>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Size</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSize(option)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    size === option
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-stone-300"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Color</p>
            <div className="flex flex-wrap gap-2">
              {colors.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    color === option
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-stone-300"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!selectedVariant || selectedVariant.stock <= 0}
            className="rounded-full bg-stone-900 px-6 py-3 text-white disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {selectedVariant && selectedVariant.stock > 0 ? "Add to cart" : "Sold out"}
          </button>
          {selectedVariant && (
            <span className="text-sm text-stone-500">{selectedVariant.stock} in stock</span>
          )}
        </div>

        {selectedVariant && selectedVariant.stock <= 0 && (
          <form onSubmit={handleStockNotify} className="space-y-2 rounded-2xl border border-stone-200 p-4">
            <p className="text-sm font-medium">Notify me when back in stock</p>
            <input
              required
              type="email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2"
              placeholder="your@email.com"
            />
            <button type="submit" className="rounded-full bg-amber-500 px-4 py-2 text-sm text-white">
              Subscribe
            </button>
          </form>
        )}

        {isLoggedIn && (
          <form onSubmit={handleRequest} className="space-y-2 rounded-2xl border border-stone-200 p-4">
            <p className="text-sm font-medium">Ask manager about this product</p>
            <textarea
              required
              minLength={10}
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              className="min-h-24 w-full rounded-xl border border-stone-300 px-3 py-2"
              placeholder="Size availability, bulk order, custom request..."
            />
            <button type="submit" className="rounded-full border border-stone-900 px-4 py-2 text-sm">
              Send request
            </button>
          </form>
        )}

        {message && <p className="text-sm text-emerald-700">{message}</p>}
      </div>
    </div>
  );
}
