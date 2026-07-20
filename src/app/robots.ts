import type { MetadataRoute } from "next";

import { BRAND_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const indexingEnabled = process.env.SITE_INDEXING_ENABLED === "true";
  return {
    rules: indexingEnabled
      ? { userAgent: "*", allow: "/" }
      : { userAgent: "*", disallow: "/" },
    sitemap: indexingEnabled ? BRAND_URL + "/sitemap.xml" : undefined,
  };
}
