import type { NextConfig } from "next";
import { OPTIMIZED_IMAGE_HOSTS } from "./lib/image-hosts";

const nextConfig: NextConfig = {
  // Metadata in the <head> of every response, not streamed into <body> for browsers, so each
  // article's title, description, and keywords are in the page source.
  htmlLimitedBots: /.*/,
  transpilePackages: ["ckeditor5", "@ckeditor/ckeditor5-react"],
  images: {
    // AVIF first (smaller hero/LCP bytes), WebP fallback; source URLs are unchanged.
    formats: ["image/avif", "image/webp"],
    // Same list `canOptimizeImage()` checks before dropping `unoptimized`.
    remotePatterns: OPTIMIZED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  async redirects() {
    return [
      // Pro marketing moved /for-pros → /pros (2026-11-24). /pros/<slug> is still the public Pro
      // profile, so trade pages live at /pros/trades/<trade>. Specific rules first, then trades.
      { source: "/for-pros", destination: "/pros", permanent: true },
      // Old landing-page preview (was a page that redirected to /for-pros).
      { source: "/for-pros-v1", destination: "/pros", permanent: true },
      { source: "/for-pros/pricing", destination: "/pros/pricing", permanent: true },
      { source: "/for-pros/join", destination: "/pros/join", permanent: true },
      { source: "/for-pros/join/:path*", destination: "/pros/join/:path*", permanent: true },
      { source: "/for-pros/blog", destination: "/pros/blog", permanent: true },
      { source: "/for-pros/blog/:path*", destination: "/pros/blog/:path*", permanent: true },
      { source: "/for-pros/locations/:path*", destination: "/pros/locations/:path*", permanent: true },
      { source: "/for-pros/:trade", destination: "/pros/trades/:trade", permanent: true },
      { source: "/for-pros/:path*", destination: "/pros/:path*", permanent: true },
      // Pro marketing moved /pro → /for-pros earlier (auth + portal stay under /pro/*); now straight to /pros.
      { source: "/pro", destination: "/pros", permanent: true },
      { source: "/pro/pricing", destination: "/pros/pricing", permanent: true },
      { source: "/pro/register", destination: "/pros/join", permanent: true },
      // Public Pro profiles moved /professionals → /pros.
      { source: "/professionals/:path*", destination: "/pros/:path*", permanent: true },
      { source: "/for-providers", destination: "/pros", permanent: true },
      // Old Pro-menu blog slugs that never existed in the blog CMS.
      {
        source: "/blog/why-change-orders-matter-on-home-service-jobs",
        destination: "/blog/why-change-orders-protect-contractors-and-homeowners",
        permanent: true,
      },
      {
        source: "/blog/deposits-progress-payments-and-balances",
        destination: "/blog/invoice-and-milestone-billing-habits-that-reduce-payment-delays",
        permanent: true,
      },
      {
        source: "/blog/what-belongs-on-a-professional-service-profile",
        destination: "/blog/building-a-public-profile-that-converts-visitors",
        permanent: true,
      },
      { source: "/providers/login", destination: "/pro/login", permanent: true },
      { source: "/providers/register", destination: "/pros/join", permanent: true },
      { source: "/providers/forgot-password", destination: "/pro/forgot-password", permanent: true },
      { source: "/providers/reset-password", destination: "/pro/reset-password", permanent: true },
      { source: "/dashboard", destination: "/pro/dashboard", permanent: true },
      { source: "/dashboard/:path*", destination: "/pro/dashboard/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
