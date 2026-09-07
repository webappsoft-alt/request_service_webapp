import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceCategory } from "@/lib/types";

export function ServicePhotoTile({
  category,
  className,
  href,
  selected = false,
}: {
  category: ServiceCategory;
  className?: string;
  href?: string;
  selected?: boolean;
}) {
  return (
    <Link
      href={href ?? `/services/${category.slug}`}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative block aspect-[4/3] overflow-hidden rounded-xl border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className
      )}
    >
      {category.image ? (
        <Image
          src={category.image}
          alt={category.imageAlt ?? category.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <span className="absolute inset-0 bg-primary" aria-hidden="true" />
      )}
      <span
        className="absolute inset-0 bg-linear-to-t from-black/70 via-black/25 to-black/10"
        aria-hidden="true"
      />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 md:p-3.5">
        <span className="flex min-w-0 flex-col gap-0.5 text-ink-foreground">
          <span className="text-sm font-semibold tracking-tight md:text-base">
            {category.name}
          </span>
          <span className="truncate text-xs text-ink-foreground/80">
            {category.tagline}
          </span>
        </span>
        <ArrowRight
          className="mb-0.5 size-4 shrink-0 translate-x-0 opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0.5 group-hover:opacity-100"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
