import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionLabel } from "@/components/brand/section-label";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductInfo } from "@/components/product/product-info";
import { ProductRail } from "@/components/product-rail";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { getProductBySlug, getRelated } from "@/lib/catalog";
import { alternatesFor } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { regions, store } from "@/lib/store-config";

const absolute = (url: string) => (url.startsWith("http") ? url : `${store.siteUrl}${url}`);

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await getI18n();
  const product = await getProductBySlug(slug, locale);
  if (!product) return {};
  const description = product.description.slice(0, 160) || undefined;
  return {
    title: product.name,
    description,
    alternates: alternatesFor(`/products/${product.slug}`, locale),
    openGraph: {
      // Repeats the root fields: a page-level openGraph replaces the layout's instead of merging with it.
      type: "website",
      siteName: "7.10 Brand",
      locale: locale === "ar" ? "ar_LB" : "en_US",
      url: `/products/${product.slug}`,
      title: product.name,
      description,
      images: product.images.slice(0, 1).map((url) => ({ url: absolute(url), alt: product.name })),
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { dict: t, locale } = await getI18n();
  const product = await getProductBySlug(slug, locale);
  if (!product) notFound();

  const related = await getRelated(product, locale, 10);

  const url = `${store.siteUrl}/products/${product.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: product.images.map(absolute),
      description: product.description,
      sku: product.slug,
      brand: { "@type": "Brand", name: "7.10" },
      ...(product.colorName ? { color: product.colorName } : {}),
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: store.currency,
        price: product.price.toFixed(2),
        itemCondition: "https://schema.org/NewCondition",
        availability: product.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingDestination: { "@type": "DefinedRegion", addressCountry: "LB" },
          shippingRate: {
            "@type": "MonetaryAmount",
            currency: store.currency,
            value: product.price >= store.freeDeliveryOver ? 0 : Math.min(...regions.map((r) => r.fee)),
          },
        },
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "LB",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: store.exchangeDays,
          returnMethod: "https://schema.org/ReturnByMail",
        },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.common.home, item: `${store.siteUrl}/` },
        { "@type": "ListItem", position: 2, name: t.common.shop, item: `${store.siteUrl}/shop` },
        { "@type": "ListItem", position: 3, name: product.category, item: `${store.siteUrl}/shop?c=${product.categorySlug}` },
        { "@type": "ListItem", position: 4, name: product.name, item: url },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="container-x pt-5 md:pt-8">
        <nav className="mb-5 hidden items-center gap-2 text-[12.5px] text-charcoal/65 md:flex" aria-label={t.common.breadcrumb}>
          <Link href="/" className="hover:text-charcoal">{t.common.home}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/shop" className="hover:text-charcoal">{t.common.shop}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/shop?c=${product.categorySlug}`} className="hover:text-charcoal">{product.category}</Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-charcoal">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 xl:gap-16">
          <div className="lg:col-span-7">
            <ProductGallery
              images={product.images}
              name={product.name}
              badges={{ soldOut: product.soldOut, discount: product.discount, isNew: product.isNew }}
            />
          </div>
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-[100px]">
              <ProductInfo product={product} />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="container-x mt-24 md:mt-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionLabel index="01">{product.category}</SectionLabel>
              <h2 className="display mt-4 text-4xl md:text-6xl">{t.product.related}</h2>
            </div>
            <Link href={`/shop?c=${product.categorySlug}`} className="link-line eyebrow">
              {t.common.viewAll}
            </Link>
          </div>
          <div className="mt-10">
            <ProductRail products={related} />
          </div>
        </section>
      )}

      <RecentlyViewed current={product} />

      <div className="h-24 md:h-32" />
    </>
  );
}
