import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkShopKey } from "@/lib/hub/auth";
import { hubState } from "@/lib/hub/store";

/** Lets a laptop check the shop key and whether it should create the shop or join it. */
export async function GET(request: Request) {
  const denied = checkShopKey(request);
  if (denied) return denied;

  const [state, devices] = await Promise.all([
    hubState(),
    prisma.syncDevice.count({ where: { revokedAt: null } }),
  ]);
  return NextResponse.json({ state, devices });
}
