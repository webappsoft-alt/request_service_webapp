import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
