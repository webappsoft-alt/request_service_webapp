"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type BlogShareProps = {
  title: string;
  /** Site-relative path of the article, e.g. `/blog/my-post`. */
  path: string;
};

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const iconButton =
  "inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BlogShare({ title, path }: BlogShareProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  // Built at click time so server and client markup stay identical.
  const articleUrl = () => `${window.location.origin}${path}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(articleUrl());
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  const openShare = (network: "x" | "linkedin") => {
    const url = encodeURIComponent(articleUrl());
    const text = encodeURIComponent(title);
    const href =
      network === "x"
        ? `https://twitter.com/intent/tweet?url=${url}&text=${text}`
        : `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=560");
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-2">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Share</span>
        <Tooltip open={copied ? true : undefined}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copyLink}
              className={iconButton}
              aria-label={copied ? "Link copied" : "Copy link"}
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Link2 className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{copied ? "Link copied" : "Copy link"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => openShare("x")}
              className={iconButton}
              aria-label="Share on X"
            >
              <XIcon />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Share on X</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => openShare("linkedin")}
              className={iconButton}
              aria-label="Share on LinkedIn"
            >
              <LinkedInIcon />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Share on LinkedIn</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
