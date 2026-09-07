import { ProfessionalMarketplace } from "@/components/marketplace/professional-marketplace";
import { JsonLd } from "@/components/seo/json-ld";
import { getAllProviders } from "@/lib/data/providers";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export async function generateMetadata({ searchParams }: PageParams) {
  const params = await searchParams;
  const service = typeof params.service === "string" ? params.service : "";
  const category = service ? getServiceCategoryBySlug(service) : undefined;

  return buildMetadata({
    title: category ? `${category.name} quote` : "Get a Home Service Quote",
    description:
      "Answer a few questions about the job. See a typical starting price and matching local professionals. The written estimate comes after a visit.",
    path: category ? `/get-a-quote?service=${category.slug}` : "/get-a-quote",
    keywords: ["home service quote", "request an estimate", "find a local contractor"],
  });
}

export default async function GetAQuotePage({ searchParams }: PageParams) {
  const params = await searchParams;
  const service = typeof params.service === "string" ? params.service : "";
  const zip = typeof params.zip === "string" ? params.zip : "";
  const category = service ? getServiceCategoryBySlug(service) : undefined;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Get a quote", path: "/get-a-quote" },
        ])}
      />
      <ProfessionalMarketplace
        ask
        eyebrow="Get a quote"
        plain
        category={category}
        zip={zip}
        providers={getAllProviders()}
      />
    </>
  );
}
