import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { serviceAccents, serviceButtonAccents, serviceIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ServiceCategory } from "@/lib/types";

export function ServiceCard({ category }: { category: ServiceCategory }) {
  const Icon = serviceIcons[category.slug];

  return (
    <Link
      href={`/services/${category.slug}`}
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
      href={`/services/${category.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-black/15 bg-card transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-black/25 hover:elevate focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-[2/1] overflow-hidden">
        {category.image ? (
          <Image
            src={category.image}
            alt={category.imageAlt ?? category.name}
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 90vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <span className="absolute inset-0 bg-primary" aria-hidden="true" />
        )}
        <span
          className="absolute inset-0 bg-linear-to-t from-black/25 to-transparent"
          aria-hidden="true"
        />
        <span className="absolute bottom-3 left-3 flex size-10 items-center justify-center rounded-lg bg-card text-primary shadow-sm ring-1 ring-foreground/10">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold tracking-tight">{category.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{category.tagline}</p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {category.commonServices.slice(0, 3).map((service) => (
            <li key={service} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
              <span className="truncate">{service}</span>
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}

export function ServiceCompactLink({ category }: { category: ServiceCategory }) {
  const Icon = serviceIcons[category.slug];

  return (
    <Link
      href={`/services/${category.slug}`}
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
