"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

/** Save/unsave a product to the signed-in customer's wishlist (shown on the account page). */
export function WishlistButton({ productId }: { productId: string }) {
  const { locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/wishlist")
      .then((r) => r.json())
      .then((d: { signedIn: boolean; ids: string[] }) => {
        if (!live) return;
        setSignedIn(d.signedIn);
        setSaved(d.ids.includes(productId));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [productId]);

  const toggle = async () => {
    if (signedIn === false) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    const next = !saved;
    setSaved(next);
    const res = await fetch("/api/wishlist", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => null);
    if (!res?.ok) setSaved(!next);
    setBusy(false);
  };

  const label = locale === "ar" ? (saved ? "إزالة من المفضّلة" : "أضف إلى المفضّلة") : saved ? "Remove from wishlist" : "Save to wishlist";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className="rh-press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-charcoal/25 transition-colors hover:border-charcoal"
    >
      <Heart className={`h-5 w-5 transition-transform ${saved ? "pop fill-signal text-signal" : ""}`} strokeWidth={1.8} />
    </button>
  );
}
