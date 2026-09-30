import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterTabOption = {
  value: string;
  label: string;
  href?: string;
  /** Optional count badge (e.g. Changes requested). */
  count?: number;
};

export function FilterTabs({
  baseHref,
  value,
  options,
}: {
  baseHref: string;
  value: string;
  options: FilterTabOption[];
}) {
  return (
    <div className="flex flex-wrap gap-x-6 border-b border-input bg-card px-4">
      {options.map((option) => {
        const href =
          option.href ??
          (option.value
            ? `${baseHref}?status=${encodeURIComponent(option.value)}`
            : baseHref);
        const active =
          value === option.value ||
          // Treat legacy ?status=new as the New tab (new + viewed).
          (option.value === "new,viewed" && value === "new");
        const count =
          typeof option.count === "number" && option.count > 0
            ? option.count
            : 0;
        return (
          <Link
            key={option.label}
            href={href}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 py-2.5 text-sm transition-colors",
              active
                ? "border-primary font-semibold text-primary"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {count > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#003F7D] px-1.5 text-[10px] font-semibold leading-none text-white">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
