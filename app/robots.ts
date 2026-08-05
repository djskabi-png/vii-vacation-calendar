import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/seo";

const privatePaths = ["/api/", "/handoff/", "/favorites/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: privatePaths },
      { userAgent: "GPTBot", allow: "/", disallow: privatePaths },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
