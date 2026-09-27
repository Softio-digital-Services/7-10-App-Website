import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&h=1600&q=80`;

const categories = [
  { name: "T-Shirts", slug: "t-shirts" },
  { name: "Hoodies & Sweats", slug: "hoodies-sweats" },
  { name: "Outerwear", slug: "outerwear" },
  { name: "Bottoms", slug: "bottoms" },
  { name: "Accessories", slug: "accessories" },
];

type Demo = {
  key: string;
  name: string;
  nameAr: string;
  category: string;
  price: number;
  discount?: number;
  featured?: boolean;
  color: string;
  images: string[];
  stock: Record<string, number>;
  daysAgo: number;
  description: string;
  descriptionAr: string;
};

const products: Demo[] = [
  {
    key: "signal-tee-bone",
    name: "Signal Tee — Bone",
    nameAr: "تيشيرت سيغنال — عظمي",
    category: "t-shirts",
    price: 28,
    featured: true,
    color: "Bone",
    images: ["1521572163474-6864f9cf17ab", "1581655353564-df123a1eb820", "1586790170083-2f9ceadc732d"],
    stock: { S: 12, M: 18, L: 10, XL: 6, XXL: 3 },
    daysAgo: 2,
    description:
      "Heavyweight cotton tee with a boxy, dropped-shoulder fit. Ribbed crew neck, double-stitched hems and a small signal-red tab at the hem.",
    descriptionAr: "تيشيرت قطني ثقيل بقصّة مربّعة وأكتاف منسدلة. ياقة دائرية مضلّعة، خياطة مزدوجة، وشريط أحمر صغير عند الحافة.",
  },
  {
    key: "core-tee-black",
    name: "Core Tee — Black",
    nameAr: "تيشيرت كور — أسود",
    category: "t-shirts",
    price: 28,
    color: "Black",
    images: ["1618517351616-38fb9c5210c6", "1583743814966-8936f5b7be1a", "1618354691373-d851c5c3a990"],
    stock: { S: 8, M: 14, L: 9, XL: 4, XXL: 0 },
    daysAgo: 45,
    description: "The everyday black tee, done properly. Dense cotton jersey that holds its shape wash after wash.",
    descriptionAr: "التيشيرت الأسود اليومي كما يجب. قطن كثيف يحافظ على شكله غسلة بعد غسلة.",
  },
  {
    key: "logo-tee-white",
    name: "Logo Tee — White",
    nameAr: "تيشيرت الشعار — أبيض",
    category: "t-shirts",
    price: 30,
    color: "White",
    images: ["1622445275463-afa2ab738c34", "1581655353564-df123a1eb820"],
    stock: { S: 5, M: 7, L: 6, XL: 2 },
    daysAgo: 5,
    description: "Clean white tee with a small chest print. Relaxed fit, soft hand-feel, built for daily rotation.",
    descriptionAr: "تيشيرت أبيض نظيف مع طبعة صغيرة على الصدر. قصّة مريحة وملمس ناعم للاستخدام اليومي.",
  },
  {
    key: "summit-graphic-tee",
    name: "Summit Graphic Tee",
    nameAr: "تيشيرت سَمِت المطبوع",
    category: "t-shirts",
    price: 32,
    discount: 25,
    color: "Black",
    images: ["1503341504253-dff4815485f1", "1618354691373-d851c5c3a990"],
    stock: { S: 0, M: 3, L: 4, XL: 1 },
    daysAgo: 60,
    description: "Graphic tee with a front print inspired by the outdoors. Regular fit with a slightly longer body.",
    descriptionAr: "تيشيرت بطبعة أمامية مستوحاة من الطبيعة. قصّة عادية مع طول أطول قليلاً.",
  },
  {
    key: "field-parka-olive",
    name: "Field Parka — Olive",
    nameAr: "باركا فيلد — زيتي",
    category: "outerwear",
    price: 120,
    featured: true,
    color: "Olive",
    images: ["1548883354-94bcfe321cbb", "1544022613-e87ca75a784a"],
    stock: { S: 3, M: 5, L: 4, XL: 2 },
    daysAgo: 1,
    description:
      "Our hero piece. A water-resistant field parka with a stand collar, four utility pockets and adjustable cuffs. Layers easily over a hoodie.",
    descriptionAr: "القطعة الأبرز لدينا. باركا مقاومة للماء بياقة مرتفعة وأربعة جيوب عملية وأساور قابلة للتعديل. تُلبس بسهولة فوق الهودي.",
  },
  {
    key: "recon-bomber-rust",
    name: "Recon Bomber — Rust",
    nameAr: "بومبر ريكون — صدئي",
    category: "outerwear",
    price: 95,
    color: "Rust",
    images: ["1591047139829-d91aecb6caea"],
    stock: { M: 4, L: 3, XL: 2 },
    daysAgo: 38,
    description: "Classic bomber silhouette in a warm rust tone. Ribbed collar, cuffs and hem with a smooth satin lining.",
    descriptionAr: "قصّة بومبر كلاسيكية بلون صدئي دافئ. ياقة وأساور وحافة مضلّعة مع بطانة ساتان ناعمة.",
  },
  {
    key: "denim-trucker-jacket",
    name: "Denim Trucker Jacket",
    nameAr: "جاكيت جينز تراكر",
    category: "outerwear",
    price: 85,
    color: "Indigo",
    images: ["1611312449408-fcece27cdbb7", "1551537482-f2075a1d41f2"],
    stock: { S: 2, M: 4, L: 3, XL: 0 },
    daysAgo: 52,
    description: "Rigid denim trucker jacket that breaks in with you. Button front, chest pockets and adjustable waist tabs.",
    descriptionAr: "جاكيت جينز متين يتشكّل معك مع الوقت. أزرار أمامية وجيوب صدر وأشرطة خصر قابلة للتعديل.",
  },
  {
    key: "heavy-hoodie-stone",
    name: "Heavy Hoodie — Stone",
    nameAr: "هودي ثقيل — حجري",
    category: "hoodies-sweats",
    price: 65,
    featured: true,
    color: "Stone",
    images: ["1556821840-3a63f95609a7", "1516826957135-700dedea698c"],
    stock: { S: 6, M: 9, L: 7, XL: 4, XXL: 2 },
    daysAgo: 3,
    description: "Brushed-back fleece hoodie with a double-layer hood and kangaroo pocket. Heavy, warm and made to last.",
    descriptionAr: "هودي فليس مبطّن بقبعة مزدوجة وجيب أمامي. ثقيل ودافئ ومصنوع ليدوم.",
  },
  {
    key: "crew-sweat-black",
    name: "Crew Sweat — Black",
    nameAr: "سويت شيرت كرو — أسود",
    category: "hoodies-sweats",
    price: 55,
    color: "Black",
    images: ["1614975059251-992f11792b9f"],
    stock: { S: 4, M: 6, L: 5, XL: 3 },
    daysAgo: 41,
    description: "Crewneck sweatshirt with a small embroidered chest mark. Relaxed body, ribbed cuffs and hem.",
    descriptionAr: "سويت شيرت بياقة دائرية وشعار صغير مطرّز على الصدر. قصّة مريحة وأساور وحافة مضلّعة.",
  },
  {
    key: "crew-sweat-chalk",
    name: "Crew Sweat — Chalk",
    nameAr: "سويت شيرت كرو — طباشيري",
    category: "hoodies-sweats",
    price: 55,
    discount: 20,
    color: "Chalk",
    images: ["1620799140408-edc6dcb6d633"],
    stock: { S: 3, M: 2, L: 4, XL: 1 },
    daysAgo: 70,
    description: "Our crew sweat in an off-white chalk tone. Soft, structured and easy to wear with everything.",
    descriptionAr: "السويت شيرت بلون أبيض طباشيري. ناعم ومتماسك وسهل التنسيق مع كل شيء.",
  },
  {
    key: "cargo-pant-graphite",
    name: "Cargo Pant — Graphite",
    nameAr: "بنطال كارغو — غرافيت",
    category: "bottoms",
    price: 70,
    featured: true,
    color: "Graphite",
    images: ["1624378439575-d8705ad7ae80", "1506629082955-511b1aa562c8"],
    stock: { "28": 3, "30": 6, "32": 8, "34": 5, "36": 2 },
    daysAgo: 4,
    description: "Relaxed cargo pant in durable cotton twill. Six pockets, articulated knees and adjustable ankle cuffs.",
    descriptionAr: "بنطال كارغو بقصّة مريحة من قماش تويل قطني متين. ستة جيوب وركبتان مفصّلتان وأطراف قابلة للتعديل.",
  },
  {
    key: "utility-chino-sand",
    name: "Utility Chino — Sand",
    nameAr: "بنطال تشينو — رملي",
    category: "bottoms",
    price: 60,
    color: "Sand",
    images: ["1473966968600-fa801b869a1a"],
    stock: { "28": 2, "30": 5, "32": 6, "34": 4, "36": 1 },
    daysAgo: 48,
    description: "A straight-leg chino with a clean front and a hidden utility pocket. Smart enough for anywhere.",
    descriptionAr: "بنطال تشينو بساق مستقيمة وواجهة نظيفة وجيب مخفي. أنيق بما يكفي لأي مكان.",
  },
  {
    key: "straight-denim-indigo",
    name: "Straight Denim — Indigo",
    nameAr: "جينز مستقيم — نيلي",
    category: "bottoms",
    price: 65,
    color: "Indigo",
    images: ["1542272604-787c3835535d", "1565084888279-aca607ecce0c"],
    stock: { "30": 4, "32": 5, "34": 3, "36": 0 },
    daysAgo: 55,
    description: "Straight-leg jeans in deep indigo denim. Five pockets, a regular rise and a timeless fit.",
    descriptionAr: "جينز بساق مستقيمة بلون نيلي داكن. خمسة جيوب وخصر متوسط وقصّة لا تبطل موضتها.",
  },
  {
    key: "utility-cap-washed",
    name: "Utility Cap — Washed",
    nameAr: "قبعة يوتيليتي — مغسولة",
    category: "accessories",
    price: 22,
    color: "Washed Grey",
    images: ["1521369909029-2afed882baee", "1588850561407-ed78c282e89b"],
    stock: { OS: 20 },
    daysAgo: 6,
    description: "Six-panel cotton cap with a washed finish and an adjustable strap. One size fits most.",
    descriptionAr: "قبعة قطنية بست قطع بلمسة مغسولة وحزام قابل للتعديل. مقاس واحد يناسب الجميع.",
  },
  {
    key: "day-pack-navy",
    name: "Day Pack — Navy",
    nameAr: "حقيبة داي باك — كحلي",
    category: "accessories",
    price: 55,
    color: "Navy",
    images: ["1553062407-98eeb64c6a62"],
    stock: { OS: 0 },
    daysAgo: 65,
    description: "Everyday backpack with a padded laptop sleeve, quick-access front pocket and water-resistant base.",
    descriptionAr: "حقيبة ظهر يومية بجيب مبطّن للابتوب وجيب أمامي سريع وقاعدة مقاومة للماء.",
  },
];

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@7-10.store").toLowerCase();
  const passwordHash = await bcrypt.hash("Admin123!", 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { email: adminEmail, name: "7.10 Admin", role: "ADMIN", passwordHash },
  });

  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
    categoryIds.set(c.slug, row.id);
  }

  for (const p of products) {
    const category = categories.find((c) => c.slug === p.category)!;
    const [first, ...rest] = p.images.map(img);
    const createdAt = new Date(Date.now() - p.daysAgo * 24 * 60 * 60 * 1000);
    const data = {
      name: p.name,
      nameAr: p.nameAr,
      description: p.description,
      descriptionAr: p.descriptionAr,
      price: p.price,
      discount: p.discount ?? 0,
      imageUrl: first,
      images: JSON.stringify(rest),
      colorName: p.color,
      featured: p.featured ?? false,
      category: category.name,
      categoryId: categoryIds.get(category.slug),
      active: true,
      createdAt,
    };

    const product = await prisma.product.upsert({
      where: { externalId: `demo-${p.key}` },
      update: data,
      create: { ...data, externalId: `demo-${p.key}`, slug: p.key },
    });

    for (const [size, stock] of Object.entries(p.stock)) {
      await prisma.productVariant.upsert({
        where: { externalId: `demo-${p.key}-${size}` },
        update: { stock, size, color: p.color },
        create: { externalId: `demo-${p.key}-${size}`, productId: product.id, size, color: p.color, stock },
      });
    }
  }

  console.log(`Seeded ${products.length} demo products. Admin: ${adminEmail} / Admin123!`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
