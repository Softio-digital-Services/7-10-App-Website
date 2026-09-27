import { NextResponse } from "next/server";

export function verifyOtargiKey(request: Request) {
  const key = request.headers.get("x-otargi-key");
  const expected = process.env.OTARGI_API_KEY;

  if (!expected || expected === "change-me-to-a-long-random-key") {
    return { ok: false as const, error: "Otargi API key not configured on server" };
  }

  if (!key || key !== expected) {
    return { ok: false as const, error: "Invalid API key" };
  }

  return { ok: true as const };
}

export function otargiUnauthorized(message: string) {
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
