import { NextResponse } from "next/server";
import { settleWhishPayment } from "@/lib/whish-settle";

export async function GET(request: Request) {
  const number = await settleWhishPayment(request.url, "success").catch((err) => {
    console.error("[whish:success]", err);
    return null;
  });
  const dest = number ? `/order/${encodeURIComponent(number)}?pay=ok` : "/track?pay=ok";
  return NextResponse.redirect(new URL(dest, request.url));
}

export async function POST(request: Request) {
  return GET(request);
}
