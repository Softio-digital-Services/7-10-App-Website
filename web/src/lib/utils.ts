import { NextResponse } from "next/server";

/** Checks the shared shop key the desktop app sends on /api/desktop/* requests. */
export function verifyDesktopKey(request: Request) {
  const key = request.headers.get("x-desktop-key");
  // Same key as the cloud hub; SEVENTEN_API_KEY is the older name, still accepted when SHOP_SYNC_KEY is empty.
  const expected = process.env.SHOP_SYNC_KEY || process.env.SEVENTEN_API_KEY;

  if (!expected || expected === "change-me-to-a-long-random-key") {
    return { ok: false as const, error: "Desktop API key not configured on server" };
  }

  if (!key || key !== expected) {
    return { ok: false as const, error: "Invalid API key" };
  }

  return { ok: true as const };
}

export function desktopUnauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function discountedPrice(price: number, discount: number) {
  if (discount <= 0) return price;
  return Math.round(price * (100 - discount)) / 100;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
