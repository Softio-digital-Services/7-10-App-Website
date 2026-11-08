import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductInfo } from "@/components/product/product-info";
import { SectionHeading } from "@/components/brand/section-heading";
import { Img } from "@/components/img";
import { getProductBySlug, getRelated } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { alternatesFor, dictionaries } from "@/lib/i18n";
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

  const related = await getRelated(product, locale, 4);
  const alt = dictionaries[locale === "ar" ? "en" : "ar"];

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

      <div className="container-x pt-0 md:pt-6">
        <nav className="mb-5 hidden items-center gap-2 text-[12.5px] lg:flex" aria-label={t.common.breadcrumb}>
          <Link href="/" className="underline underline-offset-2 hover:text-signal">{t.common.home}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/shop" className="underline underline-offset-2 hover:text-signal">{t.common.shop}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/shop?c=${product.categorySlug}`} className="underline underline-offset-2 hover:text-signal">{product.category}</Link>
          <span aria-hidden="true">/</span>
          <span className="truncate font-medium">{product.name}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          <div className="lg:col-span-7">
            <ProductGallery
              images={product.images}
              name={product.name}
              badges={{ soldOut: product.soldOut, discount: product.discount, isNew: product.isNew }}
            />
          </div>
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-[96px]">
              <ProductInfo product={product} />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12 bg-stone py-10 md:mt-20 md:py-14">
          <div className="container-x">
            <SectionHeading title={t.product.related} alt={alt.product.related} locale={locale} />
            <div className="no-scrollbar -mx-4 mt-6 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 md:mx-0 md:mt-8 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
              {related.slice(0, 4).map((p, i) => (
                <Link key={p.id} href={`/products/${p.slug}`} className="group w-[42%] shrink-0 snap-start md:w-auto">
                  <span className={`card-img lift relative block aspect-square ${["bg-[#d6d8d4]", "bg-cream-2", "bg-white", "bg-sand"][i % 4]}`}>
                    {p.images[0] && <Img src={p.images[0]} alt={p.name} fill sizes="(min-width:768px) 22vw, 42vw" className="img-zoom object-cover" />}
                  </span>
                  <span className="mt-2.5 flex flex-col justify-between gap-1 text-[13px] font-bold md:flex-row md:gap-3">
                    <span className="truncate group-hover:underline group-hover:underline-offset-4">{p.name}</span>
                    <span className="shrink-0" dir="ltr">{formatPrice(p.price)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Room for the phone buy bar */}
      <div className="h-24 lg:h-0" />
    </>
  );
}
