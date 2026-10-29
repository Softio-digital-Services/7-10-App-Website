import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// A live server without a database would show an empty shop instead of failing, so it refuses to start.
// `next build` runs with NODE_ENV=production too and is allowed through (pages that need data render at request time).
if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("DATABASE_URL is not set. Point it at the Turso libsql:// URL (see HOSTING.md).");
  }
  process.env.DATABASE_URL = "file:./dev.db";
}
if (/^libsql:\/\//.test(process.env.DATABASE_URL) && !process.env.DATABASE_AUTH_TOKEN) {
  throw new Error("DATABASE_AUTH_TOKEN is not set for the Turso database.");
}

/** `libsql://` / `https://` URLs point at a hosted Turso database; `file:` URLs use the local SQLite file. */
function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const log: ("error" | "warn")[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
  if (/^(libsql|https?|wss?):\/\//.test(url)) {
    return new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken: process.env.DATABASE_AUTH_TOKEN }), log });
  }
  return new PrismaClient({ log });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
