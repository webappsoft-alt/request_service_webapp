import { notFound } from "next/navigation";
import { BlogHero } from "@/components/blog/blog-hero";
import { BlogIndex } from "@/components/blog/blog-index";
import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { BLOG_CATEGORIES } from "@/lib/data/public-blogs";
import { getBlogCategoryBySlug } from "@/lib/data/blog";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export function generateStaticParams() {
  return BLOG_CATEGORIES.filter((c) => c.slug !== "all").map((category) => ({
    slug: category.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const cat =
    BLOG_CATEGORIES.find((c) => c.slug === slug) || getBlogCategoryBySlug(slug);
  if (!cat) {
    return buildMetadata({
      title: "Category not found",
      description: "That blog category is not available.",
      path: `/blog/category/${slug}`,
      index: false,
    });
  }
  const name = "label" in cat ? cat.label : cat.name;
  const description = "description" in cat ? cat.description : "";
  return buildMetadata({
    title: `${name} Articles`,
    description,
    path: `/blog/category/${cat.slug}`,
  });
}

export default async function BlogCategoryPage({
  params,
}: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const cat =
    BLOG_CATEGORIES.find((c) => c.slug === slug) || getBlogCategoryBySlug(slug);
  if (!cat) notFound();

  const name = "label" in cat ? cat.label : cat.name;
  const description = "description" in cat ? cat.description : "";

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: name, path: `/blog/category/${cat.slug}` },
        ])}
      />
      <BlogHero
        title={name}
        description={description}
        current={name}
      />
      <div id="articles" className="bg-[#f5f5f5] pt-6 pb-12 md:pt-8 md:pb-16">
        <Container>
          <BlogIndex initialCategorySlug={cat.slug} />
        </Container>
      </div>
    </>
  );
}
