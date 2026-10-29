import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HOUR, limitByIp } from "@/lib/rate-limit";

const schema = z.object({
  contact: z.string().trim().min(5).max(120),
  locale: z.enum(["en", "ar"]).default("en"),
  /** Honeypot: hidden from people, filled in by bots. */
  website: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const limited = await limitByIp(request, "subscribe", 10, HOUR);
  if (limited) return limited;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid contact" }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ ok: true }, { status: 201 });

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
