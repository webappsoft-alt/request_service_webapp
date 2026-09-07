import Image from "next/image";
import Link from "next/link";
import { BookOpen, Briefcase, Home } from "lucide-react";
import { Container } from "@/components/layout/container";

const topics = [
  { label: "For homeowners", hint: "Hiring and estimates", href: "/blog/category/homeowners", icon: Home },
  { label: "For service businesses", hint: "Jobs and invoices", href: "/blog/category/service-business", icon: Briefcase },
  { label: "How the platform works", hint: "Requests to payments", href: "/blog/category/platform", icon: BookOpen },
];

export function BlogHero({
  title = "Guides for hiring, estimates, and running the job",
  description = "Practical writing for homeowners and local operators — how to request work, read an estimate, and keep the record clean when the scope changes.",
  eyebrow = "Journal",
  current = "Blog",
}: {
  title?: string;
  description?: string;
  eyebrow?: string;
  current?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative min-h-[17rem] w-full sm:min-h-[19rem] lg:min-h-[21rem]">
        <Image
          src="/images/blog/blog-request.jpg"
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
            <ol className="flex items-center gap-2 text-sm text-white/70">
              <li>
                <Link href="/" className="transition-colors hover:text-white">
                  Home
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
                    <Link href="/blog" className="transition-colors hover:text-white">
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
