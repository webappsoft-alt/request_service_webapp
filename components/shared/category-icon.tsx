import { getCategoryIconSrc } from "@/lib/data/category-icons";
import { cn } from "@/lib/utils";

export function CategoryIcon({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-5 bg-primary", className)}
      style={{
        maskImage: `url(${getCategoryIconSrc(slug)})`,
        WebkitMaskImage: `url(${getCategoryIconSrc(slug)})`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
      }}
    />
  );
}
