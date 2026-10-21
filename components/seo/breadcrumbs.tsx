import { Fragment } from "react";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = { name: string; path: string };

/** Visible breadcrumb trail + matching BreadcrumbList JSON-LD. The last item is the current page. */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items)} />
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <Fragment key={item.path}>
                {index > 0 ? (
                  <li className="text-muted-foreground/70" aria-hidden="true">
                    /
                  </li>
                ) : null}
                <li>
                  {last ? (
                    <span aria-current="page" className="font-medium text-foreground">
                      {item.name}
                    </span>
                  ) : (
                    <Link
                      href={item.path}
                      className={cn("text-muted-foreground transition-colors hover:text-primary")}
                    >
                      {item.name}
                    </Link>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
