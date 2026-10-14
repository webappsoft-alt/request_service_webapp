import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Eye,
  Heart,
  MessageSquare,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { BlogCard } from "@/components/shared/blog-card";
import { BlogComments } from "@/components/blog/blog-comments";
import { BlogEngagement } from "@/components/blog/blog-engagement";
import { BlogImage } from "@/components/blog/blog-image";
import { BlogShare } from "@/components/blog/blog-share";
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

// One backend request per page view, shared by generateMetadata and the page.
const getPost = cache(fetchPublicBlogBySlug);

// Rendered per request: the article is fetched with no-store so comments stay fresh.
// (A generateStaticParams export made this route static, and the no-store fetch then
// failed in production with "Page changed from static to dynamic at runtime" → 500.)

/** The cover is shown above the article, so drop the same image from the top of the body. */
function stripLeadingCover(html: string, cover: string | null): string {
  if (!cover) return html;
  const lead = html.match(
    /^\s*(?:<figure\b[^>]*>[\s\S]*?<\/figure>|<p>\s*<img\b[^>]*>\s*<\/p>|<img\b[^>]*>)/i,
  );
  if (!lead) return html;
  const src = lead[0].match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  return src && src.trim() === cover.trim() ? html.slice(lead[0].length) : html;
}

/** Drop an opening paragraph that only repeats the summary shown in the header. */
function stripLeadingSummary(html: string, summary?: string | null): string {
  const norm = (value: string) =>
    value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!summary) return html;
  const lead = html.match(/^\s*<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return lead && norm(lead[1]) === norm(summary) ? html.slice(lead[0].length) : html;
}

function readingMinutes(content: unknown): number {
  const text = Array.isArray(content)
    ? content.join(" ")
    : String(content || "").replace(/<[^>]+>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "RS"
  );
}

export async function generateMetadata({
  params,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const apiPost = await getPost(slug);

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
  const apiPost = await getPost(slug);

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
  const minutes = readingMinutes(rawContent);

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
  const bodyHtml = isHtml
    ? stripLeadingSummary(stripLeadingCover(String(rawContent), image), description)
    : "";

  const stats = [
    { label: "Views", value: viewCount, icon: Eye },
    { label: "Likes", value: likeCount, icon: Heart },
    { label: "Comments", value: commentCount, icon: MessageSquare },
  ];

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
        <header className="relative isolate overflow-hidden border-b border-border/60 bg-muted/30">
          <div
            className="page-wash pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
          />
          <Container className="flex flex-col gap-8 pt-8 pb-10 md:pt-12 md:pb-14">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/"
                    prefetch={false}
                    className="transition-colors hover:text-primary"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    href="/blog"
                    prefetch={false}
                    className="transition-colors hover:text-primary"
                  >
                    Blog
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    href={`/blog/category/${categorySlug}`}
                    prefetch={false}
                    className="font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {categoryName}
                  </Link>
                </li>
              </ol>
            </nav>

            <div className="flex max-w-3xl flex-col gap-5">
              <Link
                href={`/blog/category/${categorySlug}`}
                prefetch={false}
                className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase transition-colors hover:bg-primary/15"
              >
                {categoryName}
              </Link>
              <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-5xl md:leading-[1.08]">
                {title}
              </h1>
              {description ? (
                <p className="max-w-2xl text-base leading-7 text-pretty text-muted-foreground md:text-lg md:leading-8">
                  {description}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                    aria-hidden="true"
                  >
                    {initials(authorName)}
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-foreground">
                      {authorName}
                    </p>
                    <p className="text-xs text-muted-foreground">{authorRole}</p>
                  </div>
                </div>
                <span className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {publishedAt ? (
                    <time
                      dateTime={publishedAt}
                      className="inline-flex items-center gap-1.5"
                    >
                      <CalendarDays className="size-4" aria-hidden="true" />
                      {formatDate(publishedAt)}
                    </time>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-4" aria-hidden="true" />
                    {minutes} min read
                  </span>
                </div>
              </div>
            </div>

            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border/40 bg-neutral-200 shadow-sm md:aspect-[21/9] dark:bg-neutral-800">
              <BlogImage
                src={image}
                alt={title}
                priority
                sizes="(min-width: 1280px) 76rem, 100vw"
              />
              {image ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          </Container>
        </header>

        <div className="py-10 md:py-14">
          <Container className="grid gap-12 lg:grid-cols-12 lg:gap-10 xl:gap-14">
            <div className="flex min-w-0 flex-col gap-12 lg:col-span-8">
              <div className="blog-content ck-content max-w-[46rem]">
                {isHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
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

              <div className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/70 bg-card shadow-xs">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <BlogEngagement
                    slug={slug}
                    initialViews={viewCount}
                    initialLikes={likeCount}
                  />
                  <BlogShare title={title} path={`/blog/${slug}`} />
                </div>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Filed under</span>
                    <Link
                      href={`/blog/category/${categorySlug}`}
                      prefetch={false}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      <Tag className="size-3" aria-hidden="true" />
                      {categoryName}
                    </Link>
                  </div>
                  <Button variant="ghost" size="sm" className="w-fit rounded-full" asChild>
                    <Link href="/blog" prefetch={false}>
                      <ArrowLeft data-icon="inline-start" />
                      Back to articles
                    </Link>
                  </Button>
                </div>
              </div>

              <BlogComments
                slug={slug}
                blogId={apiPost._id}
                commentsEnabled={apiPost.commentsEnabled !== false}
                initialComments={comments}
              />
            </div>

            <aside className="space-y-6 lg:sticky lg:top-24 lg:col-span-4 lg:self-start">
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  About this article
                </p>
                <dl className="mt-4 flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>
                      <Link
                        href={`/blog/category/${categorySlug}`}
                        prefetch={false}
                        className="font-medium text-primary hover:underline"
                      >
                        {categoryName}
                      </Link>
                    </dd>
                  </div>
                  {publishedAt ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Published</dt>
                      <dd className="font-medium text-foreground">
                        {formatDate(publishedAt)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Reading time</dt>
                    <dd className="font-medium text-foreground">{minutes} min</dd>
                  </div>
                </dl>
                <ul className="mt-5 grid grid-cols-3 divide-x divide-border/70 rounded-xl border border-border/70 bg-muted/40 py-3 text-center">
                  {stats.map((stat) => (
                    <li key={stat.label} className="flex flex-col items-center gap-0.5 px-1">
                      <stat.icon className="size-3.5 text-primary" aria-hidden="true" />
                      <span className="text-base font-semibold text-foreground tabular-nums">
                        {stat.value.toLocaleString()}
                      </span>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {stat.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#0b5cad] p-6 text-primary-foreground shadow-sm">
                <div
                  className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-white/10"
                  aria-hidden="true"
                />
                <p className="text-base font-semibold">Need a local pro?</p>
                <p className="mt-1.5 text-sm leading-6 text-primary-foreground/80">
                  Describe the job once and get matched with professionals near you.
                </p>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="mt-4 w-full rounded-xl"
                >
                  <Link href="/request-service" prefetch={false}>
                    Request a service
                  </Link>
                </Button>
              </div>
            </aside>
          </Container>
        </div>
      </article>

      {related.length ? (
        <section className="border-t bg-muted/40 py-12 md:py-16">
          <Container className="flex flex-col gap-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="eyebrow text-primary">Keep reading</p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Related articles
                </h2>
              </div>
              <Link
                href="/blog"
                prefetch={false}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                View all articles
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
