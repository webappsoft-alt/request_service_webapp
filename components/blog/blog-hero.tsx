import Image from "next/image";
import Link from "next/link";
import { BookOpen, Briefcase, Home, Rocket, Wrench } from "lucide-react";
import { Container } from "@/components/layout/container";
import { blogPaths, type BlogSite } from "@/lib/data/blog-audience";
import { proPaths } from "@/lib/pro-paths";
import { HERO_HOME_IMAGE } from "@/lib/site";

/** Each blog's hero: its topic shortcuts, default copy and breadcrumb root. */
const HERO = {
  customer: {
    title: "Guides for hiring, estimates, and getting the job done",
    description:
      "Practical writing for homeowners — how to request work, compare and approve estimates, handle change orders, and look after your home.",
    root: { label: "Home", href: "/" },
    topics: [
      { label: "For homeowners", hint: "Hiring and estimates", href: blogPaths.category("customer", "homeowners"), icon: Home },
      { label: "Home maintenance", hint: "Seasonal checklists", href: blogPaths.category("customer", "maintenance"), icon: Wrench },
      { label: "How the platform works", hint: "Requests to payments", href: blogPaths.category("customer", "platform"), icon: BookOpen },
    ],
  },
  pro: {
    title: "Insights for running a home service business",
    description:
      "Practical playbooks for Pros — win more estimates, manage change orders, schedule your crew, cut no-shows, and get paid faster.",
    root: { label: "For Pros", href: proPaths.home },
    topics: [
      { label: "For service businesses", hint: "Estimates, jobs, invoices", href: blogPaths.category("pro", "service-business"), icon: Briefcase },
      { label: "Platform news", hint: "What's new for Pros", href: blogPaths.category("pro", "platform"), icon: BookOpen },
      { label: "Join as a Pro", hint: "No commission on your work", href: proPaths.join, icon: Rocket },
    ],
  },
} as const;

export function BlogHero({
  site = "customer",
  title,
  description,
  eyebrow,
  current = "Blog",
}: {
  site?: BlogSite;
  title?: string;
  description?: string;
  eyebrow?: string;
  current?: string;
}) {
  const hero = HERO[site];
  const topics = hero.topics;
  title ??= hero.title;
  description ??= hero.description;
  eyebrow ??= site === "pro" ? "Pro insights" : "Journal";
  const blogHref = blogPaths.index(site);
  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative min-h-[17rem] w-full sm:min-h-[19rem] lg:min-h-[21rem]">
        <Image
          src={HERO_HOME_IMAGE}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[50%_28%]"
          preload
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
            <ol className="flex items-center gap-2 text-sm text-white/70">
              <li>
                <Link href={hero.root.href} className="transition-colors hover:text-white">
                  {hero.root.label}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              {current === "Blog" ? (
                <li className="font-medium text-white" aria-current="page">
                  Blog
                </li>
              ) : (
                <>
                  <li>
                    <Link href={blogHref} prefetch={false} className="transition-colors hover:text-white">
                      Blog
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li className="font-medium text-white" aria-current="page">
                    {current}
                  </li>
                </>
              )}
            </ol>
          </nav>

          <div className="max-w-2xl">
            <p className="eyebrow text-white/75">{eyebrow}</p>
            <h1 className="mt-2 text-[1.85rem] leading-[1.08] sm:text-[2.35rem] lg:text-[2.75rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-lg text-sm text-white/80 md:text-base">
              {description}
            </p>
          </div>

          <ol className="grid gap-2 sm:grid-cols-3 sm:gap-3 lg:max-w-3xl">
            {topics.map((topic) => (
              <li key={topic.href}>
                <Link
                  href={topic.href}
                  prefetch={false}
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-3.5 py-3 backdrop-blur-sm transition-colors hover:bg-white/14"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12">
                    <topic.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[11px] font-semibold tracking-wide text-white/55 uppercase">
                      {topic.hint}
                    </span>
                    <span className="text-sm font-medium">{topic.label}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Container>
      </div>
    </section>
  );
}
