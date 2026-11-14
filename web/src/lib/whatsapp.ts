import { store } from "@/lib/store-config";

/**
 * WhatsApp alert to the brand when a website order is placed. Two ways to send, chosen by what is configured:
 *
 *  - CallMeBot (free, for alerts to your own number): set CALLMEBOT_APIKEY. The receiving number activates it
 *    once by sending "I allow callmebot to send me messages" to the CallMeBot number (see HOSTING.md).
 *  - WhatsApp Cloud API (Meta, official): set WHATSAPP_CLOUD_TOKEN and WHATSAPP_PHONE_NUMBER_ID. Messages to a
 *    number that has not written to you in the last 24h need an approved template: set WHATSAPP_CLOUD_TEMPLATE
 *    (one body variable, filled with the order text) and optionally WHATSAPP_CLOUD_TEMPLATE_LANG (default "en").
 *
 * Recipient: WHATSAPP_NOTIFY_TO, else the brand's WhatsApp number. Never throws: an order must not fail
 * because a notification could not be sent.
 */
export type OrderAlert = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "COD" | "CARD" | "WHISH";
  address: string;
  total: number;
  items: { name: string; size: string; quantity: number; price: number }[];
};

const money = (n: number) => `$${n.toFixed(2)}`;
const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function orderAlertText(o: OrderAlert, siteUrl: string) {
  const payment = o.paymentMethod === "COD" ? "Cash on delivery" : o.paymentMethod === "WHISH" ? "Whish Money" : "Card";
  const items = o.items.map((i) => `• ${i.name} (${i.size}) × ${i.quantity} — ${money(i.price * i.quantity)}`).join("\n");
  return [
    `New website order ${o.orderNumber}`,
    `${o.customerName} · ${o.customerPhone}`,
    items,
    `Total: ${money(o.total)} (${payment})`,
    `Deliver to: ${o.address}`,
    `${siteUrl}/admin/orders`,
  ].join("\n");
}

async function post(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

export async function notifyOrderOnWhatsApp(order: OrderAlert, siteUrl: string) {
  const to = digitsOnly(process.env.WHATSAPP_NOTIFY_TO || store.whatsapp || "");
  if (!to) return;
  const text = orderAlertText(order, siteUrl);
  try {
    const token = process.env.WHATSAPP_CLOUD_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (token && phoneId) {
      const template = process.env.WHATSAPP_CLOUD_TEMPLATE;
      const body = template
        ? {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: template,
              language: { code: process.env.WHATSAPP_CLOUD_TEMPLATE_LANG || "en" },
              // Templates do not allow line breaks inside a variable
              components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\n+/g, " · ") }] }],
            },
          }
        : { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
      await post(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return;
    }
    const apiKey = process.env.CALLMEBOT_APIKEY;
    if (apiKey) {
      const qs = new URLSearchParams({ phone: `+${to}`, text, apikey: apiKey });
      await post(`https://api.callmebot.com/whatsapp.php?${qs}`, { method: "GET" });
    }
  } catch (error) {
    console.error("[whatsapp] order alert failed", error);
  }
}
