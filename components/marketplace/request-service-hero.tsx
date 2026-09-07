import Image from "next/image";
import Link from "next/link";
import { Briefcase, ClipboardList, MapPin, UserRound } from "lucide-react";
import { Container } from "@/components/layout/container";
import { getJobImage, getProviderPhotos } from "@/lib/data/provider-media";
import type { Provider, ServiceCategory } from "@/lib/types";

const fallbackSteps = [
  { label: "Choose a service", hint: "Step 01", icon: Briefcase },
  { label: "Add your ZIP", hint: "Step 02", icon: MapPin },
  { label: "Describe the work", hint: "Step 03", icon: ClipboardList },
];

export function RequestServiceHero({
  category,
  job,
  jobIndex,
  provider,
  zip,
  intent = "request",
  fixedServiceName,
}: {
  category?: ServiceCategory;
  job?: string;
  jobIndex?: number;
  provider?: Provider;
  zip?: string;
  intent?: "request" | "book";
  fixedServiceName?: string;
}) {
  const photos = provider ? getProviderPhotos(provider) : [];
  const image =
    (category && job ? getJobImage(category.id, job, jobIndex) : undefined) ??
    category?.image ??
    photos[0]?.src ??
    provider?.coverImage ??
    "/images/home/hero-home.jpg";

  const title = provider
    ? intent === "book" && fixedServiceName
      ? `Book ${fixedServiceName}`
      : intent === "book"
        ? `Book ${provider.companyName}`
        : `Request ${provider.companyName}`
    : job
      ? `Request ${job}`
      : category
        ? `Request ${category.name.toLowerCase()}`
        : "Tell us what you need";

  const description = provider
    ? intent === "book" && fixedServiceName
      ? `${fixedServiceName} is a priced service. Confirm your address and time and ${provider.companyName} opens it as a job — no estimate.`
      : `This request goes to ${provider.companyName}${category ? ` for ${category.name.toLowerCase()}` : ""}${job ? ` — ${job}` : ""}. Add your ZIP and a short description so they can send a written estimate.`
    : job && category
      ? `${category.name} in your area. Add your ZIP and any notes so local pros can review ${job.toLowerCase()} and send a written estimate.`
      : category
        ? `Choose the ${category.name.toLowerCase()} job, add your ZIP, and describe the work. Matching licensed pros send a written estimate before anything starts.`
        : "Choose a service, add your ZIP, and describe the work. Or start from Find a professional to answer a few job questions first.";

  const facts = [
    category
      ? { label: "Service", value: category.name, icon: Briefcase }
      : undefined,
    fixedServiceName
      ? { label: "Fixed service", value: fixedServiceName, icon: ClipboardList }
      : job
        ? { label: "Job", value: job, icon: ClipboardList }
        : undefined,
    provider
      ? { label: "Professional", value: provider.companyName, icon: UserRound }
      : undefined,
    zip ? { label: "ZIP", value: zip, icon: MapPin } : undefined,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const chips = facts.length ? facts : fallbackSteps.map((step) => ({
    label: step.hint,
    value: step.label,
    icon: step.icon,
  }));

  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative min-h-[17rem] w-full sm:min-h-[19rem] lg:min-h-[21rem]">
        <Image
          src={image}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[50%_28%]"
          priority
        />
        <div
          className="absolute inset-0 bg-[rgba(4,26,54,0.62)] lg:hidden"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 hidden bg-[linear-gradient(100deg,rgba(4,26,54,0.9)_0%,rgba(4,26,54,0.72)_34%,rgba(4,26,54,0.42)_58%,rgba(4,26,54,0.16)_78%)] lg:block"
          aria-hidden="true"
        />

        <Container className="relative flex min-h-[17rem] flex-col justify-center gap-5 py-8 text-white sm:min-h-[19rem] md:py-10 lg:min-h-[21rem]">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-white/70">
              <li>
                <Link href="/" className="transition-colors hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              {category ? (
                <>
                  <li>
                    <Link href="/services" className="transition-colors hover:text-white">
                      Services
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link
                      href={`/services/${category.slug}`}
                      className="transition-colors hover:text-white"
                    >
                      {category.name}
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                </>
              ) : null}
              <li className="font-medium text-white" aria-current="page">
                Request service
              </li>
            </ol>
          </nav>

          <div className="max-w-2xl">
            <p className="eyebrow text-white/75">
              {provider ? "Direct request" : category ? category.shortName : "Request"}
            </p>
            <h1 className="mt-2 text-[1.85rem] leading-[1.08] sm:text-[2.35rem] lg:text-[2.75rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-lg text-sm text-white/80 md:text-base">
              {description}
            </p>
          </div>

          <ol className="grid gap-2 sm:grid-cols-3 sm:gap-3 lg:max-w-3xl">
            {chips.slice(0, 3).map((chip) => (
              <li
                key={`${chip.label}-${chip.value}`}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-3.5 py-3 backdrop-blur-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12">
                  <chip.icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[11px] font-semibold tracking-wide text-white/55 uppercase">
                    {chip.label}
                  </span>
                  <span className="line-clamp-1 text-sm font-medium">{chip.value}</span>
                </span>
              </li>
            ))}
          </ol>
        </Container>
      </div>
    </section>
  );
}
