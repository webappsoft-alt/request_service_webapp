import type { Provider } from "@/lib/types";

const fallbackContacts = [
  { name: "Daniel Ruiz", role: "Business owner" },
  { name: "Priya Shah", role: "Office manager" },
  { name: "Marcus Hale", role: "Lead contractor" },
  { name: "Elena Brooks", role: "Service manager" },
  { name: "James Ortiz", role: "Business owner" },
  { name: "Nina Patel", role: "Contractor" },
];

function hashSlug(slug: string) {
  return [...slug].reduce((total, char) => total + char.charCodeAt(0), 0);
}

export function getProviderContact(provider: Provider) {
  if (provider.contact) return provider.contact;
  return fallbackContacts[hashSlug(provider.slug) % fallbackContacts.length];
}

export function getProviderWebsite(provider: Provider) {
  return provider.website ?? `https://${provider.slug.replace(/-/g, "")}.example`;
}

export function displayWebsite(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
