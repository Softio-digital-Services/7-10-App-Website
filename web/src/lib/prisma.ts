import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Ensure DATABASE_URL is set so PrismaClient never fails to initialize
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
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
