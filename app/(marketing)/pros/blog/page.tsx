import { BlogHero } from "@/components/blog/blog-hero";
import { BlogIndex } from "@/components/blog/blog-index";
import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { blogPaths } from "@/lib/data/blog-audience";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { proPaths } from "@/lib/pro-paths";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Pro Blog | Insights for Home Service Businesses",
  description:
    "Playbooks for home service companies: winning estimates, managing change orders, scheduling technicians, reducing no-shows, getting reviews, and getting paid faster.",
  path: blogPaths.index("pro"),
  keywords: [
    "home service business tips",
    "contractor estimates",
    "change orders",
    "technician scheduling",
    "field service management",
    "contractor marketing",
  ],
});

/** Pro blog: articles the admin targeted at Pros (or both audiences). The customer blog is /blog. */
export default function ProBlogPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "For Pros", path: proPaths.home },
          { name: "Blog", path: blogPaths.index("pro") },
        ])}
      />
      <BlogHero site="pro" />
      <div id="articles" className="bg-[#f5f5f5] pt-6 pb-12 md:pt-8 md:pb-16">
        <Container>
          <BlogIndex site="pro" />
        </Container>
      </div>
    </>
  );
}
