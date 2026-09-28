import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { BlogCard } from "@/components/shared/blog-card";
import { BlogComments } from "@/components/blog/blog-comments";
import { BlogEngagement } from "@/components/blog/blog-engagement";
import { JsonLd } from "@/components/seo/json-ld";
import {
  categoryNameToSlug,
  fetchPublicBlogBySlug,
  fetchPublicBlogs,
} from "@/lib/data/public-blogs";
import { formatDate } from "@/lib/format";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";
import type { PublicBlogItem } from "@/lib/types";

export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const apiPost = await fetchPublicBlogBySlug(slug);

  if (!apiPost) {
    return buildMetadata({
      title: "Article not found",
      description: "That article is not available.",
      path: `/blog/${slug}`,
      index: false,
    });
  }

  const title = apiPost.meta?.title || apiPost.title || "";
  const description =
    apiPost.meta?.description || apiPost.description || "";
  const publishedTime = apiPost.publishedAt;
  const modifiedTime = apiPost.updatedAt;
  const authorName = apiPost.authorName || "Request Service Editorial";

  return buildMetadata({
    title,
    description,
    path: `/blog/${slug}`,
    ogType: "article",
    publishedTime,
    modifiedTime,
    authors: [authorName],
  });
}

export default async function BlogArticlePage({
  params,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const apiPost = await fetchPublicBlogBySlug(slug);

  if (!apiPost) notFound();

  const title = apiPost.title;
  const description = apiPost.description;
  const publishedAt = apiPost.publishedAt;
  const image = apiPost.image || apiPost.coverImage || null;

  const categoryName = apiPost.category || "Article";
  const categorySlug = categoryNameToSlug(apiPost.category);

  const authorName = apiPost.authorName || "Request Service Editorial";
  const authorRole = "Editorial Team";

  const rawContent = apiPost.content;

  const comments = apiPost.comments || [];
  const commentCount =
    typeof apiPost.commentCount === "number"
      ? apiPost.commentCount
      : comments.filter((c) => !c.isDisabled).length;
  const viewCount =
    typeof apiPost.viewCount === "number" ? apiPost.viewCount : 0;
  const likeCount =
    typeof apiPost.likeCount === "number" ? apiPost.likeCount : 0;

  let related: PublicBlogItem[] = [];
  try {
    const res = await fetchPublicBlogs({
      limit: 4,
      category: apiPost.category || undefined,
    });
    if (res.data) {
      related = res.data.filter((p) => p.slug !== slug).slice(0, 3);
    }
  } catch {
    related = [];
  }

  const isHtml =
    typeof rawContent === "string" && /<[a-z][\s\S]*>/i.test(rawContent);
  const isExternalImage = Boolean(image?.startsWith("http"));

  return (
    <>
      <JsonLd
        data={[
          articleJsonLd(
            {
              id: apiPost._id || slug,
              slug,
              title,
              description,
              content: Array.isArray(rawContent)
                ? rawContent
                : [String(rawContent || "")],
              categoryId: categorySlug,
              authorId: "author_editorial",
              publishedAt: publishedAt || new Date().toISOString(),
              updatedAt:
                apiPost.updatedAt || publishedAt || new Date().toISOString(),
              imageAlt: title,
              image: image || undefined,
            },
            authorName,
          ),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: title, path: `/blog/${slug}` },
          ]),
        ]}
      />

      <article>
        <section className="relative isolate overflow-hidden border-b">
          <div
            className="page-wash pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
          />
          <div
            className="hero-grid pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
          />

          <Container className="flex flex-col gap-6 py-10 md:py-14">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/"
                    className="transition-colors hover:text-primary"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    href="/blog"
                    className="transition-colors hover:text-primary"
                  >
                    Blog
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    href={`/blog/category/${categorySlug}`}
                    className="transition-colors hover:text-primary"
                  >
                    {categoryName}
                  </Link>
                </li>
              </ol>
            </nav>

            <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <div className="flex max-w-3xl flex-col gap-4">
                <Badge variant="secondary" className="w-fit" asChild>
                  <Link href={`/blog/category/${categorySlug}`}>
                    {categoryName}
                  </Link>
                </Badge>
                <h1 className="text-3xl font-semibold tracking-tight text-pretty md:text-[2.65rem] md:leading-[1.15]">
                  {title}
                </h1>
                {description ? (
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                    {description}
                  </p>
                ) : null}

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="size-3.5 text-primary" aria-hidden />
                    {authorName}
                  </span>
                  {publishedAt ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays
                        className="size-3.5 text-primary"
                        aria-hidden
                      />
                      {formatDate(publishedAt)}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare
                      className="size-3.5 text-primary"
                      aria-hidden
                    />
                    {commentCount}{" "}
                    {commentCount === 1 ? "comment" : "comments"}
                  </span>
                </div>

                <BlogEngagement
                  slug={slug}
                  initialViews={viewCount}
                  initialLikes={likeCount}
                />
              </div>

              {image ? (
                <div className="relative aspect-[16/11] overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm">
                  <Image
                    src={image}
                    alt={title}
                    fill
                    priority
                    unoptimized={isExternalImage}
                    sizes="(min-width: 1024px) 22rem, 100vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
            </div>
          </Container>
        </section>

        <div className="section-space">
          <Container className="grid gap-10 lg:grid-cols-[minmax(0,44rem)_minmax(0,17rem)] lg:justify-between">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
                <Button variant="outline" asChild>
                  <Link href="/blog">
                    <ArrowLeft data-icon="inline-start" />
                    Back to blog
                  </Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href={`/blog/category/${categorySlug}`}>
                    More in {categoryName}
                  </Link>
                </Button>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card/40 px-1 py-1 sm:px-2">
                <div className="blog-content ck-content prose prose-neutral max-w-none px-3 py-4 text-base leading-7 dark:prose-invert sm:px-5 sm:py-6">
                  {isHtml ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: String(rawContent) }}
                    />
                  ) : Array.isArray(rawContent) ? (
                    rawContent.map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))
                  ) : typeof rawContent === "string" ? (
                    rawContent
                      .split(/\n\n+/)
                      .map((paragraph, idx) => <p key={idx}>{paragraph}</p>)
                  ) : null}
                </div>
              </div>

              <BlogComments
                slug={slug}
                blogId={apiPost._id}
                commentsEnabled={apiPost.commentsEnabled !== false}
                initialComments={comments}
              />
            </div>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-semibold tracking-tight">
                Article details
              </p>
              <dl className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 text-sm shadow-xs">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Author
                  </dt>
                  <dd className="font-medium text-foreground">{authorName}</dd>
                  <dd className="text-xs text-muted-foreground">{authorRole}</dd>
                </div>

                {publishedAt ? (
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Published
                    </dt>
                    <dd className="font-medium text-foreground">
                      {formatDate(publishedAt)}
                    </dd>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Views
                  </dt>
                  <dd className="font-medium text-foreground">
                    {viewCount.toLocaleString()}
                  </dd>
                </div>

                <div className="flex flex-col gap-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Likes
                  </dt>
                  <dd className="font-medium text-foreground">
                    {likeCount.toLocaleString()}
                  </dd>
                </div>

                <div className="flex flex-col gap-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Category
                  </dt>
                  <dd>
                    <Link
                      href={`/blog/category/${categorySlug}`}
                      className="font-medium text-brand hover:text-foreground"
                    >
                      {categoryName}
                    </Link>
                  </dd>
                </div>

                <div className="flex flex-col gap-1 border-t border-border/60 pt-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Discussion
                  </dt>
                  <dd className="font-medium text-foreground">
                    {commentCount}{" "}
                    {commentCount === 1 ? "comment" : "comments"}
                  </dd>
                </div>
              </dl>

              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-5">
                <p className="text-sm font-semibold text-foreground">
                  Need a local pro?
                </p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Submit a ZIP-matched request or browse professionals near you.
                </p>
                <Button asChild size="sm" className="mt-4 w-full rounded-xl">
                  <Link href="/request-service">Request a service</Link>
                </Button>
              </div>
            </aside>
          </Container>
        </div>
      </article>

      {related.length ? (
        <section className="border-t bg-muted/40 py-10 md:py-12">
          <Container className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <p className="eyebrow text-primary">Keep reading</p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Related articles
              </h2>
            </div>
            <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
              {related.map((item) => (
                <BlogCard key={item._id || item.slug} post={item} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
