import type { Metadata, Viewport } from "next";
// Fonts are self-hosted (served from the app) so dev/build never wait on fonts.googleapis.com.
import "@fontsource-variable/oswald";
import "@fontsource/ibm-plex-sans-arabic/300.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { Providers } from "@/components/providers";
import { getI18n } from "@/lib/i18n/server";
import { store } from "@/lib/store-config";

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();
  return {
    metadataBase: new URL(store.siteUrl),
    title: { default: dict.meta.title, template: `%s — 7.10 Brand` },
    description: dict.meta.description,
    // Icons and the share image come from src/app/icon.png, apple-icon.png and opengraph-image.png.
    openGraph: {
      type: "website",
      siteName: "7.10 Brand",
      title: dict.meta.title,
      description: dict.meta.description,
      locale: locale === "ar" ? "ar_LB" : "en_US",
      alternateLocale: locale === "ar" ? "en_US" : "ar_LB",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#6e6e3f",
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) report the notch / home-bar insets the sticky buy bar pads for.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict, dir } = await getI18n();

  return (
    <html lang={locale} dir={dir} data-scroll-behavior="smooth">
      <body className="grain">
        {/* Without JavaScript the scroll-reveal never fires; show those sections straight away. */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <Providers>
          <I18nProvider locale={locale} dict={dict}>
            <CartProvider>{children}</CartProvider>
          </I18nProvider>
        </Providers>
      </body>
    </html>
  );
}
