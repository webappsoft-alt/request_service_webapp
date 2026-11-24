import { BlogHero } from "@/components/blog/blog-hero";
import { BlogIndex } from "@/components/blog/blog-index";
import { Container } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Home Services Journal",
  description:
    "Guides for homeowners on hiring local pros, comparing estimates, change orders, payments, home maintenance, and how Request Service works.",
  path: "/blog",
  keywords: ["home service guides", "contractor estimates", "home maintenance"],
});

export default function BlogPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ])}
      />
      <BlogHero />
      <div id="articles" className="bg-[#f5f5f5] pt-6 pb-12 md:pt-8 md:pb-16">
        <Container>
          {/* Customer blog: customer + "both" articles. Pro articles live on /pros/blog. */}
          <BlogIndex site="customer" />
        </Container>
      </div>
    </>
  );
}
