import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { BlogCard } from "@/components/shared/blog-card";
import { BlogComments } from "@/components/blog/blog-comments";
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
  const readTimeMinutes = apiPost.readTimeMinutes || 5;

  const comments = apiPost.comments || [];

  // Related posts from live API in same category
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

  // Determine if content is HTML or plain text
  const isHtml =
    typeof rawContent === "string" && /<[a-z][\s\S]*>/i.test(rawContent);

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
              readTimeMinutes,
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

          <Container className="flex flex-col gap-5 py-10 md:py-14">
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
                <li className="font-medium text-foreground" aria-current="page">
                  {categoryName}
                </li>
              </ol>
            </nav>

            <div className="flex max-w-3xl flex-col gap-4">
              <Badge variant="secondary" className="w-fit" asChild>
                <Link href={`/blog/category/${categorySlug}`}>
                  {categoryName}
                </Link>
              </Badge>
              <h1 className="text-3xl font-semibold text-pretty md:text-[2.5rem]">
                {title}
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                {description}
              </p>
              {publishedAt ? (
                <p className="text-sm text-muted-foreground">
                  {formatDate(publishedAt)}
                </p>
              ) : null}
            </div>
          </Container>
        </section>



        <div className="section-space">
          <Container className="grid gap-10 lg:grid-cols-[minmax(0,42rem)_minmax(0,16rem)] lg:justify-between">
            <div className="flex flex-col gap-5 text-base leading-7 text-muted-foreground">
              {/* Render Content */}
              {isHtml ? (
                <div
                  className="ck-content blog-content prose prose-neutral max-w-none dark:prose-invert"
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

              {/* Navigation Back */}
              <div className="mt-4 border-t pt-6">
                <Button variant="outline" asChild>
                  <Link href="/blog">
                    <ArrowLeft data-icon="inline-start" />
                    Back to blog
                  </Link>
                </Button>
              </div>

              {/* Interactive Comments & Submission Form */}
              <BlogComments slug={slug} initialComments={comments} />
            </div>

            {/* Sticky Sidebar */}
            <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-medium">Article Details</p>
              <dl className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">

                {publishedAt ? (
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">Published</dt>
                    <dd>{formatDate(publishedAt)}</dd>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">Category</dt>
                  <dd>
                    <Link
                      href={`/blog/category/${categorySlug}`}
                      className="font-medium text-brand hover:text-foreground"
                    >
                      {categoryName}
                    </Link>
                  </dd>
                </div>
              </dl>
            </aside>
          </Container>
        </div>
      </article>

      {related.length ? (
        <section className="border-t bg-muted/40 py-10 md:py-12">
          <Container className="flex flex-col gap-6">
            <h2 className="text-2xl font-semibold">Related articles</h2>
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
