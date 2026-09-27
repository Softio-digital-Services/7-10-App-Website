import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  contact: z.string().trim().min(5).max(120),
  locale: z.enum(["en", "ar"]).default("en"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid contact" }, { status: 400 });
  }

  const raw = parsed.data.contact;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
  const digits = raw.replace(/\D/g, "");
  if (!isEmail && digits.length < 7) {
    return NextResponse.json({ error: "Invalid contact" }, { status: 400 });
  }

  const contact = isEmail ? raw.toLowerCase() : digits;
  await prisma.subscriber.upsert({
    where: { contact },
    update: { locale: parsed.data.locale },
    create: { contact, locale: parsed.data.locale },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
