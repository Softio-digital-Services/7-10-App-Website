import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { markAccountDirty } from "@/lib/hub/accounts";
import { prisma } from "@/lib/prisma";

/** The signed-in customer's wishlist: GET lists product ids, POST adds one, DELETE removes one. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ signedIn: false, ids: [] });
  const rows = await prisma.wishlistItem.findMany({ where: { userId: session.user.id }, select: { productId: true } });
  return NextResponse.json({ signedIn: true, ids: rows.map((r) => r.productId) });
}

const body = z.object({ productId: z.string().min(1).max(64) });

async function change(req: Request, add: boolean) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "signin" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { productId } = parsed.data;
  if (add) {
    const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: session.user.id, productId } },
      update: {},
      create: { userId: session.user.id, productId },
    });
  } else {
    await prisma.wishlistItem.deleteMany({ where: { userId: session.user.id, productId } });
  }
  await markAccountDirty(session.user.id);
  return NextResponse.json({ ok: true, saved: add });
}

export const POST = (req: Request) => change(req, true);
export const DELETE = (req: Request) => change(req, false);
