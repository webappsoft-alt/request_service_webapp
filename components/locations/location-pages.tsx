import { ServicesDirectory } from "@/components/marketplace/services-directory";
import {
  CategoryLinkGrid,
  LinkChips,
  LiveProsList,
  LocationHeader,
} from "@/components/locations/location-sections";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { ProRecruitCta } from "@/components/seo/pro-recruit-cta";
import { slugifyJob } from "@/lib/data/jobs";
import {
  cityFaqs,
  localServiceDescription,
  localServiceFaqs,
  localServiceTitle,
  tradePeople,
} from "@/lib/data/local-seo-copy";
import {
  liveProsForCity,
  locationBreadcrumbs,
  locationPath,
  type ResolvedLocationRoute,
} from "@/lib/data/location-routes";
import { cityLabel, nearbyCities, type LocationCity } from "@/lib/data/locations";
import { getProTradeForCategory } from "@/lib/data/pro-trades";
import { getRelatedCategories } from "@/lib/data/related-categories";
import { serviceCategories } from "@/lib/data/services";
import { localServiceJsonLd, professionalsItemListJsonLd } from "@/lib/json-ld";
import { proPaths } from "@/lib/pro-paths";
import { publicPaths } from "@/lib/public-paths";
import type { ServiceCategory } from "@/lib/types";

/** /locations/[state]/[city] */
export async function CityLandingPage({ route, city }: { route: ResolvedLocationRoute; city: LocationCity }) {
  const place = cityLabel(city);
  const pros = await liveProsForCity(city);

  return (
    <>
      {pros.length ? (
        <JsonLd data={professionalsItemListJsonLd(`Home service professionals in ${place}`, pros)} />
      ) : null}
      <LocationHeader
        breadcrumbs={locationBreadcrumbs(route)}
        eyebrow={`${city.state.name} · Local pros`}
        title={`Home service pros in ${place}`}
        description={`Compare licensed ${city.city} plumbers, electricians, HVAC technicians, and more. Get itemized written estimates and hire with a signed scope.`}
      />
      <CategoryLinkGrid
        eyebrow="Services"
        title={`Popular services in ${city.city}`}
        categories={serviceCategories}
        hrefFor={(category) => publicPaths.locationService(city.state.slug, city.slug, category.slug)}
        labelFor={(category) => `${category.name} in ${city.city}`}
      />
      <ServicesDirectory initialCity={city.city} initialState={city.state.code} syncUrl={false} />
      <LiveProsList title={`Professionals based in ${city.city}`} pros={pros} />
      <LinkChips
        eyebrow="Nearby"
        title={`More cities in ${city.state.name}`}
        items={nearbyCities(city).map((item) => ({
          label: item.city,
          href: publicPaths.locationCity(item.state.slug, item.slug),
        }))}
      />
      <FaqSection title={`Hiring a pro in ${city.city}`} items={cityFaqs(city)} />
      <ProRecruitCta place={city.city} learnMoreHref={proPaths.location(city.state.slug, city.slug)} />
    </>
  );
}

/** /locations/[state]/[city]/[category] and /locations/[state]/[city]/[category]/[subcategory] */
export async function LocalServicePage({
  route,
  city,
  category,
}: {
  route: ResolvedLocationRoute;
  city: LocationCity;
  category: ServiceCategory;
}) {
  const job = route.job;
  const place = cityLabel(city);
  const path = locationPath(route);
  const title = localServiceTitle(category, city, job?.name);
  const description = localServiceDescription(category, city, job?.name);
  const people = tradePeople(category);
  const trade = getProTradeForCategory(category.slug);
  const pros = await liveProsForCity(city, category);

  return (
    <>
      <JsonLd
        data={[
          localServiceJsonLd({
            name: title,
            description,
            path,
            serviceType: job?.name ?? category.name,
            city: city.city,
            state: city.state.code,
            stateName: city.state.name,
          }),
          ...(pros.length ? [professionalsItemListJsonLd(`${category.name} professionals in ${place}`, pros)] : []),
        ]}
      />
      <LocationHeader
        breadcrumbs={locationBreadcrumbs(route)}
        eyebrow={`${category.name} · ${place}`}
        title={title}
        description={description}
      />
      <ServicesDirectory
        initialCategory={category.slug}
        initialJob={job?.slug}
        initialCity={city.city}
        initialState={city.state.code}
        syncUrl={false}
      />
      <LiveProsList title={`${category.name} pros based in ${city.city}`} pros={pros} />
      <LinkChips
        eyebrow={job ? "Related jobs" : "Narrow the job"}
        title={`${category.shortName} jobs in ${city.city}`}
        items={category.commonServices
          .filter((item) => item !== job?.name)
          .map((item) => ({
            label: item,
            href: publicPaths.locationSubService(city.state.slug, city.slug, category.slug, slugifyJob(item)),
          }))}
      />
      <CategoryLinkGrid
        eyebrow="Also in demand"
        title={`Related services in ${city.city}`}
        categories={getRelatedCategories(category.slug)}
        hrefFor={(item) => publicPaths.locationService(city.state.slug, city.slug, item.slug)}
      />
      <LinkChips
        eyebrow="Nearby"
        title={`${category.name} near ${city.city}`}
        items={nearbyCities(city).map((item) => ({
          label: `${category.name} in ${item.city}`,
          href: job
            ? publicPaths.locationSubService(item.state.slug, item.slug, category.slug, job.slug)
            : publicPaths.locationService(item.state.slug, item.slug, category.slug),
        }))}
      />
      <FaqSection
        title={`${job?.name ?? category.name} in ${city.city}: common questions`}
        items={localServiceFaqs(category, city, job?.name)}
      />
      <ProRecruitCta
        place={city.city}
        trade={people}
        learnMoreHref={trade ? proPaths.trade(trade.slug) : proPaths.home}
      />
    </>
  );
}
