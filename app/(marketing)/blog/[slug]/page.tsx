import Image from "next/image";
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
  blogPosts,
  getBlogAuthorById,
  getBlogCategoryById,
  getBlogPostBySlug,
  getRelatedPosts,
} from "@/lib/data/blog";
import {
  categoryNameToSlug,
  fetchPublicBlogBySlug,
} from "@/lib/data/public-blogs";
import { formatDate } from "@/lib/format";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export const dynamicParams = true;

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const apiPost = await fetchPublicBlogBySlug(slug);
  const staticPost = !apiPost ? getBlogPostBySlug(slug) : null;

  if (!apiPost && !staticPost) {
    return buildMetadata({
      title: "Article not found",
      description: "That article is not available.",
      path: `/blog/${slug}`,
      index: false,
    });
  }

  const title = apiPost?.meta?.title || apiPost?.title || staticPost?.title || "";
  const description =
    apiPost?.meta?.description ||
    apiPost?.description ||
    staticPost?.description ||
    "";
  const publishedTime = apiPost?.publishedAt || staticPost?.publishedAt;
  const modifiedTime = apiPost?.updatedAt || staticPost?.updatedAt;
  const authorName =
    apiPost?.authorName ||
    (staticPost ? getBlogAuthorById(staticPost.authorId)?.name : null) ||
    "Request Services Editorial";

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
  const staticPost = !apiPost ? getBlogPostBySlug(slug) : null;

  if (!apiPost && !staticPost) notFound();

  // Normalize data between API response and static post
  const title = apiPost ? apiPost.title : staticPost!.title;
  const description = apiPost ? apiPost.description : staticPost!.description;
  const publishedAt = apiPost ? apiPost.publishedAt : staticPost!.publishedAt;
  const image =
    apiPost?.image || apiPost?.coverImage || staticPost?.image || null;
  const isExternalImage = Boolean(image?.startsWith("http"));

  const categoryName = apiPost
    ? apiPost.category
    : getBlogCategoryById(staticPost!.categoryId)?.name ?? "Article";
  const categorySlug = apiPost
    ? categoryNameToSlug(apiPost.category)
    : getBlogCategoryById(staticPost!.categoryId)?.slug ?? "homeowners";

  const authorName = apiPost
    ? apiPost.authorName || "Request Services Editorial"
    : getBlogAuthorById(staticPost!.authorId)?.name ??
      "Request Services Editorial";
  const authorRole = apiPost ? "Editorial Team" : getBlogAuthorById(staticPost!.authorId)?.role ?? "Editorial Team";

  const rawContent = apiPost ? apiPost.content : staticPost!.content;
  const readTimeMinutes = apiPost
    ? apiPost.readTimeMinutes || 5
    : staticPost!.readTimeMinutes;

  const comments = apiPost?.comments || [];

  // Related posts from static or current pool
  const related = staticPost
    ? getRelatedPosts(staticPost)
    : blogPosts.slice(0, 3);

  // Determine if content is HTML or plain text
  const isHtml =
    typeof rawContent === "string" && /<[a-z][\s\S]*>/i.test(rawContent);

  return (
    <>
      <JsonLd
        data={[
          articleJsonLd(
            {
              id: apiPost?._id || staticPost?.id || slug,
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
                apiPost?.updatedAt || publishedAt || new Date().toISOString(),
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
              <p className="text-sm text-muted-foreground">
                {authorName}
                {publishedAt ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    {formatDate(publishedAt)}
                  </>
                ) : null}
                <span aria-hidden="true"> · </span>
                {readTimeMinutes} min read
              </p>
            </div>
          </Container>
        </section>

        {image ? (
          <div className="border-b bg-muted/40">
            <Container className="py-6 md:py-8">
              <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={image}
                  alt={title}
                  fill
                  priority
                  unoptimized={isExternalImage}
                  sizes="(min-width: 1280px) 1120px, 92vw"
                  className="object-cover"
                />
              </div>
            </Container>
          </div>
        ) : null}

        <div className="section-space">
          <Container className="grid gap-10 lg:grid-cols-[minmax(0,42rem)_minmax(0,16rem)] lg:justify-between">
            <div className="flex flex-col gap-5 text-base leading-7 text-muted-foreground">
              {/* Render Content */}
              {isHtml ? (
                <div
                  className="prose prose-neutral max-w-none dark:prose-invert"
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
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">Written by</dt>
                  <dd className="font-medium">{authorName}</dd>
                  {authorRole ? (
                    <dd className="text-xs text-muted-foreground">
                      {authorRole}
                    </dd>
                  ) : null}
                </div>
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
                <BlogCard key={item.id} post={item} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
