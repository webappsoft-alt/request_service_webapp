"use client";

import { useEffect } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { footerNav } from "@/lib/data/navigation";
import { serviceCategories } from "@/lib/data/services";
import { siteConfig } from "@/lib/site";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchSiteBranding,
  selectSiteBranding,
} from "@/store/siteBrandingSlice";

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

const linkClass =
  "text-sm text-white/80 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none";

/** Public website footer (marketing pages only — the Pro dashboard has no footer). */
export function SiteFooter() {
  const dispatch = useAppDispatch();
  const branding = useAppSelector(selectSiteBranding);

  useEffect(() => {
    void dispatch(fetchSiteBranding());
  }, [dispatch]);

  const addressLines = [branding.address, branding.address2].filter(Boolean);
  const phones = [
    { label: branding.phone, href: branding.phoneHref },
    branding.phone2
      ? { label: branding.phone2, href: branding.phone2Href }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;
  const emails = [branding.email, branding.email2].filter(Boolean);

  const serviceLinks = [
    ...serviceCategories.slice(0, 6).map((category) => ({
      label: category.name,
      href: `/services/${category.slug}`,
    })),
    // { label: "All services", href: "/services" },
  ];

  return (
    <footer className="bg-primary text-white dark:border-t dark:border-white/10 dark:bg-[#0a1322]">
      <div className="container-site grid gap-12 py-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,3fr)_auto] lg:gap-10">
        {/* Branding, contact & socials */}
        <div className="flex flex-col gap-5">
          <Logo inverse />
          <p className="max-w-xs text-sm leading-6 text-white/80">
            {siteConfig.tagline}
          </p>

          <ul className="flex flex-col gap-2 text-sm text-white/80">
            {addressLines.length ? (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {addressLines.map((line, index) => (
                    <span key={`${line}-${index}`}>
                      {index > 0 ? <br /> : null}
                      {line}
                    </span>
                  ))}
                </span>
              </li>
            ) : null}
            {phones.map((item) => (
              <li key={item.label}>
                <a
                  className="inline-flex items-center gap-2.5 transition-colors hover:text-white"
                  href={item.href || undefined}
                >
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </a>
              </li>
            ))}
            {emails.map((email) => (
              <li key={email}>
                <a
                  className="inline-flex items-center gap-2.5 transition-colors hover:text-white"
                  href={`mailto:${email}`}
                >
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  {email}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-medium tracking-[0.14em] text-white uppercase">
              Follow us
            </p>
            <ul className="flex items-center gap-2">
              {socials.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className="flex size-9 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:border-white hover:bg-white/10"
                  >
                    <span
                      aria-hidden="true"
                      className="size-4 bg-current"
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
        </div>

        {/* Navigation columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
          <FooterColumn title="Customers" items={footerNav.customers} />
          <FooterColumn title="Pros" items={footerNav.providers} />
          <FooterColumn title="Services" items={serviceLinks} />
          <FooterColumn title="Company" items={footerNav.company} />
        </div>

        {/* App downloads & QR */}
        <AppDownloadBlock />
      </div>

      <div className="border-t border-white/15">
        <div className="container-site flex flex-col gap-3 py-5 text-sm text-white/80 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {footerNav.legal.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass}>
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
            <Link href={item.href} className={linkClass}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Download the app" — store badges + a QR code (store link once published, the live site until then). */
function AppDownloadBlock() {
  const { appStore, googlePlay } = siteConfig.apps;
  const qrTarget = appStore || googlePlay || siteConfig.url;

  return (
    <div className="flex flex-col gap-3 lg:w-60">
      <p className="text-xs font-medium tracking-[0.14em] text-white uppercase">
        Download the app
      </p>
      <div className="flex items-center gap-3 lg:flex-col lg:items-stretch">
        <div className="flex flex-1 flex-col gap-2">
          <StoreBadge href={appStore} store="App Store" eyebrow="Download on the" icon={<AppleIcon />} />
          <StoreBadge href={googlePlay} store="Google Play" eyebrow="Get it on" icon={<GooglePlayIcon />} />
        </div>
        <div className="flex shrink-0 items-center gap-3 lg:mt-1">
          <div
            data-keep-white
            className="rounded-xl bg-white p-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]"
          >
            <QRCodeSVG
              value={qrTarget}
              size={88}
              level="M"
              bgColor="#ffffff"
              fgColor="#0b1b33"
              title="Scan to open Request Service on your phone"
            />
          </div>
          <p className="hidden max-w-[7.5rem] text-xs leading-5 text-white/70 lg:block">
            Scan with your phone camera to get started.
          </p>
        </div>
      </div>
    </div>
  );
}

function StoreBadge({
  href,
  store,
  eyebrow,
  icon,
}: {
  href: string;
  store: string;
  eyebrow: string;
  icon: React.ReactNode;
}) {
  const body = (
    <>
      <span className="size-6 shrink-0">{icon}</span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] text-white/70">{href ? eyebrow : "Coming soon to"}</span>
        <span className="text-sm font-semibold text-white">{store}</span>
      </span>
    </>
  );
  const className =
    "flex h-12 items-center gap-2.5 rounded-xl border border-white/20 bg-black/25 px-3.5 text-white transition-colors dark:bg-white/5";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${className} hover:border-white/60 hover:bg-black/40 dark:hover:bg-white/10`}>
      {body}
    </a>
  ) : (
    <span className={`${className} cursor-default opacity-80`} aria-label={`${store} — coming soon`}>
      {body}
    </span>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-6">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.3-3.5ZM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23Z" />
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
      <path fill="#34A853" d="M3.6 2.3c-.2.2-.3.6-.3 1v17.4c0 .4.1.8.3 1l9.7-9.7L3.6 2.3Z" />
      <path fill="#FBBC04" d="m16.5 15.2-3.2-3.2 3.2-3.2 3.7 2.1c1 .6 1 1.6 0 2.2l-3.7 2.1Z" />
      <path fill="#EA4335" d="M16.5 15.2 13.3 12l-9.7 9.7c.4.4.9.4 1.6.1l11.3-6.6Z" />
      <path fill="#4285F4" d="M16.5 8.8 5.2 2.2c-.7-.4-1.2-.3-1.6.1l9.7 9.7 3.2-3.2Z" />
    </svg>
  );
}
