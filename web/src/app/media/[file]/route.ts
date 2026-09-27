import { readMedia } from "@/lib/hub/media";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const media = await readMedia(file);
  if (!media) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(media.size),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
