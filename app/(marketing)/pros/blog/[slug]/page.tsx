import { BlogArticle, blogArticleMetadata } from "@/components/blog/blog-article";
import type { PageParams } from "@/lib/page-props";

// Rendered per request (no-store article fetch keeps comments fresh) — same as /blog/[slug].

/** Pro blog article. Customer-only articles redirect to /blog/[slug] (see BlogArticle). */
export async function generateMetadata({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  return blogArticleMetadata(slug, "pro");
}

export default async function ProBlogArticlePage({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  return <BlogArticle slug={slug} site="pro" />;
}
