import { notFound } from "next/navigation";
import { ProClose } from "@/components/pro/pro-close";
import { ProLandingPlans } from "@/components/pro/pro-pricing-view";
import { ProProduct } from "@/components/pro/pro-product";
import { ProRegionalLinks, ProSeoHero } from "@/components/pro/pro-seo-landing";
import { ProWorkflow } from "@/components/pro/pro-workflow";
import { FaqSection } from "@/components/seo/faq-section";
import { proTradeFaqs } from "@/lib/data/local-seo-copy";
import { getProTrade, proTrades } from "@/lib/data/pro-trades";
import { proPaths } from "@/lib/pro-paths";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export const dynamicParams = false;

export function generateStaticParams() {
  return proTrades.map((trade) => ({ trade: trade.slug }));
}

export async function generateMetadata({ params }: PageParams<{ trade: string }>) {
  const trade = getProTrade((await params).trade);
  if (!trade) {
    return buildMetadata({ title: "For Pros", description: "", path: proPaths.home, index: false });
  }
  return buildMetadata({
    title: `Get More ${trade.category.name} Jobs | Software & Leads for ${trade.people}`,
    description: `Request Service helps ${trade.people.toLowerCase()} win local ${trade.category.name.toLowerCase()} jobs and run estimates, scheduling, invoices, and payments from one portal. No commission on the work you win.`,
    path: proPaths.trade(trade.slug),
    keywords: [
      `${trade.person} leads`,
      `${trade.category.name.toLowerCase()} leads`,
      `${trade.category.name.toLowerCase()} business software`,
      `${trade.person} estimating software`,
      `get more ${trade.category.name.toLowerCase()} customers`,
    ],
  });
}

export default async function ProTradePage({ params }: PageParams<{ trade: string }>) {
  const trade = getProTrade((await params).trade);
  if (!trade) notFound();

  return (
    <>
      <ProSeoHero
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "For Pros", path: proPaths.home },
          { name: trade.people, path: proPaths.trade(trade.slug) },
        ]}
        eyebrow={`For ${trade.people.toLowerCase()}`}
        title={`More ${trade.category.name.toLowerCase()} jobs. Less office work.`}
        description={`Homeowners search Request Service for ${trade.people.toLowerCase()} by service and ZIP Code. Get listed, send itemized estimates for ${trade.category.commonServices
          .slice(0, 3)
          .map((item) => item.toLowerCase())
          .join(", ")}, and get paid — with no commission on the work you win.`}
      />
      <ProWorkflow />
      <ProProduct />
      <ProLandingPlans />
      <ProRegionalLinks
        categorySlug={trade.category.slug}
        categoryName={trade.category.name}
        currentTrade={trade.slug}
      />
      <FaqSection title={`Request Service for ${trade.people.toLowerCase()}`} items={proTradeFaqs(trade)} />
      <ProClose />
    </>
  );
}
