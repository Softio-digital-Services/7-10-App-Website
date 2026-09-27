import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkShopKey, hashToken, hubError, newDeviceId, newToken } from "@/lib/hub/auth";
import { getMeta, hubState, setMeta } from "@/lib/hub/store";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  /** create = first laptop uploads its data; join = download the shop's data */
  mode: z.enum(["create", "join"]),
  appVersion: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const denied = checkShopKey(request);
  if (denied) return denied;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return hubError("invalid", 400);
  const { name, mode, appVersion } = parsed.data;

  const token = newToken();
  const id = newDeviceId();

  const outcome = await prisma.$transaction(async (tx) => {
    const state = await hubState(tx);
    if (mode === "create" && state !== "empty") return { error: "shop_exists", state };
    if (mode === "join" && state !== "ready") return { error: state === "empty" ? "shop_empty" : "shop_founding", state };

    await tx.syncDevice.create({ data: { id, name, tokenHash: hashToken(token), appVersion, lastSeenAt: new Date() } });
    if (mode === "create") {
      await setMeta("state", "founding", tx);
      await setMeta("founder", id, tx);
      // Shared by every laptop of the shop to encrypt sensitive columns (staff passwords) before upload.
      await setMeta("secret", randomBytes(32).toString("base64"), tx);
    }
    return { state: mode === "create" ? "founding" : state, secret: await getMeta("secret", tx) };
  });

  if ("error" in outcome) return hubError(outcome.error as string, 409, { state: outcome.state });
  return NextResponse.json({ deviceId: id, token, state: outcome.state, secret: outcome.secret }, { status: 201 });
}
