/*
  Warnings:

  - You are about to drop the column `desktopOrderId` on the `Order` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "SyncDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "appVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SyncChange" (
    "seq" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceId" TEXT NOT NULL,
    "clientSeq" INTEGER NOT NULL,
    "tbl" TEXT NOT NULL,
    "gid" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncRow" (
    "tbl" TEXT NOT NULL,
    "gid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "seq" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("tbl", "gid")
);

-- CreateTable
CREATE TABLE "SyncCounter" (
    "tbl" TEXT NOT NULL,
    "gid" TEXT NOT NULL,
    "col" TEXT NOT NULL,
    "value" REAL NOT NULL DEFAULT 0,

    PRIMARY KEY ("tbl", "gid", "col")
);

-- CreateTable
CREATE TABLE "SyncMeta" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "externalId" TEXT,
    "userId" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL DEFAULT 'COD',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "desktopRef" TEXT,
    "claimedBy" TEXT,
    "claimedAt" DATETIME,
    "syncError" TEXT,
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("city", "createdAt", "customerEmail", "customerName", "customerPhone", "deliveryFee", "externalId", "id", "locale", "notes", "orderNumber", "paymentMethod", "paymentStatus", "region", "shippingAddress", "source", "status", "subtotal", "syncedAt", "total", "updatedAt", "userId") SELECT "city", "createdAt", "customerEmail", "customerName", "customerPhone", "deliveryFee", "externalId", "id", "locale", "notes", "orderNumber", "paymentMethod", "paymentStatus", "region", "shippingAddress", "source", "status", "subtotal", "syncedAt", "total", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_externalId_key" ON "Order"("externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SyncChange_createdAt_idx" ON "SyncChange"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncChange_deviceId_clientSeq_key" ON "SyncChange"("deviceId", "clientSeq");

-- CreateIndex
CREATE INDEX "SyncRow_tbl_deleted_idx" ON "SyncRow"("tbl", "deleted");
