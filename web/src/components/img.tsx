"use client";

import Image, { type ImageLoader, type ImageProps } from "next/image";

const unsplashLoader: ImageLoader = ({ src, width, quality }) => {
  const url = new URL(src);
  const w0 = Number(url.searchParams.get("w"));
  const h0 = Number(url.searchParams.get("h"));
  url.searchParams.set("w", String(width));
  if (w0 > 0 && h0 > 0) url.searchParams.set("h", String(Math.round((width * h0) / w0)));
  url.searchParams.set("q", String(quality ?? 75));
  url.searchParams.set("auto", "format");
  return url.toString();
};

/** next/image that lets Unsplash's CDN resize its own photos; everything else goes through the Next optimizer. */
export function Img(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  if (src.startsWith("https://images.unsplash.com/")) {
    return <Image {...props} loader={unsplashLoader} alt={props.alt} />;
  }
  return <Image {...props} unoptimized={props.unoptimized ?? src.endsWith(".svg")} alt={props.alt} />;
}
