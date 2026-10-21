import { notFound } from "next/navigation";
import { ProClose } from "@/components/pro/pro-close";
import { ProLandingPlans } from "@/components/pro/pro-pricing-view";
import { ProProduct } from "@/components/pro/pro-product";
import { ProRegionalLinks, ProSeoHero } from "@/components/pro/pro-seo-landing";
import { ProWorkflow } from "@/components/pro/pro-workflow";
import { FaqSection } from "@/components/seo/faq-section";
import { proTradeFaqs } from "@/lib/data/local-seo-copy";
import { cityLabel, getLocationCity, nearbyCities } from "@/lib/data/locations";
import { proPaths } from "@/lib/pro-paths";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

type Params = { state: string; city: string };

export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageParams<Params>) {
  const { state, city: citySlug } = await params;
  const city = getLocationCity(state, citySlug);
  if (!city || state !== city.state.slug || citySlug !== city.slug) {
    return buildMetadata({ title: "For Pros", description: "", path: proPaths.home, index: false });
  }
  return buildMetadata({
    title: `Become a Contractor in ${cityLabel(city)} | Get Local Jobs`,
    description: `Join Request Service to reach ${city.city} homeowners looking for plumbers, electricians, HVAC technicians, and more. Send written estimates and run your business from one portal.`,
    path: proPaths.location(city.state.slug, city.slug),
    keywords: [
      `contractor jobs ${city.city}`,
      `${city.city} contractor leads`,
      `home service leads ${city.city}`,
      `become a contractor in ${city.city}`,
    ],
  });
}

export default async function ProLocationPage({ params }: PageParams<Params>) {
  const { state, city: citySlug } = await params;
  const city = getLocationCity(state, citySlug);
  if (!city || state !== city.state.slug || citySlug !== city.slug) notFound();
  const place = cityLabel(city);

  return (
    <>
      <ProSeoHero
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "For Pros", path: proPaths.home },
          { name: city.city, path: proPaths.location(city.state.slug, city.slug) },
        ]}
        eyebrow={`For contractors in ${city.city}`}
        title={`Become a contractor in ${place}.`}
        description={`${city.city} homeowners search Request Service for licensed local pros. Get listed in the ${city.city} directory, send itemized estimates, and get paid — with no commission on the work you win.`}
      />
      <ProWorkflow />
      <ProProduct />
      <ProLandingPlans />
      <ProRegionalLinks city={city} nearby={nearbyCities(city, 6)} />
      <FaqSection
        title={`Joining Request Service in ${city.city}`}
        items={proTradeFaqs(
          { people: "Contractors", person: "contractor" },
          city,
        )}
      />
      <ProClose />
    </>
  );
}
