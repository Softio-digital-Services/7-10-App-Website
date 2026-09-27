/*
  Warnings:

  - You are about to drop the column `createdAt` on the `SyncChange` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SyncRow` table. All the data in the column will be lost.
  - Added the required column `at` to the `SyncChange` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncChange" (
    "seq" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceId" TEXT NOT NULL,
    "clientSeq" INTEGER NOT NULL,
    "tbl" TEXT NOT NULL,
    "gid" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "at" REAL NOT NULL
);
INSERT INTO "new_SyncChange" ("clientSeq", "data", "deviceId", "gid", "op", "seq", "tbl") SELECT "clientSeq", "data", "deviceId", "gid", "op", "seq", "tbl" FROM "SyncChange";
DROP TABLE "SyncChange";
ALTER TABLE "new_SyncChange" RENAME TO "SyncChange";
CREATE INDEX "SyncChange_at_idx" ON "SyncChange"("at");
CREATE UNIQUE INDEX "SyncChange_deviceId_clientSeq_key" ON "SyncChange"("deviceId", "clientSeq");
CREATE TABLE "new_SyncRow" (
    "tbl" TEXT NOT NULL,
    "gid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "seq" INTEGER NOT NULL,

    PRIMARY KEY ("tbl", "gid")
);
INSERT INTO "new_SyncRow" ("data", "deleted", "gid", "seq", "tbl") SELECT "data", "deleted", "gid", "seq", "tbl" FROM "SyncRow";
DROP TABLE "SyncRow";
ALTER TABLE "new_SyncRow" RENAME TO "SyncRow";
CREATE INDEX "SyncRow_tbl_deleted_idx" ON "SyncRow"("tbl", "deleted");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
