import { NextResponse } from "next/server";
import { authDevice, hubError } from "@/lib/hub/auth";
import { getMeta, hubState, setMeta } from "@/lib/hub/store";
import { markStorefrontDirty, refreshStorefront } from "@/lib/hub/storefront";

export const maxDuration = 60;

/** The first laptop finished uploading its data: open the shop to other laptops and publish the catalogue. */
export async function POST(request: Request) {
  const auth = await authDevice(request);
  if (auth.error) return auth.error;

  const state = await hubState();
  if (state === "ready") return NextResponse.json({ state });
  if (state !== "founding" || (await getMeta("founder")) !== auth.device.id) return hubError("not_founder", 409, { state });

  await setMeta("state", "ready");
  await markStorefrontDirty();
  // A large first catalogue finishes over the next few sync exchanges.
  const storefront = await refreshStorefront().catch((err) => {
    console.error("refreshStorefront failed", err);
    return null;
  });
  return NextResponse.json({ state: "ready", storefront });
}
