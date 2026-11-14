import { existsSync } from "node:fs";

/**
 * Removes business data that older versions stored on the website (sales, costs, expenses, suppliers, staff,
 * the shop's customer list, stock counters). The public catalogue and website accounts stay.
 * Run once after updating: npm run hub:purge
 */
async function main() {
  // Load .env before the database client is imported (it reads DATABASE_URL on import)
  if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
  const { prisma } = await import("../src/lib/prisma");
  const { purgeNonWebsiteData } = await import("../src/lib/hub/purge");
  try {
    const result = await purgeNonWebsiteData(prisma);
    console.log(`Removed ${result.rows} stored rows, ${result.log} log entries and ${result.counters} stock counters; scrubbed private columns from ${result.scrubbed} catalogue rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
