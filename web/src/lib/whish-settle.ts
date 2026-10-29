import { prisma } from "@/lib/prisma";
import { notifyPaymentReceived } from "@/lib/email";
import { amountsMatch, parseWhishCallback, whishConfigured, whishPaymentStatus } from "@/lib/whish";

type SettleOrder = {
  id: string;
  orderNumber: string;
  total: number;
  paymentStatus: string;
  externalId: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
};

/** Asks Whish for the real status, then marks the order paid or failed. */
export async function confirmWhishOrder(order: SettleOrder) {
  if (order.paymentStatus === "PAID") return "PAID";
  if (!whishConfigured()) return order.paymentStatus;
  if (!order.externalId || !/^\d+$/.test(order.externalId)) return order.paymentStatus;

  const status = await whishPaymentStatus(Number(order.externalId));
  if (status.collectStatus === "success") {
    if (!amountsMatch(status.amount, order.total, status.currency)) {
      console.error(`[whish] ${order.orderNumber}: paid ${status.amount} ${status.currency ?? ""}, expected ${order.total}. Check it by hand.`);
      return order.paymentStatus;
    }
    // Callback, order page and a laptop can confirm at the same moment; only the first one sends the email.
    const res = await prisma.order.updateMany({ where: { id: order.id, paymentStatus: { not: "PAID" } }, data: { paymentStatus: "PAID" } });
    if (res.count === 1 && order.customerEmail) {
      await notifyPaymentReceived({
        orderNumber: order.orderNumber,
        customerName: order.customerName ?? "",
        customerEmail: order.customerEmail,
        total: order.total,
      }).catch(console.error);
    }
    return "PAID";
  }
  if (status.collectStatus === "failed" && order.paymentStatus === "PENDING") {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
    return "FAILED";
  }
  return order.paymentStatus;
}

/**
 * Confirms with Whish (never trust the URL alone), then marks the order paid or failed.
 * Only Whish's own status decides: a hit on the failure URL by itself changes nothing.
 */
export async function settleWhishPayment(requestUrl: string) {
  if (!whishConfigured()) return null;
  const externalId = parseWhishCallback(requestUrl);
  if (externalId == null) return null;

  const order = await prisma.order.findUnique({
    where: { externalId: String(externalId) },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      paymentStatus: true,
      externalId: true,
      customerName: true,
      customerEmail: true,
    },
  });
  if (!order) return null;

  await confirmWhishOrder(order);
  return order.orderNumber;
}
