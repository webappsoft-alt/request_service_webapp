import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#003F7D",
    lang: "en-US",
    categories: ["business", "lifestyle"],
    icons: [
      // Rounded macOS-style icon (transparent margin) — desktop dock / taskbar.
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Full-bleed square — Android launchers cut their own shape.
      {
        src: "/maskable-icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
