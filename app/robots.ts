import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/login",
          "/register",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/pro/login",
          "/pro/register",
          "/pro/forgot-password",
          "/pro/reset-password",
          "/pro/dashboard",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
