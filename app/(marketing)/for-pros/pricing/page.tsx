import { ProClose } from "@/components/pro/pro-close";
import { ProPricingView } from "@/components/pro/pro-pricing-view";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { proPaths } from "@/lib/pro-paths";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Pricing for Pros | Plans for Contractors & Trade Businesses",
  description:
    "Transparent monthly and annual plans for trade professionals: CRM, crew logins, dispatching, estimates, and a 24/7 AI Voice Receptionist. No commission on the work you win.",
  path: proPaths.pricing,
  keywords: [
    "contractor software pricing",
    "field service software plans",
    "AI receptionist for contractors",
    "home service CRM pricing",
  ],
});

export default function ProPricingPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "For Pros", path: proPaths.home },
          { name: "Pricing", path: proPaths.pricing },
        ])}
      />
      <ProPricingView />
      <ProClose />
    </>
  );
}
