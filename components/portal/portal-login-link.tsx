"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { customerSiteOrigin } from "@/components/portal/use-estimate-share";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * Sign-in link the office sends to its technicians / contractors, with one-click copy.
 * (The customer and Pro login pages no longer link to these portals.)
 */
export function PortalLoginLink({
  audience,
  path,
  className,
}: {
  audience: "technician" | "contractor";
  path: string;
  className?: string;
}) {
  // Live domain from .env (live_domain_url); the current tab's origin only when it isn't set.
  const origin = useSyncExternalStore(noopSubscribe, customerSiteOrigin, () => "");
  const url = `${origin}${path}`;
  const [copied, setCopied] = useState(false);
  const label = audience === "technician" ? "Technician portal login" : "Contractor portal login";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Login link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link and copy it manually.");
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border-soft bg-secondary/40 px-3 py-2",
        className,
      )}
    >
      <KeyRound className="size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          Send this link to your {audience === "technician" ? "technicians" : "contractors"} with their username and password.
        </p>
      </div>
      <code className="max-w-full truncate rounded border border-input bg-background px-2 py-1 text-xs text-foreground select-all">
        {url}
      </code>
      <div className="flex items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void copy()}>
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2" asChild>
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${label.toLowerCase()}`}>
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
