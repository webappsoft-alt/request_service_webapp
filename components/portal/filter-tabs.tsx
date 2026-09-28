import Link from "next/link";
import { cn } from "@/lib/utils";

export function FilterTabs({
  baseHref,
  value,
  options,
}: {
  baseHref: string;
  value: string;
  options: { value: string; label: string; href?: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-6 border-b border-input bg-card px-4">
      {options.map((option) => {
        const href = option.href ?? (option.value ? `${baseHref}?status=${option.value}` : baseHref);
        const active = value === option.value;
        return (
          <Link
            key={option.label}
            href={href}
            className={cn(
              "-mb-px cursor-pointer border-b-2 py-2.5 text-sm transition-colors",
              active
                ? "border-primary font-semibold text-primary"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
