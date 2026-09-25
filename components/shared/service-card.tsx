import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { serviceAccents, serviceButtonAccents, serviceIcons } from "@/lib/icons";
import { servicesHref } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { ServiceCategory } from "@/lib/types";

function categoryServicesHref(category: ServiceCategory) {
  return servicesHref({
    confidence: "exact-category",
    query: "",
    service: category.slug,
  });
}

export function ServiceCard({ category }: { category: ServiceCategory }) {
  const Icon = serviceIcons[category.slug];

  return (
    <Link
      href={categoryServicesHref(category)}
      className="group flex h-full flex-col gap-5 rounded-xl border bg-card p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-foreground/15 hover:elevate focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-xl transition-transform duration-300 ease-out group-hover:scale-105",
          serviceAccents[category.slug]
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg">{category.name}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{category.description}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {category.commonServices.slice(0, 3).map((service) => (
          <li key={service} className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
            <span className="truncate">{service}</span>
          </li>
        ))}
      </ul>

      <span className="mt-auto border-t pt-5">
        <span
          className={cn(
            "flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors duration-300 ease-out",
            serviceButtonAccents[category.slug]
          )}
        >
          View {category.name}
          <ArrowRight
            className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </span>
    </Link>
  );
}

export function ServiceOfferCard({ category }: { category: ServiceCategory }) {
  const Icon = serviceIcons[category.slug];

  return (
    <Link
      href={categoryServicesHref(category)}
      className="group flex h-full flex-col gap-3 rounded-xl border border-input bg-card p-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-input hover:elevate focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 ease-out group-hover:scale-105",
            serviceAccents[category.slug],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight">{category.name}</h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{category.tagline}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {category.commonServices.slice(0, 3).map((service) => (
          <li key={service} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
            <span className="truncate">{service}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

export function ServiceCompactLink({ category }: { category: ServiceCategory }) {
  const Icon = serviceIcons[category.slug];

  return (
    <Link
      href={categoryServicesHref(category)}
      className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3 transition-colors hover:bg-muted/60"
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-md",
          serviceAccents[category.slug]
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{category.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {category.commonServices[0]}
        </span>
      </span>
      <Badge variant="outline" className="ml-auto">
        Local
      </Badge>
    </Link>
  );
}
