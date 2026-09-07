"use client";

import { ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function credentialLabel(licensed?: boolean, insured?: boolean) {
  return [licensed ? "Licensed" : null, insured ? "Insured" : null]
    .filter(Boolean)
    .join(" & ");
}

export function CredentialMark({
  licensed,
  insured,
  tone = "light",
  className,
}: {
  licensed?: boolean;
  insured?: boolean;
  tone?: "light" | "photo";
  className?: string;
}) {
  const label = credentialLabel(licensed, insured);
  if (!label) return null;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger
        aria-label={label}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md",
          tone === "photo"
            ? "bg-black/40 text-white backdrop-blur-md"
            : "bg-secondary text-brand",
          className
        )}
      >
        <ShieldCheck className="size-3.5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={6}
        className={
          tone === "light"
            ? "bg-white text-foreground [&_svg]:bg-white [&_svg]:fill-white"
            : undefined
        }
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
