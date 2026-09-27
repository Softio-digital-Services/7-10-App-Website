import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ id: z.string().min(1) });

export async function PATCH(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const device = await prisma.syncDevice.update({ where: { id: parsed.data.id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ id: device.id, revokedAt: device.revokedAt });
}
