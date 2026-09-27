import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyLowStock, notifyOutOfStock } from "@/lib/email";
import { notifyBackInStock } from "@/lib/notifications";
import { store } from "@/lib/store-config";

const threshold = () => Number(process.env.LOW_STOCK_THRESHOLD ?? store.lowStockAt);
const siteUrl = () => store.siteUrl;

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function setVariantStock(
  variantId: string,
  stock: number,
  db: DbClient = prisma,
) {
  const before = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });

  if (!before) throw new Error("Variant not found");

  const wasOut = before.stock <= 0;
  const updated = await db.productVariant.update({
    where: { id: variantId },
    data: { stock },
    include: { product: true },
  });

  await checkStockAlerts(updated, db);

  if (wasOut && stock > 0) {
    await notifyProductBackInStock(updated.product.id, updated.product.slug, updated.product.name, db);
  }

  return updated;
}

async function notifyProductBackInStock(
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

export async function decrementStock(
  variantId: string,
  quantity: number,
  db: DbClient = prisma,
) {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });

  if (!variant) {
    throw new Error("Variant not found");
  }

  if (variant.stock < quantity) {
    throw new Error(`Insufficient stock for ${variant.product.name}`);
  }

  const newStock = variant.stock - quantity;

  const updated = await db.productVariant.update({
    where: { id: variantId },
    data: { stock: newStock },
    include: { product: true },
  });

  await checkStockAlerts(updated, db);

  return updated;
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
