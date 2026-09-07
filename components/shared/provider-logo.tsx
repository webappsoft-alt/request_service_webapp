import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";

const sizes = {
  sm: "size-10",
  md: "size-12",
  lg: "size-14",
  xl: "size-16",
} as const;

export function ProviderLogo({
  provider,
  size = "md",
  className,
}: {
  provider: Provider;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-lg border bg-card",
        sizes[size],
        className
      )}
    >
      {provider.logoUrl ? (
        <Image
          src={provider.logoUrl}
          alt={`${provider.companyName} logo`}
          fill
          sizes="56px"
          className="object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
          {provider.logoInitials}
        </span>
      )}
    </span>
  );
}
