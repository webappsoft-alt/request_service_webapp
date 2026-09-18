import { cn } from "@/lib/utils";

export function LocalFilterTabs({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 text-[13px] font-medium transition-colors",
              active
                ? "border-primary bg-secondary text-primary font-semibold"
                : "border-black/10 bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
