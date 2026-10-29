import type { MetadataRoute } from "next";
import { store } from "@/lib/store-config";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/admin", "/api/", "/cart", "/checkout", "/order/", "/orders", "/login", "/register", "/soon"];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...privatePaths, ...privatePaths.map((p) => `/ar${p}`)] }],
    sitemap: `${store.siteUrl}/sitemap.xml`,
  };
}
