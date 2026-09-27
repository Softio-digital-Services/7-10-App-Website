import { prisma } from "@/lib/prisma";

/** Content-hash file names only (`<hex>.<ext>`), so a name can never point outside the media store. */
const MEDIA_NAME = /^[a-f0-9]{16,64}\.(jpg|jpeg|png|webp|gif)$/;

export const MEDIA_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Serverless request bodies cap out around 6 MB; base64 adds a third. The desktop app shrinks photos before upload. */
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

export const isMediaName = (name: string) => MEDIA_NAME.test(name);

export async function readMedia(name: string) {
  if (!isMediaName(name)) return null;
  return prisma.mediaFile.findUnique({ where: { name } });
}

export async function missingMedia(names: string[]) {
  const valid = [...new Set(names.filter(isMediaName))];
  if (valid.length === 0) return [];
  const have = await prisma.mediaFile.findMany({ where: { name: { in: valid } }, select: { name: true } });
  const known = new Set(have.map((m) => m.name));
  return valid.filter((n) => !known.has(n));
}

export async function saveMedia(name: string, data: Buffer) {
  if (!isMediaName(name)) throw new Error("bad_name");
  const ext = name.split(".").pop() ?? "";
  const bytes = new Uint8Array(data);
  await prisma.mediaFile.upsert({
    where: { name },
    update: {},
    create: { name, contentType: MEDIA_TYPES[ext] ?? "application/octet-stream", size: bytes.length, data: bytes },
  });
  return `/media/${name}`;
}
