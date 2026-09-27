import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SyncDevice } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PLACEHOLDER = "change-me-to-a-long-random-key";

export function shopKey() {
  const key = process.env.SHOP_SYNC_KEY || process.env.OTARGI_API_KEY || "";
  return key && key !== PLACEHOLDER ? key : "";
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const newDeviceId = () => randomBytes(4).toString("hex");

export function hubError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

/** The shop sync key proves the caller belongs to this shop (used once, when a laptop links itself). */
export function checkShopKey(request: Request) {
  const expected = shopKey();
  if (!expected) return hubError("not_configured", 503);
  const given = request.headers.get("x-shop-key") ?? "";
  return given && safeEqual(given, expected) ? null : hubError("bad_shop_key", 401);
}

type DeviceAuth = { device: SyncDevice; error?: never } | { device?: never; error: NextResponse };

/** Every sync call after linking is signed with the laptop's own id + token, so one laptop can be revoked alone. */
export async function authDevice(request: Request): Promise<DeviceAuth> {
  const id = request.headers.get("x-device-id") ?? "";
  const token = request.headers.get("x-device-token") ?? "";
  if (!id || !token) return { error: hubError("no_device", 401) };

  const device = await prisma.syncDevice.findUnique({ where: { id } });
  if (!device || !safeEqual(device.tokenHash, hashToken(token))) return { error: hubError("bad_device", 401) };
  if (device.revokedAt) return { error: hubError("device_revoked", 403) };
  return { device };
}
