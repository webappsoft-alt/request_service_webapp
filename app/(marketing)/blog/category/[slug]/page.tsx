import { notFound } from "next/navigation";
import { BlogHero } from "@/components/blog/blog-hero";
import { Container } from "@/components/layout/container";
import { BlogCard } from "@/components/shared/blog-card";
import { JsonLd } from "@/components/seo/json-ld";
import {
  blogCategories,
  getBlogCategoryBySlug,
  getPostsByCategory,
} from "@/lib/data/blog";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export function generateStaticParams() {
  return blogCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const category = getBlogCategoryBySlug(slug);
  if (!category) {
    return buildMetadata({
      title: "Category not found",
      description: "That blog category is not available.",
      path: `/blog/category/${slug}`,
      index: false,
    });
  }
  return buildMetadata({
    title: `${category.name} Articles`,
    description: category.description,
    path: `/blog/category/${category.slug}`,
  });
}

export default async function BlogCategoryPage({
  params,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const category = getBlogCategoryBySlug(slug);
  if (!category) notFound();
  const posts = getPostsByCategory(category.id);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: category.name, path: `/blog/category/${category.slug}` },
        ])}
      />
      <BlogHero
        title={category.name}
        description={category.description}
        current={category.name}
      />
      <div className="bg-[#f5f5f5] section-space">
        <Container className="grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </Container>
      </div>
    </>
  );
}
