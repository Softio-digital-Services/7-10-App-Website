import { NextResponse } from "next/server";
import { rememberedOrders } from "@/lib/orders";
import { settleWhishPayment } from "@/lib/whish-settle";

export async function GET(request: Request) {
  const number = await settleWhishPayment(request.url).catch((err) => {
    console.error("[whish:failure]", err);
    return null;
  });
  // Only the shopper who placed the order is sent to it; anyone else learns nothing from the externalId.
  const own = number && (await rememberedOrders()).includes(number);
  const dest = own ? `/order/${encodeURIComponent(number)}?pay=failed` : "/track?pay=failed";
  return NextResponse.redirect(new URL(dest, request.url));
}

export async function POST(request: Request) {
  return GET(request);
}
