import { store } from "@/lib/store-config";

const URLS = {
  sandbox: "https://lb.sandbox.whish.money/itel-service/api",
  production: "https://whish.money/itel-service/api",
} as const;

export type WhishCurrency = "USD" | "LBP" | "AED";

export function whishConfigured() {
  return Boolean(process.env.WHISH_CHANNEL?.trim() && process.env.WHISH_SECRET?.trim());
}

/** Older “card” orders are treated as Whish. */
export function isWhishMethod(method: string) {
  return method === "WHISH" || method === "CARD";
}

export function whishWebsite() {
  return (process.env.WHISH_WEBSITE_URL || process.env.NEXT_PUBLIC_SITE_URL || store.siteUrl).replace(/\/$/, "");
}

function environment(): keyof typeof URLS {
  const explicit = (process.env.WHISH_ENV ?? "").toLowerCase();
  if (explicit === "production" || explicit === "live") return "production";
  if (explicit === "sandbox" || explicit === "test") return "sandbox";
  return process.env.NODE_ENV === "production" ? "production" : "sandbox";
}

function headers() {
  return {
    "Content-Type": "application/json",
    channel: process.env.WHISH_CHANNEL!.trim(),
    secret: process.env.WHISH_SECRET!.trim(),
    websiteurl: whishWebsite(),
  };
}

type WhishEnvelope<T> = {
  status: boolean;
  code?: string;
  dialog?: { title?: string; message?: string } | null;
  data?: T;
};

async function call<T>(path: string, body?: Record<string, unknown>): Promise<WhishEnvelope<T>> {
  const res = await fetch(`${URLS[environment()]}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(25_000),
  });
  const json = (await res.json().catch(() => null)) as WhishEnvelope<T> | null;
  if (!json) throw new Error(`Whish answered ${res.status}`);
  return json;
}

export function newWhishExternalId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

/** Asks Whish for a payment page. The customer finishes the payment there (app or card in Whish). */
export async function createWhishPayment(input: {
  amount: number;
  invoice: string;
  externalId: number;
  successCallbackUrl: string;
  failureCallbackUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
}) {
  const res = await call<{ collectUrl?: string; whishUrl?: string }>("/payment/whish", {
    amount: input.amount,
    currency: store.currency as WhishCurrency,
    invoice: input.invoice,
    externalId: input.externalId,
    successCallbackUrl: input.successCallbackUrl,
    failureCallbackUrl: input.failureCallbackUrl,
    successRedirectUrl: input.successRedirectUrl,
    failureRedirectUrl: input.failureRedirectUrl,
  });
  const url = res.data?.collectUrl || res.data?.whishUrl;
  if (!res.status || !url) {
    throw new Error(res.dialog?.message || res.code || "Whish did not return a payment link.");
  }
  return url;
}

export async function whishPaymentStatus(externalId: number) {
  const res = await call<{ collectStatus?: string; amount?: number; currency?: string }>(
    "/payment/collect/status",
    { currency: store.currency, externalId },
  );
  if (!res.status) return { collectStatus: "pending" as const, amount: undefined as number | undefined };
  const raw = (res.data?.collectStatus ?? "pending").toLowerCase();
  const collectStatus = raw === "success" || raw === "failed" ? raw : ("pending" as const);
  return { collectStatus, amount: res.data?.amount };
}

export function parseWhishCallback(url: string) {
  try {
    const params = new URL(url).searchParams;
    const raw = params.get("externalId") ?? "";
    if (!/^\d+$/.test(raw)) return null;
    return Number(raw);
  } catch {
    return null;
  }
}

export function amountsMatch(received: number | undefined, expected: number) {
  if (received == null || !Number.isFinite(received)) return true;
  return Math.abs(received - expected) <= 0.05;
}
