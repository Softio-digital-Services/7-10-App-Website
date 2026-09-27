import type { Metadata } from "next";
import { TrackView } from "@/components/order/track-view";
import { getI18n } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.track.title };
}

export default async function TrackPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const initial = typeof sp.o === "string" ? sp.o : "";
  return <TrackView initialOrder={initial} />;
}
