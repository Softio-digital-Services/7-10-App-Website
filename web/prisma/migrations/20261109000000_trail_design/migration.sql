-- Fields for the trail website design, filled from the desktop app.
ALTER TABLE "Category" ADD COLUMN "nameAr" TEXT;
ALTER TABLE "Category" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Category" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "spec" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "styleCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "isNewFlag" BOOLEAN NOT NULL DEFAULT false;
