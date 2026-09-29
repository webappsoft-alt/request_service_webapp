"use client";

import { useEffect } from "react";
import { ArrowRight, AtSign, Clock, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchSiteBranding,
  selectSiteBranding,
} from "@/store/siteBrandingSlice";

export function ContactHeroActions() {
  const dispatch = useAppDispatch();
  const branding = useAppSelector(selectSiteBranding);

  useEffect(() => {
    void dispatch(fetchSiteBranding());
  }, [dispatch]);

  return (
    <>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button size="xl" asChild>
          <a href="#contact-form">
            Send a message
            <ArrowRight data-icon="inline-end" />
          </a>
        </Button>
        <Button size="xl" variant="outline" asChild>
          <a href={`mailto:${branding.email}`}>Email us</a>
        </Button>
      </div>

      <dl className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <dd className="font-medium">{branding.email}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <dd className="font-medium">{branding.phone}</dd>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          <dd>{branding.hoursSummary}</dd>
        </div>
      </dl>
    </>
  );
}

export function ContactConnectCards() {
  const branding = useAppSelector(selectSiteBranding);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-2">
      <article className="flex items-center gap-5 rounded-xl border bg-card px-6 py-7 shadow-sm">
        <Mail className="size-10 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Send a message</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            We’ll get back to you as soon as possible.
          </p>
          <a
            href="#contact-form"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            Send a message
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </article>
      <article className="flex items-center gap-5 rounded-xl border bg-card px-6 py-7 shadow-sm">
        <AtSign className="size-10 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Send an email</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Reach us anytime at {branding.email}
          </p>
          <a
            href={`mailto:${branding.email}`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            Send an email
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </article>
    </div>
  );
}

export function ContactReachAside() {
  const branding = useAppSelector(selectSiteBranding);
  const addressLines = [branding.address, branding.address2].filter(Boolean);
  const phones = [
    { label: branding.phone, href: branding.phoneHref },
    branding.phone2
      ? { label: branding.phone2, href: branding.phone2Href }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;
  const emails = [branding.email, branding.email2].filter(Boolean);

  return (
    <aside className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
      <h2 className="mb-8 text-2xl font-semibold">Other ways to reach us</h2>
      <ul className="flex flex-col gap-8">
        <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
          <Clock className="mt-0.5 size-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Business Hours</h3>
            <div className="mt-1 space-y-1 text-sm leading-6 text-muted-foreground">
              {branding.hoursDetailed.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            {branding.closedDates.length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Closed dates:{" "}
                {branding.closedDates
                  .map((date) =>
                    new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }),
                  )
                  .join(", ")}
              </p>
            ) : null}
          </div>
        </li>
        <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
          <Mail className="mt-0.5 size-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Email</h3>
            <div className="mt-1 space-y-1 text-sm leading-6">
              {emails.map((email) => (
                <p key={email}>
                  <a
                    href={`mailto:${email}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {email}
                  </a>
                </p>
              ))}
            </div>
          </div>
        </li>
        <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
          <MapPin className="mt-0.5 size-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Mailing Address</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {addressLines.map((line, index) => (
                <span key={`${line}-${index}`}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
          </div>
        </li>
        <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
          <Phone className="mt-0.5 size-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Phone</h3>
            <div className="mt-1 space-y-1 text-sm leading-6">
              {phones.map((item) => (
                <p key={item.label}>
                  <a
                    href={item.href || undefined}
                    className="font-medium text-brand hover:underline"
                  >
                    {item.label}
                  </a>
                </p>
              ))}
            </div>
          </div>
        </li>
      </ul>
    </aside>
  );
}
