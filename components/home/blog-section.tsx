import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { BlogCard } from "@/components/shared/blog-card";
import { blogPaths, type BlogSite } from "@/lib/data/blog-audience";
import { fetchPublicBlogs } from "@/lib/data/public-blogs";
import type { PublicBlogItem } from "@/lib/types";

interface BlogSectionProps {
  /** customer → articles for /blog, pro → articles for /for-pros/blog (Pro landing page). */
  site?: BlogSite;
  eyebrow?: string;
  title?: string;
  description?: string;
  linkText?: string;
  linkHref?: string;
  limit?: number;
  category?: string;
  className?: string;
}

const COPY = {
  customer: {
    eyebrow: "From the journal",
    title: "Guides for homeowners",
    description: "Practical writing on hiring local pros, comparing estimates, and looking after your home.",
    linkText: "Read the journal",
  },
  pro: {
    eyebrow: "Pro insights",
    title: "Playbooks for running your service business",
    description:
      "Win more estimates, handle change orders, schedule your crew, and get paid faster — written for home service Pros.",
    linkText: "Read the Pro blog",
  },
} as const;

/**
 * Latest published articles for one blog, straight from the blogs API (no static fallback cards —
 * the section hides itself when there is nothing published yet).
 */
export async function BlogSection({
  site = "customer",
  eyebrow = COPY[site].eyebrow,
  title = COPY[site].title,
  description = COPY[site].description,
  linkText = COPY[site].linkText,
  linkHref = blogPaths.index(site),
  limit = 4,
  category,
  className,
}: BlogSectionProps = {}) {
  let displayPosts: PublicBlogItem[] = [];

  try {
    const res = await fetchPublicBlogs({ limit, category, audience: site });
    if (res.data && res.data.length > 0) {
      displayPosts = res.data.slice(0, limit);
    }
  } catch {
    displayPosts = [];
  }

  // If no blog posts exist in the API, do not display static data
  if (displayPosts.length === 0) {
    return null;
  }

  return (
    <Section className={className}>
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="eyebrow text-primary">{eyebrow}</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
              {title}
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              {description}
            </p>
          </div>
          <Link
            href={linkHref}
            prefetch={false}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-foreground"
          >
            {linkText}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {displayPosts.map((post) => (
            <BlogCard key={post._id || post.slug} post={post} site={site} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
