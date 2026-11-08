import type { Metadata, Viewport } from "next";
// Fonts are self-hosted (served from the app) so dev/build never wait on fonts.googleapis.com.
import "@fontsource/squada-one/400.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/changa/600.css";
import "@fontsource/changa/700.css";
import "@fontsource/changa/800.css";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/800.css";
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
  themeColor: "#313b2b",
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) report the notch / home-bar insets the sticky buy bar pads for.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict, dir } = await getI18n();

  return (
    <html lang={locale} dir={dir} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Sets light/dark before first paint: the saved choice, else the device setting. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('710.theme');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
      </head>
      <body>
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
