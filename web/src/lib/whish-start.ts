import { prisma } from "@/lib/prisma";
import { createWhishPayment, newWhishExternalId, whishConfigured, whishWebsite } from "@/lib/whish";

export async function startWhishCheckout(order: { id: string; orderNumber: string; total: number; externalId: string | null }) {
  if (!whishConfigured()) return null;
  const origin = whishWebsite();
  let externalId = order.externalId && /^\d+$/.test(order.externalId) ? Number(order.externalId) : newWhishExternalId();
  if (!order.externalId) {
    await prisma.order.update({ where: { id: order.id }, data: { externalId: String(externalId) } });
  }
  const payUrl = await createWhishPayment({
    amount: Math.round(order.total * 100) / 100,
    invoice: `7.10 ${order.orderNumber}`,
    externalId,
    successCallbackUrl: `${origin}/api/whish/callback/success`,
    failureCallbackUrl: `${origin}/api/whish/callback/failure`,
    successRedirectUrl: `${origin}/order/${encodeURIComponent(order.orderNumber)}?pay=ok`,
    failureRedirectUrl: `${origin}/order/${encodeURIComponent(order.orderNumber)}?pay=failed`,
  });
  return payUrl;
}
