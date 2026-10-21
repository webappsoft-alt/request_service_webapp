import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["ckeditor5", "@ckeditor/ckeditor5-react"],
  images: {
    // AVIF first (smaller hero/LCP bytes), WebP fallback; source URLs are unchanged.
    formats: ["image/avif", "image/webp"],
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
      // Pro marketing moved /pro → /for-pros (auth + portal stay under /pro/*).
      { source: "/pro", destination: "/for-pros", permanent: true },
      { source: "/pro/pricing", destination: "/for-pros/pricing", permanent: true },
      { source: "/pro/register", destination: "/for-pros/join", permanent: true },
      // Public Pro profiles moved /professionals → /pros.
      { source: "/professionals/:path*", destination: "/pros/:path*", permanent: true },
      { source: "/for-providers", destination: "/for-pros", permanent: true },
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
      { source: "/providers/register", destination: "/for-pros/join", permanent: true },
      { source: "/providers/forgot-password", destination: "/pro/forgot-password", permanent: true },
      { source: "/providers/reset-password", destination: "/pro/reset-password", permanent: true },
      { source: "/dashboard", destination: "/pro/dashboard", permanent: true },
      { source: "/dashboard/:path*", destination: "/pro/dashboard/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
