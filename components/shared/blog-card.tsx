import Link from "next/link";
import { ArrowRight, CalendarDays, Eye, Heart, MessageSquare } from "lucide-react";
import { BlogImage } from "@/components/blog/blog-image";
import { extractFirstImageUrl } from "@/lib/data/public-blogs";
import { formatDate } from "@/lib/format";
import type { BlogPost, PublicBlogItem } from "@/lib/types";

export function BlogCard({ post }: { post: BlogPost | PublicBlogItem }) {
  const categoryName =
    "category" in post && typeof post.category === "string" && post.category
      ? post.category
      : "Journal";

  const extractedFromContent =
    "content" in post && typeof post.content === "string"
      ? extractFirstImageUrl(post.content)
      : undefined;

  const imageSrc =
    post.image ||
    extractedFromContent ||
    ("coverImage" in post && post.coverImage ? post.coverImage : undefined) ||
    ("thumbnail" in post && post.thumbnail ? post.thumbnail : undefined);

  const imageAlt =
    "imageAlt" in post && post.imageAlt ? post.imageAlt : post.title;

  const commentCount = Number(
    "commentCount" in post && post.commentCount != null
      ? post.commentCount
      : "comments" in post && Array.isArray(post.comments)
        ? post.comments.length
        : 0,
  ) || 0;

  const viewCount = Number(
    "viewCount" in post && post.viewCount != null ? post.viewCount : 0,
  ) || 0;
  const likeCount = Number(
    "likeCount" in post && post.likeCount != null ? post.likeCount : 0,
  ) || 0;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        <BlogImage
          src={imageSrc}
          alt={imageAlt}
          sizes="(min-width: 1280px) 24rem, (min-width: 768px) 45vw, 100vw"
          className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide text-primary uppercase shadow-xs backdrop-blur-sm">
          {categoryName}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        {post.publishedAt ? (
          <time
            dateTime={post.publishedAt}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatDate(post.publishedAt)}
          </time>
        ) : null}

        <h3 className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight text-balance text-foreground transition-colors group-hover:text-primary">
          <Link
            href={`/blog/${post.slug}`}
            prefetch={false}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {post.title}
          </Link>
        </h3>
        {post.description ? (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {post.description}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1" aria-label={`${viewCount} views`}>
              <Eye className="size-3.5 shrink-0" aria-hidden="true" />
              {viewCount.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1" aria-label={`${likeCount} likes`}>
              <Heart className="size-3.5 shrink-0" aria-hidden="true" />
              {likeCount.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1" aria-label={`${commentCount} comments`}>
              <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
              {commentCount.toLocaleString()}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary" aria-hidden="true">
            Read article
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
