import { siteConfig, absoluteUrl } from "@/lib/site";
import { getServiceAreaNames } from "@/lib/data/service-areas";
import { serviceCategories } from "@/lib/data/services";
import type { JobRecord } from "@/lib/data/jobs";
import type { BlogPost, FaqItem, Provider, ServiceCategory } from "@/lib/types";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: siteConfig.url,
    logo: absoluteUrl("/icon"),
    email: siteConfig.email,
    telephone: siteConfig.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.street,
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.state,
      postalCode: siteConfig.address.postalCode,
      addressCountry: siteConfig.address.country,
    },
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
    sameAs: Object.values(siteConfig.social),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/find-a-professional")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function jobServiceJsonLd(record: JobRecord, price: number) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: record.job,
    description: record.detail.description,
    serviceType: record.category.name,
    provider: {
      "@type": "Organization",
      name: siteConfig.name,
    },
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
    url: absoluteUrl(`/services/${record.category.slug}/${record.slug}`),
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "USD",
      description: "Typical starting price. Written estimate after a visit.",
    },
  };
}

export function serviceCategoryJsonLd(category: ServiceCategory) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: category.name,
    description: category.longDescription,
    serviceType: category.name,
    provider: {
      "@type": "Organization",
      name: siteConfig.name,
    },
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
    url: absoluteUrl(`/services/${category.slug}`),
  };
}

export function providerJsonLd(provider: Provider, categories: ServiceCategory[]) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: provider.companyName,
    description: provider.description,
    telephone: provider.phone,
    email: provider.email,
    url: absoluteUrl(`/professionals/${provider.slug}`),
    address: {
      "@type": "PostalAddress",
      streetAddress: provider.street,
      addressLocality: provider.city,
      addressRegion: provider.state,
      postalCode: provider.zip,
      addressCountry: "US",
    },
    areaServed: getServiceAreaNames(provider.serviceArea).map((area) => ({
      "@type": "Place",
      name: area,
      address: {
        "@type": "PostalAddress",
        addressLocality: provider.city,
        addressRegion: provider.state,
        addressCountry: "US",
      },
    })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: categories.map((category) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: category.name,
        },
      })),
    },
    priceRange: provider.startingPrice
      ? `From $${provider.startingPrice}`
      : undefined,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: provider.rating,
      reviewCount: provider.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
  };
}

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function articleJsonLd(post: BlogPost, authorName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/icon"),
      },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    inLanguage: "en-US",
  };
}

export function servicesItemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Home service categories",
    itemListElement: serviceCategories.map((category, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/services/${category.slug}`),
      name: category.name,
    })),
  };
}
