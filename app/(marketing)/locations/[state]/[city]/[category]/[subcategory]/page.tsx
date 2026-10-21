import { notFound } from "next/navigation";
import { LocalServicePage } from "@/components/locations/location-pages";
import { locationMetadata, resolveLocationRoute } from "@/lib/data/location-routes";
import type { PageParams } from "@/lib/page-props";

type Params = { state: string; city: string; category: string; subcategory: string };

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageParams<Params>) {
  return locationMetadata(resolveLocationRoute(await params));
}

export default async function LocationSubServicePage({ params }: PageParams<Params>) {
  const route = resolveLocationRoute(await params);
  if (!route?.city || !route.category || !route.job) notFound();
  return <LocalServicePage route={route} city={route.city} category={route.category} />;
}
