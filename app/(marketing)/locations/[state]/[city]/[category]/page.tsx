import { notFound } from "next/navigation";
import { LocalServicePage } from "@/components/locations/location-pages";
import { locationMetadata, resolveLocationRoute } from "@/lib/data/location-routes";
import type { PageParams } from "@/lib/page-props";

type Params = { state: string; city: string; category: string };

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageParams<Params>) {
  return locationMetadata(resolveLocationRoute(await params));
}

export default async function LocationServicePage({ params }: PageParams<Params>) {
  const route = resolveLocationRoute(await params);
  if (!route?.city || !route.category) notFound();
  return <LocalServicePage route={route} city={route.city} category={route.category} />;
}
