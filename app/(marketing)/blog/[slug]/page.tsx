import { BlogArticle, blogArticleMetadata } from "@/components/blog/blog-article";
import type { PageParams } from "@/lib/page-props";

// Rendered per request: the article is fetched with no-store so comments stay fresh.
// (A generateStaticParams export made this route static, and the no-store fetch then
// failed in production with "Page changed from static to dynamic at runtime" → 500.)

/** Customer blog article. Pro-only articles redirect to /pros/blog/[slug] (see BlogArticle). */
export async function generateMetadata({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  return blogArticleMetadata(slug, "customer");
}

export default async function BlogArticlePage({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  return <BlogArticle slug={slug} site="customer" />;
}
