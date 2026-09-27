import nodemailer from "nodemailer";

type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({ to, subject, html }: EmailPayload) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[email] SMTP not configured. Would send:", { to, subject });
    return { ok: false, skipped: true };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
  });

  return { ok: true };
}

export function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function money(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function adminEmail() {
  return process.env.ADMIN_EMAIL ?? process.env.SMTP_USER ?? "";
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
}

export async function notifyOrderPlaced(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  paymentMethod: "COD" | "CARD" | "WHISH";
  address: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: { name: string; size: string; quantity: number; price: number }[];
}) {
  const rows = order.items
    .map((i) => `<tr><td>${esc(i.name)} — ${esc(i.size)} × ${i.quantity}</td><td style="text-align:right">${money(i.price * i.quantity)}</td></tr>`)
    .join("");
  const table = `<table style="width:100%;border-collapse:collapse">${rows}
    <tr><td style="padding-top:8px">Subtotal</td><td style="text-align:right;padding-top:8px">${money(order.subtotal)}</td></tr>
    <tr><td>Delivery</td><td style="text-align:right">${order.deliveryFee ? money(order.deliveryFee) : "Free"}</td></tr>
    <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${money(order.total)}</strong></td></tr></table>`;
  const payment = order.paymentMethod === "COD" ? "Cash on delivery" : "Whish Money";

  const tasks: Promise<unknown>[] = [];
  if (order.customerEmail) {
    tasks.push(
      sendEmail({
        to: order.customerEmail,
        subject: `7.10 — Order ${order.orderNumber} received`,
        html: `<p>Hi ${esc(order.customerName)},</p>
          <p>Thanks for your order <strong>${order.orderNumber}</strong>. We'll call or WhatsApp you shortly to confirm it.</p>
          ${table}
          <p>Payment: ${payment}<br/>Delivering to: ${esc(order.address)}</p>
          <p>Track your order any time: <a href="${siteUrl()}/track">${siteUrl()}/track</a></p>`,
      }),
    );
  }

  const admin = adminEmail();
  if (admin) {
    tasks.push(
      sendEmail({
        to: admin,
        subject: `New web order ${order.orderNumber} — ${money(order.total)}`,
        html: `<p><strong>${esc(order.customerName)}</strong> · ${esc(order.customerPhone)}${order.customerEmail ? ` · ${esc(order.customerEmail)}` : ""}</p>
          ${table}
          <p>Payment: ${payment}<br/>Address: ${esc(order.address)}</p>`,
      }),
    );
  }

  await Promise.allSettled(tasks);
}

export async function notifyPaymentReceived(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  total: number;
}) {
  if (!order.customerEmail) return;
  await sendEmail({
    to: order.customerEmail,
    subject: `Payment received — Order ${order.orderNumber}`,
    html: `<p>Hi ${esc(order.customerName)},</p>
      <p>We received your payment of <strong>${money(order.total)}</strong> for order <strong>${order.orderNumber}</strong>.</p>
      <p>Thank you for shopping with 7.10.</p>`,
  });
}

export async function notifyOrderStatus(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  status: string;
}) {
  if (!order.customerEmail) return;
  await sendEmail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} — ${order.status}`,
    html: `<p>Hi ${esc(order.customerName)},</p>
      <p>Your order <strong>${order.orderNumber}</strong> is now <strong>${esc(order.status)}</strong>.</p>
      <p><a href="${siteUrl()}/track">Track your order</a></p>`,
  });
}

export async function notifyContactMessage(message: { name: string; email: string; subject: string; message: string }) {
  const admin = adminEmail();
  if (!admin) return;
  await sendEmail({
    to: admin,
    subject: `Contact: ${message.subject || "New message"}`,
    html: `<p><strong>${esc(message.name)}</strong> (${esc(message.email)}) wrote:</p>
      <blockquote style="white-space:pre-wrap">${esc(message.message)}</blockquote>`,
  });
}

export async function notifyLowStock(product: { name: string; size: string; color: string; stock: number }) {
  const admin = adminEmail();
  if (!admin) return;

  await sendEmail({
    to: admin,
    subject: `Low stock: ${product.name}`,
    html: `<p><strong>${esc(product.name)}</strong> (${esc(product.size)} / ${esc(product.color)}) is running low.</p>
      <p>Current stock: <strong>${product.stock}</strong></p>`,
  });
}

export async function notifyOutOfStock(product: { name: string; size: string; color: string }) {
  const admin = adminEmail();
  if (!admin) return;

  await sendEmail({
    to: admin,
    subject: `Out of stock: ${product.name}`,
    html: `<p><strong>${esc(product.name)}</strong> (${esc(product.size)} / ${esc(product.color)}) is now sold out.</p>`,
  });
}

export async function notifyNewComment(comment: { productName: string; authorName: string; authorEmail: string; content: string }) {
  const admin = adminEmail();
  if (!admin) return;

  await sendEmail({
    to: admin,
    subject: `New comment on ${comment.productName}`,
    html: `<p><strong>${esc(comment.authorName)}</strong> (${esc(comment.authorEmail)}) commented:</p>
      <blockquote>${esc(comment.content)}</blockquote>`,
  });
}

export async function notifyCommentReply(comment: { productName: string; authorEmail: string; reply: string }) {
  await sendEmail({
    to: comment.authorEmail,
    subject: `Reply to your comment on ${comment.productName}`,
    html: `<p>The store replied to your comment:</p>
      <blockquote>${esc(comment.reply)}</blockquote>`,
  });
}
