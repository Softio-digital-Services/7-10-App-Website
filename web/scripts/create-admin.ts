import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";

/**
 * Creates the store admin account on the live (Turso) or local database. No demo products.
 *
 *   npm run admin:create -- owner@example.com
 *   npm run admin:create -- owner@example.com --reset   (existing account: new password + ADMIN role)
 *
 * The password is read from ADMIN_PASSWORD, or asked for, so it never lands in shell history.
 */
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const email = (args.find((a) => !a.startsWith("--")) ?? process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: npm run admin:create -- <email> [--reset]");
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = (await rl.question(`Password for ${email} (12+ characters): `)).trim();
    rl.close();
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }

  // Imported after .env is loaded so the client picks up DATABASE_URL.
  const { prisma } = await import("../src/lib/prisma");
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });

  // Someone could have registered this email as a customer before you; --reset replaces their password, so the account is yours.
  if (existing && !reset) {
    console.error(`${email} already has an account (${existing.role}). Re-run with --reset to set a new password and make it ADMIN.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN", passwordHash } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.account.deleteMany({ where: { userId: existing.id } });
  } else {
    await prisma.user.create({ data: { email, name: "7.10 Admin", role: "ADMIN", passwordHash } });
  }

  console.log(`Admin ready: ${email}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
