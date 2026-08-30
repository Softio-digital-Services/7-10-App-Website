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

function adminEmail() {
  return process.env.ADMIN_EMAIL ?? process.env.SMTP_USER ?? "";
}

export async function notifyPaymentReceived(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
}) {
  const admin = adminEmail();
  const tasks = [
    sendEmail({
      to: order.customerEmail,
      subject: `Payment received — Order ${order.orderNumber}`,
      html: `<p>Hi ${order.customerName},</p>
        <p>We received your payment of <strong>$${order.total.toFixed(2)}</strong> for order <strong>${order.orderNumber}</strong>.</p>
        <p>Thank you for shopping with 7-10 Store!</p>`,
    }),
  ];

  if (admin) {
    tasks.push(
      sendEmail({
        to: admin,
        subject: `New paid order ${order.orderNumber}`,
        html: `<p>New payment received from ${order.customerName} (${order.customerEmail}).</p>
          <p>Order: <strong>${order.orderNumber}</strong> — $${order.total.toFixed(2)}</p>`,
      }),
    );
  }

  await Promise.all(tasks);
}

export async function notifyOrderStatus(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
}) {
  await sendEmail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} — ${order.status}`,
    html: `<p>Hi ${order.customerName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> is now <strong>${order.status}</strong>.</p>`,
  });
}

export async function notifyLowStock(product: {
  name: string;
  size: string;
  color: string;
  stock: number;
}) {
  const admin = adminEmail();
  if (!admin) return;

  await sendEmail({
    to: admin,
    subject: `Low stock: ${product.name}`,
    html: `<p><strong>${product.name}</strong> (${product.size} / ${product.color}) is running low.</p>
      <p>Current stock: <strong>${product.stock}</strong></p>`,
  });
}

export async function notifyOutOfStock(product: {
  name: string;
  size: string;
  color: string;
}) {
  const admin = adminEmail();
  if (!admin) return;

  await sendEmail({
    to: admin,
    subject: `Out of stock: ${product.name}`,
    html: `<p><strong>${product.name}</strong> (${product.size} / ${product.color}) is now sold out.</p>`,
  });
}

export async function notifyNewComment(comment: {
  productName: string;
  authorName: string;
  authorEmail: string;
  content: string;
}) {
  const admin = adminEmail();
  if (!admin) return;

  await sendEmail({
    to: admin,
    subject: `New comment on ${comment.productName}`,
    html: `<p><strong>${comment.authorName}</strong> (${comment.authorEmail}) commented:</p>
      <blockquote>${comment.content}</blockquote>`,
  });
}

export async function notifyCommentReply(comment: {
  productName: string;
  authorEmail: string;
  reply: string;
}) {
  await sendEmail({
    to: comment.authorEmail,
    subject: `Reply to your comment on ${comment.productName}`,
    html: `<p>The store replied to your comment:</p>
      <blockquote>${comment.reply}</blockquote>`,
  });
}
