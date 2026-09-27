import { esc, notifyCommentReply, notifyContactMessage, notifyNewComment, sendEmail } from "@/lib/email";

export async function notifyNewProductRequest(request: {
  productName: string;
  memberName: string;
  memberEmail: string;
  message: string;
}) {
  const admin = process.env.ADMIN_EMAIL ?? process.env.SMTP_USER ?? "";
  if (!admin) return;

  await sendEmail({
    to: admin,
    subject: `Product request: ${request.productName}`,
    html: `<p><strong>${esc(request.memberName)}</strong> (${esc(request.memberEmail)}) requested:</p>
      <blockquote>${esc(request.message)}</blockquote>
      <p>Product: <strong>${esc(request.productName)}</strong></p>`,
  });
}

export async function notifyRequestReply(request: {
  productName: string;
  memberEmail: string;
  response: string;
}) {
  await sendEmail({
    to: request.memberEmail,
    subject: `Reply to your request for ${request.productName}`,
    html: `<p>The store replied to your product request:</p>
      <blockquote>${esc(request.response)}</blockquote>`,
  });
}

export async function notifyBackInStock(product: {
  name: string;
  email: string;
  productUrl: string;
}) {
  await sendEmail({
    to: product.email,
    subject: `${product.name} is back in stock — 7.10`,
    html: `<p>Good news! <strong>${esc(product.name)}</strong> is back in stock.</p>
      <p><a href="${product.productUrl}">Shop now</a></p>`,
  });
}

export { notifyContactMessage, notifyNewComment, notifyCommentReply };
