import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, safeCallback } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.common.signIn, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, session, { dict: t }] = await Promise.all([searchParams, auth(), getI18n()]);
  const explicit = typeof params.callbackUrl === "string";
  const callbackUrl = safeCallback(params.callbackUrl);

  if (session?.user) {
    const staff = session.user.role === "ADMIN" || session.user.role === "MANAGER";
    redirect(explicit ? callbackUrl : staff ? "/admin" : "/orders");
  }

  return (
    <AuthShell t={t} title={t.auth.signInTitle} body={t.auth.signInBody}>
      <LoginForm callbackUrl={callbackUrl} explicitCallback={explicit} google={!!process.env.AUTH_GOOGLE_ID} />
    </AuthShell>
  );
}
