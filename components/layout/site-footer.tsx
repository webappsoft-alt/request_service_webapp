import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { footerNav } from "@/lib/data/navigation";
import { serviceCategories } from "@/lib/data/services";
import { siteConfig } from "@/lib/site";

const socials = [
  {
    label: "Facebook",
    href: siteConfig.social.facebook,
    icon: "/icons/social/facebook.svg",
  },
  {
    label: "Instagram",
    href: siteConfig.social.instagram,
    icon: "/icons/social/instagram.svg",
  },
  {
    label: "X",
    href: siteConfig.social.twitter,
    icon: "/icons/social/x.svg",
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-primary text-white">
      <div className="container-site grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Logo inverse />
          <p className="max-w-sm text-sm leading-6 text-white">
            {siteConfig.description}
          </p>

          <ul className="flex flex-col gap-2.5 text-sm text-white">
            <li className="flex items-start gap-2.5">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-white"
                aria-hidden="true"
              />
              <span>
                {siteConfig.address.street}, {siteConfig.address.city},{" "}
                {siteConfig.address.state} {siteConfig.address.postalCode}
              </span>
            </li>
            <li>
              <a
                className="inline-flex items-center gap-2.5 text-white transition-opacity hover:opacity-80"
                href={siteConfig.phoneHref}
              >
                <Phone
                  className="size-4 shrink-0 text-white"
                  aria-hidden="true"
                />
                {siteConfig.phone}
              </a>
            </li>
            <li>
              <a
                className="inline-flex items-center gap-2.5 text-white transition-opacity hover:opacity-80"
                href={`mailto:${siteConfig.email}`}
              >
                <Mail
                  className="size-4 shrink-0 text-white"
                  aria-hidden="true"
                />
                {siteConfig.email}
              </a>
            </li>
          </ul>

          <ul className="flex items-center gap-2 pt-1">
            {socials.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="flex size-9 items-center justify-center rounded-lg border border-white/25 transition-colors hover:border-white hover:bg-white/10"
                >
                  <span
                    aria-hidden="true"
                    className="size-4 bg-white"
                    style={{
                      maskImage: `url(${item.icon})`,
                      WebkitMaskImage: `url(${item.icon})`,
                      maskRepeat: "no-repeat",
                      maskPosition: "center",
                      maskSize: "contain",
                    }}
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <FooterColumn title="Customers" items={footerNav.customers} />
        <FooterColumn title="Providers" items={footerNav.providers} />
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-[0.14em] text-white uppercase">
            Services
          </p>
          <ul className="flex flex-col gap-2">
            {serviceCategories.slice(0, 6).map((category) => (
              <li key={category.id}>
                <Link
                  href={`/services/${category.slug}`}
                  className="text-sm text-white transition-opacity hover:opacity-80"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/services"
                className="text-sm text-white transition-opacity hover:opacity-80"
              >
                All services
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="container-site flex flex-col gap-3 py-5 text-sm text-white md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {footerNav.company.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-white transition-opacity hover:opacity-80"
              >
                {item.label}
              </Link>
            ))}
            {footerNav.legal.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-white transition-opacity hover:opacity-80"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium tracking-[0.14em] text-white uppercase">
        {title}
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-sm text-white transition-opacity hover:opacity-80"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
