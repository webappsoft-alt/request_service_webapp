import type { Metadata } from "next";
import { siteConfig, absoluteUrl } from "@/lib/site";

type BuildMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  index?: boolean;
  follow?: boolean;
  ogType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  images?: string[];
};

export function buildMetadata({
  title,
  description,
  path,
  keywords = [],
  index = true,
  follow = true,
  ogType = "website",
  publishedTime,
  modifiedTime,
  authors,
  images,
}: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const ogImages = images?.length
    ? images.map((image) => ({ url: image.startsWith("http") ? image : absoluteUrl(image) }))
    : [{ url: absoluteUrl("/opengraph-image") }];

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: url,
    },
    robots: {
      index,
      follow,
      googleBot: {
        index,
        follow,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: ogType,
      url,
      title: `${title} | ${siteConfig.name}`,
      description,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      publishedTime,
      modifiedTime,
      authors,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
      images: ogImages.map((image) => image.url),
    },
  };
}

export const defaultKeywords = [
  "home services marketplace",
  "find a plumber",
  "HVAC repair",
  "licensed electrician",
  "handyman near me",
  "house cleaning",
  "roofing contractor",
  "service business software",
  "contractor estimates",
  "home service booking",
];
