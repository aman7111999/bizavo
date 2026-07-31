import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/s/"], disallow: ["/app", "/app/", "/api/", "/control", "/control/", "/invite/", "/share/"] }
    ],
    sitemap: "https://bizavo.vercel.app/sitemap.xml"
  };
}
