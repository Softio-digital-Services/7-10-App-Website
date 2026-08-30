import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const comments = await prisma.comment.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comments);
}
