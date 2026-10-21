import Link from "next/link";
import { Container, Section } from "@/components/layout/container";
import { LocationHeader } from "@/components/locations/location-sections";
import { ProRecruitCta } from "@/components/seo/pro-recruit-cta";
import { citiesInState, listLocationStates } from "@/lib/data/locations";
import { publicPaths } from "@/lib/public-paths";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Home Service Pros by Location",
  description:
    "Find licensed local professionals in your state and city. Browse plumbing, HVAC, electrical, cleaning, roofing, and more near you.",
  path: publicPaths.locations,
  keywords: ["home services by city", "local contractors", "find a pro near me"],
});

export default function LocationsHubPage() {
  const states = listLocationStates();

  return (
    <>
      <LocationHeader
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Locations", path: publicPaths.locations },
        ]}
        eyebrow="Locations"
        title="Find a licensed pro near you"
        description="Pick your state and city to compare local professionals and request written estimates."
      />
      <Section density="tight">
        <Container>
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {states.map((state) => (
              <li key={state.slug} className="flex flex-col gap-2">
                <Link
                  href={publicPaths.locationState(state.slug)}
                  className="text-lg font-semibold transition-colors hover:text-primary"
                >
                  {state.name}
                </Link>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {citiesInState(state.slug).map((city) => (
                    <li key={city.slug}>
                      <Link
                        href={publicPaths.locationCity(state.slug, city.slug)}
                        className="transition-colors hover:text-primary"
                      >
                        {city.city}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <ProRecruitCta />
    </>
  );
}
