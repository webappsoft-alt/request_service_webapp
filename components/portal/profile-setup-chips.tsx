"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { ProfileSetupItem } from "@/lib/business-profile-setup";
import { cn } from "@/lib/utils";

export function ProfileSetupSummary({
  done,
  total,
  percent,
  nextLabel,
}: {
  done: number;
  total: number;
  percent: number;
  nextLabel?: string;
}) {
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{done}</span>
      {" of "}
      <span className="font-semibold text-foreground">{total}</span>
      {" steps done · "}
      <span className="font-semibold text-foreground">{percent}%</span>
      {" complete"}
      {nextLabel ? ` · Next: ${nextLabel}` : ""}
    </p>
  );
}

export function ProfileSetupChips({ items }: { items: ProfileSetupItem[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs",
              item.done
                ? "border-input bg-card text-muted-foreground"
                : "border-primary/30 bg-card font-medium text-foreground",
            )}
          >
            {item.done ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <span className="size-3.5 rounded-full border-2 border-primary" />
            )}
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
