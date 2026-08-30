import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyNewProductRequest, notifyRequestReply } from "@/lib/notifications";

const requestSchema = z.object({
  productId: z.string(),
  message: z.string().min(10).max(2000),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isStaff = session.user.role === "ADMIN" || session.user.role === "MANAGER";

  const requests = await prisma.productRequest.findMany({
    where: isStaff ? {} : { memberId: session.user.id },
    include: {
      product: true,
      member: { select: { name: true, email: true } },
      manager: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const manager = await prisma.user.findFirst({
    where: { role: "MANAGER" },
    select: { id: true },
  });

  const productRequest = await prisma.productRequest.create({
    data: {
      productId: product.id,
      memberId: session.user.id,
      managerId: manager?.id,
      message: parsed.data.message,
    },
    include: { product: true, member: true },
  });

  await notifyNewProductRequest({
    productName: product.name,
    memberName: productRequest.member.name ?? "Customer",
    memberEmail: productRequest.member.email,
    message: parsed.data.message,
  });

  return NextResponse.json(productRequest, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const schema = z.object({
    requestId: z.string(),
    response: z.string().min(1).max(2000),
    status: z.enum(["REVIEWED", "CLOSED"]).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.productRequest.update({
    where: { id: parsed.data.requestId },
    data: {
      response: parsed.data.response,
      status: parsed.data.status ?? "REVIEWED",
      managerId: session.user.id,
    },
    include: { product: true, member: true },
  });

  await notifyRequestReply({
    productName: updated.product.name,
    memberEmail: updated.member.email,
    response: parsed.data.response,
  });

  return NextResponse.json(updated);
}
