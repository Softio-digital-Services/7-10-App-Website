import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, safeCallback } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { auth } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.createAccount, robots: { index: false } };
}

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, session, { dict: t }] = await Promise.all([searchParams, auth(), getI18n()]);
  const explicit = typeof params.callbackUrl === "string";
  const callbackUrl = safeCallback(params.callbackUrl);

  if (session?.user) redirect(callbackUrl);

  return (
    <AuthShell t={t} title={t.auth.registerTitle} body={t.auth.registerBody}>
      <RegisterForm callbackUrl={callbackUrl} explicitCallback={explicit} google={!!process.env.AUTH_GOOGLE_ID} />
    </AuthShell>
  );
}
