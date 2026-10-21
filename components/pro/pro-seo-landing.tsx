import Link from "next/link";
import { Container } from "@/components/layout/container";
import { LinkChips } from "@/components/locations/location-sections";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/breadcrumbs";
import { Button } from "@/components/ui/button";
import { listActiveMarkets, type LocationCity } from "@/lib/data/locations";
import { proTrades } from "@/lib/data/pro-trades";
import { proPaths } from "@/lib/pro-paths";
import { publicPaths } from "@/lib/public-paths";

/** Server-rendered hero for /for-pros/[trade] and /for-pros/locations/[state]/[city]. */
export function ProSeoHero({
  breadcrumbs,
  eyebrow,
  title,
  description,
}: {
  breadcrumbs: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="pt-6 pb-10 md:pt-7 md:pb-14">
      <Container className="flex flex-col gap-8">
        <Breadcrumbs items={breadcrumbs} />
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="eyebrow text-primary">{eyebrow}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-6xl">{title}</h1>
          <p className="text-base leading-7 text-pretty text-muted-foreground md:text-lg">{description}</p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button size="xl" asChild>
              <Link href={proPaths.join}>Join as a Pro</Link>
            </Button>
            <Button size="xl" variant="outline" asChild>
              <Link href={proPaths.pricing}>See plans & pricing</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * Pro page → customer directory cross-links: where homeowners are searching,
 * plus the other trade / city Pro pages.
 */
export function ProRegionalLinks({
  categorySlug,
  categoryName,
  city,
  nearby = [],
  currentTrade,
}: {
  /** Trade pages: link each market's category page instead of the city hub. */
  categorySlug?: string;
  categoryName?: string;
  /** City pages: link that city's customer directory first. */
  city?: LocationCity;
  nearby?: LocationCity[];
  currentTrade?: string;
}) {
  const markets = city ? [city, ...nearby] : listActiveMarkets();
  return (
    <>
      <LinkChips
        eyebrow="Where homeowners are hiring"
        title={
          categoryName
            ? `${categoryName} requests by city`
            : city
              ? `Homeowners searching in ${city.city}`
              : "Active service directories"
        }
        items={markets.map((market) => ({
          label: categoryName ? `${categoryName} in ${market.city}` : `${market.city}, ${market.state.code}`,
          href: categorySlug
            ? publicPaths.locationService(market.state.slug, market.slug, categorySlug)
            : publicPaths.locationCity(market.state.slug, market.slug),
        }))}
      />
      <LinkChips
        eyebrow="By trade"
        title="Request Service for your trade"
        items={proTrades
          .filter((trade) => trade.slug !== currentTrade)
          .map((trade) => ({ label: trade.people, href: proPaths.trade(trade.slug) }))}
      />
      {!city ? (
        <LinkChips
          eyebrow="By city"
          title="Become a contractor near you"
          items={listActiveMarkets().map((market) => ({
            label: `Contractors in ${market.city}`,
            href: proPaths.location(market.state.slug, market.slug),
          }))}
        />
      ) : null}
    </>
  );
}
