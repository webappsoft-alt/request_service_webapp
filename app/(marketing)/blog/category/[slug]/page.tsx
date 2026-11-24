import { notFound, permanentRedirect } from "next/navigation";
import { BlogHero } from "@/components/blog/blog-hero";
import { BlogIndex } from "@/components/blog/blog-index";
import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { blogPaths } from "@/lib/data/blog-audience";
import { blogCategoriesFor, siteForCategorySlug } from "@/lib/data/public-blogs";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

/** Customer blog categories. Pro categories (service-business) moved to /pros/blog/category/…. */
const customerCategories = blogCategoriesFor("customer").filter((category) => category.slug !== "all");

export function generateStaticParams() {
  return customerCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const category = customerCategories.find((item) => item.slug === slug);
  if (!category) {
    return buildMetadata({
      title: "Category not found",
      description: "That blog category is not available.",
      path: blogPaths.category("customer", slug),
      index: false,
    });
  }
  return buildMetadata({
    title: `${category.label} Articles`,
    description: "description" in category ? category.description : "",
    path: blogPaths.category("customer", category.slug),
  });
}

export default async function BlogCategoryPage({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const category = customerCategories.find((item) => item.slug === slug);
  if (!category) {
    if (siteForCategorySlug(slug) === "pro" && blogCategoriesFor("pro").some((item) => item.slug === slug)) {
      permanentRedirect(blogPaths.category("pro", slug));
    }
    notFound();
  }

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: blogPaths.index("customer") },
          { name: category.label, path: blogPaths.category("customer", category.slug) },
        ])}
      />
      <BlogHero
        title={category.label}
        description={"description" in category ? category.description : undefined}
        current={category.label}
      />
      <div id="articles" className="bg-[#f5f5f5] pt-6 pb-12 md:pt-8 md:pb-16">
        <Container>
          <BlogIndex site="customer" initialCategorySlug={category.slug} />
        </Container>
      </div>
    </>
  );
}
