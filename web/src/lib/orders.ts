import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** httpOnly cookie listing the order numbers placed from this device, so guests can reopen their confirmation page. */
export const ORDER_COOKIE = "710_orders";
const MAX_REMEMBERED = 20;

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderNumber() {
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  return `710-${code}`;
}

export function normalizeOrderNumber(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const code = clean.startsWith("710") ? clean.slice(3) : clean;
  return `710-${code}`;
}

/** Each cookie entry is "<orderNumber>.<signature>", so a visitor cannot add someone else's order number by hand. */
function signOrder(orderNumber: string) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`order:${orderNumber}`).digest("base64url").slice(0, 32);
}

function verifiedOrder(entry: string) {
  const dot = entry.lastIndexOf(".");
  if (dot <= 0) return null;
  const orderNumber = entry.slice(0, dot);
  const given = Buffer.from(entry.slice(dot + 1));
  const expected = Buffer.from(signOrder(orderNumber));
  return given.length === expected.length && timingSafeEqual(given, expected) ? orderNumber : null;
}

export async function rememberedOrders() {
  const jar = await cookies();
  return (jar.get(ORDER_COOKIE)?.value ?? "")
    .split(",")
    .map(verifiedOrder)
    .filter((n): n is string => !!n);
}

export function withRemembered(existing: string[], orderNumber: string) {
  return [orderNumber, ...existing.filter((n) => n !== orderNumber)]
    .slice(0, MAX_REMEMBERED)
    .map((n) => `${n}.${signOrder(n)}`)
    .join(",");
}

export const orderInclude = {
  items: { include: { variant: { include: { product: true } } } },
} as const;

/** Returns the order if this visitor placed it on this device, owns it, or is staff. */
export async function getOrderForViewer(orderNumber: string) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: orderInclude });
  if (!order) return null;

  const remembered = await rememberedOrders();
  if (remembered.includes(order.orderNumber)) return order;

  const session = await auth();
  if (session?.user) {
    if (order.userId && order.userId === session.user.id) return order;
    if (session.user.role === "ADMIN" || session.user.role === "MANAGER") return order;
  }
  return null;
}