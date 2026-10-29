import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { alternatesFor } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();
  return { title: dict.legal.privacy.title, description: dict.legal.privacy.intro, alternates: alternatesFor("/privacy", locale) };
}

export default async function PrivacyPage() {
  const { dict: t, locale } = await getI18n();
  return <LegalPage doc={t.legal.privacy} t={t} locale={locale} />;
}
