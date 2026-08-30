import { notifyCommentReply, notifyNewComment, sendEmail } from "@/lib/email";

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
    html: `<p><strong>${request.memberName}</strong> (${request.memberEmail}) requested:</p>
      <blockquote>${request.message}</blockquote>
      <p>Product: <strong>${request.productName}</strong></p>`,
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
      <blockquote>${request.response}</blockquote>`,
  });
}

export async function notifyBackInStock(product: {
  name: string;
  email: string;
  productUrl: string;
}) {
  await sendEmail({
    to: product.email,
    subject: `${product.name} is back in stock`,
    html: `<p>Good news! <strong>${product.name}</strong> is back in stock.</p>
      <p><a href="${product.productUrl}">Shop now</a></p>`,
  });
}

export async function notifyContactMessage(message: {
  name: string;
  email: string;
  subject: string;
  body: string;
}) {
  const admin = process.env.ADMIN_EMAIL ?? process.env.SMTP_USER ?? "";
  if (!admin) return;

  await sendEmail({
    to: admin,
    subject: `Contact: ${message.subject}`,
    html: `<p>From <strong>${message.name}</strong> (${message.email})</p>
      <p>${message.body}</p>`,
  });
}

export { notifyNewComment, notifyCommentReply };
