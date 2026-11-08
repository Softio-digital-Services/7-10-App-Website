-- Customer accounts sync with the desktop app (web_accounts / web_addresses).
ALTER TABLE "User" ADD COLUMN "hubSyncedAt" DATETIME;
ALTER TABLE "Address" ADD COLUMN "hubGid" TEXT;
CREATE UNIQUE INDEX "Address_hubGid_key" ON "Address"("hubGid");
