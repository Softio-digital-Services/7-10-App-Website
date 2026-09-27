import { NextResponse } from "next/server";
import { z } from "zod";
import { authDevice, hubError } from "@/lib/hub/auth";
import { MAX_MEDIA_BYTES, isMediaName, missingMedia, saveMedia } from "@/lib/hub/media";
import { markStorefrontDirty } from "@/lib/hub/storefront";

/** Which of these content-hash file names the hub doesn't have yet. */
export async function GET(request: Request) {
  const auth = await authDevice(request);
  if (auth.error) return auth.error;

  const names = (new URL(request.url).searchParams.get("names") ?? "").split(",").filter(Boolean).slice(0, 200);
  return NextResponse.json({ missing: await missingMedia(names) });
}

const uploadSchema = z.object({ name: z.string().refine(isMediaName), data: z.string().min(1) });

export async function PUT(request: Request) {
  const auth = await authDevice(request);
  if (auth.error) return auth.error;

  const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return hubError("invalid", 400);

  const bytes = Buffer.from(parsed.data.data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_MEDIA_BYTES) return hubError("too_large", 413);

  const url = await saveMedia(parsed.data.name, bytes);
  await markStorefrontDirty();
  return NextResponse.json({ url }, { status: 201 });
}
