import { Suspense } from "react";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { BagDrawer } from "@/components/layout/bag-drawer";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { WhatsAppFab } from "@/components/layout/whatsapp-fab";
import { getCategories } from "@/lib/catalog";
import { getLocale } from "@/lib/i18n/server";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories(await getLocale());

  return (
    <>
      <AnnouncementBar />
      <Suspense fallback={<div className="h-16 md:h-[76px]" />}>
        <Header categories={categories} />
      </Suspense>
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer categories={categories} />
      <BagDrawer />
      <WhatsAppFab />
    </>
  );
}
