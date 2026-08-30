import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertCategory(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return prisma.category.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const passwordHash = await bcrypt.hash("Admin123!", 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", passwordHash },
    create: {
      email: adminEmail,
      name: "Store Admin",
      role: "ADMIN",
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: { role: "MANAGER", passwordHash },
    create: {
      email: "manager@example.com",
      name: "Store Manager",
      role: "MANAGER",
      passwordHash,
    },
  });

  const tops = await upsertCategory("Tops");
  const outerwear = await upsertCategory("Outerwear");
  const dresses = await upsertCategory("Dresses");
  const bottoms = await upsertCategory("Bottoms");

  const products = [
    {
      externalId: "otg-tee-001",
      name: "Classic Cotton Tee",
      slug: "classic-cotton-tee",
      description: "Soft everyday tee with a relaxed fit.",
      price: 29.99,
      discount: 10,
      imageUrl:
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
      category: tops,
      variants: [
        { externalId: "otg-tee-001-s-white", size: "S", color: "White", stock: 12 },
        { externalId: "otg-tee-001-m-white", size: "M", color: "White", stock: 4 },
        { externalId: "otg-tee-001-l-black", size: "L", color: "Black", stock: 0 },
      ],
    },
    {
      externalId: "otg-jacket-001",
      name: "Denim Jacket",
      slug: "denim-jacket",
      description: "Lightweight denim jacket for layering.",
      price: 89.99,
      discount: 0,
      imageUrl:
        "https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=800&q=80",
      category: outerwear,
      variants: [
        { externalId: "otg-jacket-001-m-blue", size: "M", color: "Blue", stock: 8 },
        { externalId: "otg-jacket-001-l-blue", size: "L", color: "Blue", stock: 3 },
      ],
    },
    {
      externalId: "otg-dress-001",
      name: "Linen Summer Dress",
      slug: "linen-summer-dress",
      description: "Breathable linen dress for warm days.",
      price: 74.5,
      discount: 15,
      imageUrl:
        "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80",
      category: dresses,
      variants: [
        { externalId: "otg-dress-001-s-sand", size: "S", color: "Sand", stock: 6 },
        { externalId: "otg-dress-001-m-sand", size: "M", color: "Sand", stock: 5 },
        { externalId: "otg-dress-001-l-olive", size: "L", color: "Olive", stock: 2 },
      ],
    },
    {
      externalId: "otg-joggers-001",
      name: "Athletic Joggers",
      slug: "athletic-joggers",
      description: "Comfortable joggers for training or lounging.",
      price: 54.0,
      discount: 0,
      imageUrl:
        "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=800&q=80",
      category: bottoms,
      variants: [
        { externalId: "otg-joggers-001-m-gray", size: "M", color: "Gray", stock: 10 },
        { externalId: "otg-joggers-001-l-gray", size: "L", color: "Gray", stock: 7 },
        { externalId: "otg-joggers-001-xl-black", size: "XL", color: "Black", stock: 1 },
      ],
    },
  ];

  for (const product of products) {
    const created = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        externalId: product.externalId,
        discount: product.discount,
        categoryId: product.category.id,
        category: product.category.name,
        price: product.price,
        description: product.description,
        imageUrl: product.imageUrl,
      },
      create: {
        externalId: product.externalId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        discount: product.discount,
        imageUrl: product.imageUrl,
        category: product.category.name,
        categoryId: product.category.id,
      },
    });

    for (const variant of product.variants) {
      await prisma.productVariant.upsert({
        where: {
          productId_size_color: {
            productId: created.id,
            size: variant.size,
            color: variant.color,
          },
        },
        update: {
          externalId: variant.externalId,
          stock: variant.stock,
        },
        create: {
          externalId: variant.externalId,
          productId: created.id,
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
