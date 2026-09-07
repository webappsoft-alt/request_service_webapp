import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { BlogCard } from "@/components/shared/blog-card";
import { JsonLd } from "@/components/seo/json-ld";
import {
  blogPosts,
  getBlogAuthorById,
  getBlogCategoryById,
  getBlogPostBySlug,
  getRelatedPosts,
} from "@/lib/data/blog";
import { formatDate } from "@/lib/format";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) {
    return buildMetadata({
      title: "Article not found",
      description: "That article is not available.",
      path: `/blog/${slug}`,
      index: false,
    });
  }
  const author = getBlogAuthorById(post.authorId);
  return buildMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    ogType: "article",
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    authors: author ? [author.name] : undefined,
  });
}

export default async function BlogArticlePage({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  const category = getBlogCategoryById(post.categoryId);
  const author = getBlogAuthorById(post.authorId);
  const related = getRelatedPosts(post);

  return (
    <>
      <JsonLd
        data={[
          articleJsonLd(post, author?.name ?? "Request Services Editorial"),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
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
                  <Link href="/" className="transition-colors hover:text-primary">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/blog" className="transition-colors hover:text-primary">
                    Blog
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="font-medium text-foreground" aria-current="page">
                  {category?.name ?? "Article"}
                </li>
              </ol>
            </nav>

            <div className="flex max-w-3xl flex-col gap-4">
              {category ? (
                <Badge variant="secondary" className="w-fit" asChild>
                  <Link href={`/blog/category/${category.slug}`}>{category.name}</Link>
                </Badge>
              ) : null}
              <h1 className="text-3xl font-semibold text-pretty md:text-[2.5rem]">
                {post.title}
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                {post.description}
              </p>
              <p className="text-sm text-muted-foreground">
                {author?.name}
                <span aria-hidden="true"> · </span>
                {formatDate(post.publishedAt)}
                <span aria-hidden="true"> · </span>
                {post.readTimeMinutes} min read
              </p>
            </div>
          </Container>
        </section>

        {post.image ? (
          <div className="border-b bg-muted/40">
            <Container className="py-6 md:py-8">
              <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={post.image}
                  alt={post.imageAlt}
                  fill
                  priority
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
              {post.content.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}

              <div className="mt-4 border-t pt-6">
                <Button variant="outline" asChild>
                  <Link href="/blog">
                    <ArrowLeft data-icon="inline-start" />
                    Back to blog
                  </Link>
                </Button>
              </div>
            </div>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              <p className="text-sm font-medium">Article</p>
              <dl className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">Written by</dt>
                  <dd className="font-medium">{author?.name}</dd>
                  {author?.role ? (
                    <dd className="text-xs text-muted-foreground">{author.role}</dd>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">Published</dt>
                  <dd>{formatDate(post.publishedAt)}</dd>
                </div>
                {category ? (
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">Category</dt>
                    <dd>
                      <Link
                        href={`/blog/category/${category.slug}`}
                        className="font-medium text-brand hover:text-foreground"
                      >
                        {category.name}
                      </Link>
                    </dd>
                  </div>
                ) : null}
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
