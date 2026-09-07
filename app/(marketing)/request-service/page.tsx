import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/layout/container";
import { RequestServiceForm } from "@/components/marketplace/request-service-form";
import { RequestServiceHero } from "@/components/marketplace/request-service-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { getJobRecord } from "@/lib/data/jobs";
import { getPortalServices } from "@/lib/data/portal";
import { getProviderBySlug } from "@/lib/data/providers";
import { getServiceCategoryById, getServiceCategoryBySlug } from "@/lib/data/services";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import type { PageParams } from "@/lib/page-props";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Request Home Service",
  description:
    "Submit a marketplace service request or book a specific provider. Include your ZIP code, service details, and preferred timing.",
  path: "/request-service",
});

export default async function RequestServicePage({ searchParams }: PageParams) {
  const params = await searchParams;
  const service = typeof params.service === "string" ? params.service : "";
  const jobSlug = typeof params.job === "string" ? params.job : "";
  const providerSlug = typeof params.provider === "string" ? params.provider : "";
  const zip = typeof params.zip === "string" ? params.zip : "";
  const serviceId = typeof params.serviceId === "string" ? params.serviceId : "";
  const intent = params.intent === "book" || serviceId ? "book" : "request";
  const category = service ? getServiceCategoryBySlug(service) : undefined;
  const jobRecord = service && jobSlug ? getJobRecord(service, jobSlug) : undefined;
  const provider = providerSlug ? getProviderBySlug(providerSlug) : undefined;
  const providerCategory = provider
    ? getServiceCategoryById(provider.categoryIds[0] ?? "")
    : undefined;
  const fixedService = provider && serviceId
    ? getPortalServices(provider).find((item) => item.id === serviceId)
    : undefined;
  const fixedCategory = fixedService
    ? getServiceCategoryById(fixedService.categoryId)
    : undefined;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Request Service", path: "/request-service" },
        ])}
      />
      <RequestServiceHero
        category={jobRecord?.category ?? category ?? fixedCategory ?? providerCategory}
        job={jobRecord?.job}
        jobIndex={jobRecord?.index}
        provider={provider}
        zip={zip || provider?.zip}
        intent={intent}
        fixedServiceName={fixedService?.name}
      />
      <div className="bg-[#f5f5f5] section-space">
        <Container>
          <Card>
            <CardContent className="pt-(--card-spacing)">
              <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <RequestServiceForm
                  initial={{
                    service,
                    job: jobSlug,
                    provider: providerSlug,
                    serviceId,
                    intent,
                    date: typeof params.date === "string" ? params.date : "",
                    time: typeof params.time === "string" ? params.time : "",
                  }}
                />
              </Suspense>
            </CardContent>
          </Card>
        </Container>
      </div>
    </>
  );
}
