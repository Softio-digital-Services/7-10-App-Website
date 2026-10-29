import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyLowStock, notifyOutOfStock } from "@/lib/email";
import { notifyBackInStock } from "@/lib/notifications";
import { store } from "@/lib/store-config";

const threshold = () => Number(process.env.LOW_STOCK_THRESHOLD ?? store.lowStockAt);
const siteUrl = () => store.siteUrl;

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Emails everyone waiting on this product, once, then marks them notified. */
export async function notifyProductBackInStock(
  productId: string,
  slug: string,
  name: string,
  db: DbClient = prisma,
) {
  const subscribers = await db.stockNotification.findMany({
    where: { productId, notified: false },
  });

  for (const sub of subscribers) {
    await notifyBackInStock({
      name,
      email: sub.email,
      productUrl: `${siteUrl()}/products/${slug}`,
    });
    await db.stockNotification.update({
      where: { id: sub.id },
      data: { notified: true },
    });
  }
}

export async function checkStockAlerts(
  variant: {
    id: string;
    stock: number;
    size: string;
    color: string;
    lowStockAlert: boolean;
    outOfStockAlert: boolean;
    product: { name: string };
  },
  db: DbClient = prisma,
) {
  const low = threshold();

  if (variant.stock <= 0 && !variant.outOfStockAlert) {
    await db.productVariant.update({
      where: { id: variant.id },
      data: { outOfStockAlert: true, lowStockAlert: true },
    });
    await notifyOutOfStock({
      name: variant.product.name,
      size: variant.size,
      color: variant.color,
    });
    return;
  }

  if (variant.stock > 0 && variant.stock <= low && !variant.lowStockAlert) {
    await db.productVariant.update({
      where: { id: variant.id },
      data: { lowStockAlert: true },
    });
    await notifyLowStock({
      name: variant.product.name,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
    });
  }

  if (variant.stock > low) {
    await db.productVariant.update({
      where: { id: variant.id },
      data: { lowStockAlert: false, outOfStockAlert: false },
    });
  }
}
