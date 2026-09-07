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
    <div className="flex flex-wrap gap-x-5 border-b border-black/10 bg-card px-4">
      {options.map((option) => {
        const href = option.href ?? (option.value ? `${baseHref}?status=${option.value}` : baseHref);
        const active = value === option.value;
        return (
          <Link
            key={option.label}
            href={href}
            className={cn(
              "-mb-px border-b-2 py-2.5 text-sm font-medium",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
