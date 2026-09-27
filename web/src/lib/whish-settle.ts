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
  if (status.collectStatus === "success" && amountsMatch(status.amount, order.total)) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });
    if (order.customerEmail) {
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

/** Confirms with Whish (never trust the URL alone), then marks the order paid or failed. */
export async function settleWhishPayment(requestUrl: string, outcome: "success" | "failure") {
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

  const next = await confirmWhishOrder(order);
  if (next === "PAID") return order.orderNumber;
  if (outcome === "failure" && next === "PENDING") {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
  }
  return order.orderNumber;
}
