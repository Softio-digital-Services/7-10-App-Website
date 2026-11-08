"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, signOut } from "@/lib/auth";
import { isValidPhone } from "@/lib/format";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { regions } from "@/lib/store-config";

/** Every account action works on the signed-in customer only. */
async function userId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/orders");
  return session.user.id;
}

const text = (max: number) => z.string().trim().max(max);
const done = (tab: string, flag = "saved") => {
  revalidatePath("/orders");
  redirect(`/orders?tab=${tab}&${flag}=1`);
};

const addressSchema = z.object({
  id: z.string().optional(),
  label: text(40).min(1),
  name: text(80).min(2),
  phone: text(30).refine(isValidPhone),
  region: z.string().refine((v) => regions.some((r) => r.id === v)),
  city: text(80).min(2),
  street: text(160).min(3),
  floor: text(80).default(""),
  landmark: text(160).default(""),
  isDefault: z.string().optional(),
});

export async function saveAddress(form: FormData) {
  const uid = await userId();
  const parsed = addressSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return done("addresses", "error");
  const { id, isDefault, ...data } = parsed.data;
  const count = await prisma.address.count({ where: { userId: uid } });
  const makeDefault = isDefault === "on" || count === 0;
  await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId: uid }, data: { isDefault: false } });
    if (id) {
      await tx.address.updateMany({ where: { id, userId: uid }, data: { ...data, ...(makeDefault ? { isDefault: true } : {}) } });
    } else {
      await tx.address.create({ data: { ...data, userId: uid, isDefault: makeDefault } });
    }
  });
  done("addresses");
}

export async function deleteAddress(form: FormData) {
  const uid = await userId();
  const id = String(form.get("id") ?? "");
  const removed = await prisma.address.findFirst({ where: { id, userId: uid } });
  if (removed) {
    await prisma.address.delete({ where: { id } });
    if (removed.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId: uid }, orderBy: { createdAt: "asc" } });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
  done("addresses");
}

export async function makeDefaultAddress(form: FormData) {
  const uid = await userId();
  const id = String(form.get("id") ?? "");
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId: uid }, data: { isDefault: false } }),
    prisma.address.updateMany({ where: { id, userId: uid }, data: { isDefault: true } }),
  ]);
  done("addresses");
}

const fitSchema = z.object({
  fitHeight: z.coerce.number().int().min(100).max(230).optional().or(z.literal("").transform(() => undefined)),
  fitStyle: z.enum(["Loose", "Relaxed", "Regular"]),
  fitTops: text(12),
  fitPants: text(12),
  fitHijab: text(20),
});

export async function saveFit(form: FormData) {
  const uid = await userId();
  const parsed = fitSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return done("fit", "error");
  const f = parsed.data;
  await prisma.user.update({
    where: { id: uid },
    data: { fitHeight: f.fitHeight ?? null, fitStyle: f.fitStyle, fitTops: f.fitTops || null, fitPants: f.fitPants || null, fitHijab: f.fitHijab || null },
  });
  done("fit");
}

const detailsSchema = z.object({
  name: text(80).min(2),
  phone: text(30).refine((v) => !v || isValidPhone(v)),
  locale: z.enum(["en", "ar"]),
  waUpdates: z.string().optional(),
});

export async function saveDetails(form: FormData) {
  const uid = await userId();
  const parsed = detailsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return done("details", "error");
  const d = parsed.data;
  const wa = d.waUpdates === "on";
  await prisma.user.update({ where: { id: uid }, data: { name: d.name, phone: d.phone || null, locale: d.locale, waUpdates: wa } });
  // WhatsApp updates use the same list as the newsletter, keyed by the mobile number.
  if (wa && d.phone) await prisma.subscriber.upsert({ where: { contact: d.phone }, update: { locale: d.locale }, create: { contact: d.phone, locale: d.locale } });
  if (!wa && d.phone) await prisma.subscriber.deleteMany({ where: { contact: d.phone } });
  (await cookies()).set(LOCALE_COOKIE, d.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  done("details");
}

export async function removeFromWishlist(form: FormData) {
  const uid = await userId();
  await prisma.wishlistItem.deleteMany({ where: { userId: uid, productId: String(form.get("productId") ?? "") } });
  done("wishlist");
}

/** Deletes the customer account. Orders stay for the shop's records, unlinked from the account. */
export async function deleteAccount(form: FormData) {
  const uid = await userId();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return done("details", "confirm");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
  if (user?.role !== "CUSTOMER") return done("details", "staff");
  await prisma.user.delete({ where: { id: uid } });
  await signOut({ redirectTo: "/" });
}
