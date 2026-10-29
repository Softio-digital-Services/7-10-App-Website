import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Fixed-window counters kept in the database, so every serverless instance shares them
 * (an in-memory Map resets on each cold start and differs per instance).
 */

/** The visitor's IP. Netlify sets x-nf-client-connection-ip itself; the client cannot forge it. */
export function clientIp(request: Request) {
  return (
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

/** Counts one hit on `key`; true when it is over `max` hits inside `windowMs`. Fails open if the database is unreachable. */
export async function isRateLimited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  try {
    const rows = await prisma.$queryRawUnsafe<{ count: number | bigint }[]>(
      `INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (?, 1, ?)
       ON CONFLICT("key") DO UPDATE SET
         "count" = CASE WHEN "RateLimit"."resetAt" < ? THEN 1 ELSE "RateLimit"."count" + 1 END,
         "resetAt" = CASE WHEN "RateLimit"."resetAt" < ? THEN excluded."resetAt" ELSE "RateLimit"."resetAt" END
       RETURNING "count"`,
      key,
      now + windowMs,
      now,
      now,
    );
    // Old windows are swept now and then rather than on every request.
    if (Math.random() < 0.01) {
      await prisma.$executeRawUnsafe(`DELETE FROM "RateLimit" WHERE "resetAt" < ?`, now);
    }
    return Number(rows[0]?.count ?? 0) > max;
  } catch (err) {
    console.error("[rate-limit]", err);
    return false;
  }
}

/** Per-IP limit for a route: returns a 429 response when the visitor is over it, otherwise null. */
export async function limitByIp(request: Request, route: string, max: number, windowMs: number) {
  if (await isRateLimited(`${route}:${clientIp(request)}`, max, windowMs)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }
  return null;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
