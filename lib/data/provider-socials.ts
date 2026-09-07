import type { Provider } from "@/lib/types";

export type SocialNetwork = "facebook" | "google" | "instagram" | "x";

export type ProviderSocialLink = {
  id: SocialNetwork;
  label: string;
  href: string;
  icon: string;
};

export function getProviderSocials(provider: Provider): ProviderSocialLink[] {
  const handle = provider.slug.replace(/-/g, "");
  const query = encodeURIComponent(`${provider.companyName} ${provider.city} ${provider.state}`);

  return [
    {
      id: "facebook",
      label: "Facebook",
      href: provider.social?.facebook ?? `https://www.facebook.com/${handle}`,
      icon: "/icons/social/facebook.svg",
    },
    {
      id: "google",
      label: "Google",
      href:
        provider.social?.google ??
        `https://www.google.com/search?q=${query}`,
      icon: "/icons/social/google.svg",
    },
    {
      id: "instagram",
      label: "Instagram",
      href: provider.social?.instagram ?? `https://www.instagram.com/${handle}`,
      icon: "/icons/social/instagram.svg",
    },
    {
      id: "x",
      label: "X",
      href: provider.social?.x ?? `https://x.com/${handle}`,
      icon: "/icons/social/x.svg",
    },
  ];
}
