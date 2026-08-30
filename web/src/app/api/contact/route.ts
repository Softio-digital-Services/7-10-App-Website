import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyContactMessage } from "@/lib/notifications";

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const message = await prisma.contactMessage.create({ data: parsed.data });

  await notifyContactMessage({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    body: parsed.data.message,
  });

  return NextResponse.json(message, { status: 201 });
}
