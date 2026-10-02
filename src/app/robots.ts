import type { MetadataRoute } from "next";

// Keep private areas out of search engines. (The pages are also marked noindex.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/member", "/claim", "/api"] },
  };
}
