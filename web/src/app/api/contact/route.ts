import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyContactMessage } from "@/lib/email";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  subject: z.string().trim().max(200).default(""),
  message: z.string().trim().min(10).max(5000),
});

export async function POST(request: Request) {
  const parsed = contactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", fields: Object.keys(parsed.error.flatten().fieldErrors) }, { status: 400 });
  }

  const message = await prisma.contactMessage.create({ data: parsed.data });
  after(() => notifyContactMessage(parsed.data).catch((error) => console.error("[contact]", error)));

  return NextResponse.json({ id: message.id }, { status: 201 });
}
