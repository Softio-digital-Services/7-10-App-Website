import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { alternatesFor } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();
  return { title: dict.legal.terms.title, description: dict.legal.terms.intro, alternates: alternatesFor("/terms", locale) };
}

export default async function TermsPage() {
  const { dict: t, locale } = await getI18n();
  return <LegalPage doc={t.legal.terms} t={t} locale={locale} />;
}
