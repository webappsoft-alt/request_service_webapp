import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { BlogCard } from "@/components/shared/blog-card";
import { fetchPublicBlogs } from "@/lib/data/public-blogs";
import { blogPosts } from "@/lib/data/blog";
import type { BlogPost, PublicBlogItem } from "@/lib/types";

export async function BlogSection() {
  let displayPosts: (BlogPost | PublicBlogItem)[] = [];

  try {
    const res = await fetchPublicBlogs({ limit: 4 });
    if (res.data && res.data.length > 0) {
      displayPosts = res.data;
      // If fewer than 4 live posts, backfill from fallback
      if (displayPosts.length < 4) {
        const remaining = 4 - displayPosts.length;
        const extra = blogPosts.filter((p) => p.image).slice(0, remaining);
        displayPosts = [...displayPosts, ...extra];
      }
    } else {
      displayPosts = blogPosts.filter((post) => post.image).slice(0, 4);
    }
  } catch {
    displayPosts = blogPosts.filter((post) => post.image).slice(0, 4);
  }

  return (
    <Section>
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="eyebrow text-primary">From the journal</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
              Guides for homeowners and operators
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              Practical writing on hiring contractors, reading an estimate, and running a service
              business.
            </p>
          </div>
          <Link
            href="/blog"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-foreground"
          >
            Read the journal
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {displayPosts.map((post) => (
            <BlogCard
              key={"_id" in post ? post._id : post.id}
              post={post}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
