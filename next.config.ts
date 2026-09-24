import type { NextConfig } from "next";

const liveDomain = String(
  process.env.NEXT_PUBLIC_LIVE_DOMAIN_URL ||
    process.env.live_domain_url ||
    process.env.LIVE_DOMAIN_URL ||
    "",
)
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\/+$/, "");

const nextConfig: NextConfig = {
  env: {
    // Expose `live_domain_url` to the browser for customer share / Open customer view links.
    NEXT_PUBLIC_LIVE_DOMAIN_URL:
      liveDomain || process.env.NEXT_PUBLIC_LIVE_DOMAIN_URL || "",
  },
  transpilePackages: ["ckeditor5", "@ckeditor/ckeditor5-react"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/for-providers", destination: "/pro", permanent: true },
      { source: "/providers/login", destination: "/pro/login", permanent: true },
      { source: "/providers/register", destination: "/pro/register", permanent: true },
      { source: "/providers/forgot-password", destination: "/pro/forgot-password", permanent: true },
      { source: "/providers/reset-password", destination: "/pro/reset-password", permanent: true },
      { source: "/dashboard", destination: "/pro/dashboard", permanent: true },
      { source: "/dashboard/:path*", destination: "/pro/dashboard/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
