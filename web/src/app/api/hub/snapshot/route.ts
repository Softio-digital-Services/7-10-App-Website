import { hubError } from "@/lib/hub/auth";

/**
 * Used to hand a joining laptop a full copy of the shop. The shop's data now lives only on its admin PC,
 * which publishes the catalogue here; nothing is ever downloaded from the website into a laptop.
 */
export async function GET() {
  return hubError("snapshot_disabled", 410);
}
