import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { extractFirstImageUrl } from "@/lib/data/public-blogs";
import { formatDate } from "@/lib/format";
import type { BlogPost, PublicBlogItem } from "@/lib/types";

export function BlogCard({ post }: { post: BlogPost | PublicBlogItem }) {
  const categoryName =
    "category" in post && typeof post.category === "string" && post.category
      ? post.category
      : "Journal";

  const authorName =
    "authorName" in post && post.authorName
      ? post.authorName
      : "Request Services Editorial";

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

  const readTime =
    post.readTimeMinutes ||
    (post.content
      ? Math.max(
          3,
          Math.ceil(
            (typeof post.content === "string"
              ? post.content.split(/\s+/).length
              : post.content.join(" ").split(/\s+/).length) / 200,
          ),
        )
      : 5);

  const commentCount =
    "commentCount" in post && typeof post.commentCount === "number"
      ? post.commentCount
      : "comments" in post && Array.isArray(post.comments)
        ? post.comments.length
        : 0;

  const isExternalImage = Boolean(imageSrc?.startsWith("http"));

  return (
    <Card className="h-full gap-0 border-black/15 pt-0 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:elevate">
      <Link href={`/blog/${post.slug}`} className="group flex h-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-primary">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              unoptimized={isExternalImage}
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 40vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="relative flex size-full flex-col justify-between bg-gradient-to-br from-primary via-primary/90 to-neutral-900 p-5 text-white">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_12%,color-mix(in_oklab,white_16%,transparent),transparent_46%)]"
                aria-hidden="true"
              />
              <span className="relative z-10 w-fit rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
                {categoryName}
              </span>
              <span className="relative z-10 text-sm font-medium text-white/80">
                Request Services Journal
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-4">
          <div className="flex items-center justify-between text-xs">
            <p className="eyebrow text-primary">
              {categoryName}
            </p>
            {commentCount > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                <MessageSquare className="size-3.5" aria-hidden="true" />
                {commentCount}
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold tracking-tight text-balance">
            {post.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {post.description}
          </p>

          {post.publishedAt ? (
            <p className="mt-auto text-xs text-muted-foreground">
              {formatDate(post.publishedAt)}
            </p>
          ) : null}

          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors group-hover:text-foreground">
            Continue reading
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </Card>
  );
}

