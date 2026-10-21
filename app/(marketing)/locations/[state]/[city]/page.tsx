import { notFound } from "next/navigation";
import { CityLandingPage } from "@/components/locations/location-pages";
import { locationMetadata, resolveLocationRoute } from "@/lib/data/location-routes";
import type { PageParams } from "@/lib/page-props";

type Params = { state: string; city: string };

export const revalidate = 3600;

/** Rendered on first request, then cached (hundreds of cities). */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageParams<Params>) {
  return locationMetadata(resolveLocationRoute(await params));
}

export default async function LocationCityPage({ params }: PageParams<Params>) {
  const route = resolveLocationRoute(await params);
  if (!route?.city) notFound();
  return <CityLandingPage route={route} city={route.city} />;
}
