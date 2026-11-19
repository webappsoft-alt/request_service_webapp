import { notFound, permanentRedirect } from "next/navigation";
import { BlogHero } from "@/components/blog/blog-hero";
import { BlogIndex } from "@/components/blog/blog-index";
import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { blogPaths } from "@/lib/data/blog-audience";
import { blogCategoriesFor, siteForCategorySlug } from "@/lib/data/public-blogs";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { proPaths } from "@/lib/pro-paths";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

const proCategories = blogCategoriesFor("pro").filter((category) => category.slug !== "all");

export function generateStaticParams() {
  return proCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const category = proCategories.find((item) => item.slug === slug);
  if (!category) {
    return buildMetadata({
      title: "Category not found",
      description: "That blog category is not available.",
      path: blogPaths.category("pro", slug),
      index: false,
    });
  }
  return buildMetadata({
    title: `${category.label} | Pro Blog`,
    description: "description" in category ? category.description : "",
    path: blogPaths.category("pro", category.slug),
  });
}

export default async function ProBlogCategoryPage({ params }: PageParams<{ slug: string }>) {
  const { slug } = await params;
  const category = proCategories.find((item) => item.slug === slug);
  if (!category) {
    // Customer categories (homeowners, maintenance) live on the customer blog.
    if (siteForCategorySlug(slug) === "customer" && slug !== "all") {
      permanentRedirect(blogPaths.category("customer", slug));
    }
    notFound();
  }

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "For Pros", path: proPaths.home },
          { name: "Blog", path: blogPaths.index("pro") },
          { name: category.label, path: blogPaths.category("pro", category.slug) },
        ])}
      />
      <BlogHero
        site="pro"
        title={category.label}
        description={"description" in category ? category.description : undefined}
        current={category.label}
      />
      <div id="articles" className="bg-[#f5f5f5] pt-6 pb-12 md:pt-8 md:pb-16">
        <Container>
          <BlogIndex site="pro" initialCategorySlug={category.slug} />
        </Container>
      </div>
    </>
  );
}
