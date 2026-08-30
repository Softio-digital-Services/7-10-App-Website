import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyNewComment } from "@/lib/email";

const commentSchema = z.object({
  productId: z.string(),
  authorName: z.string().min(2),
  authorEmail: z.string().email(),
  content: z.string().min(3).max(1000),
});

export async function POST(request: Request) {
  const session = await auth();
  const body = await request.json();
  const parsed = commentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { productId, authorName, authorEmail, content } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: {
      productId,
      userId: session?.user?.id,
      authorName,
      authorEmail,
      content,
    },
  });

  await notifyNewComment({
    productName: product.name,
    authorName,
    authorEmail,
    content,
  });

  return NextResponse.json(comment, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const schema = z.object({
    commentId: z.string(),
    reply: z.string().min(1).max(1000),
  });
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const comment = await prisma.comment.update({
    where: { id: parsed.data.commentId },
    data: { reply: parsed.data.reply },
    include: { product: true },
  });

  await import("@/lib/email").then(({ notifyCommentReply }) =>
    notifyCommentReply({
      productName: comment.product.name,
      authorEmail: comment.authorEmail,
      reply: parsed.data.reply,
    }),
  );

  return NextResponse.json(comment);
}
