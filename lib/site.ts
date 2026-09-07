export const siteConfig = {
  name: "Request Services",
  shortName: "Request",
  legalName: "Request Services, Inc.",
  tagline: "The professional marketplace for home services.",
  description:
    "Request Services connects homeowners with trusted local professionals for plumbing, HVAC, electrical, and more — and gives service businesses the tools to manage estimates, jobs, invoices, and payments.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.requestservices.com",
  locale: "en_US",
  language: "en-US",
  country: "United States",
  email: "hello@requestservices.com",
  supportEmail: "support@requestservices.com",
  phone: "+1 (800) 555-0148",
  phoneHref: "tel:+18005550148",
  address: {
    street: "100 Market Street",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    country: "US",
  },
  social: {
    twitter: "https://x.com/requestservices",
    linkedin: "https://www.linkedin.com/company/request-services",
    facebook: "https://www.facebook.com/requestservices",
    instagram: "https://www.instagram.com/requestservices",
  },
  founder: "Request Services",
} as const;

export type SiteConfig = typeof siteConfig;

export function absoluteUrl(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, siteConfig.url).toString();
}
