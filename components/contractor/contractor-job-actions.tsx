"use client";

import { Navigation } from "lucide-react";
import { siteLine } from "@/components/contractor/contractor-ui";
import { useRouteMap } from "@/components/portal/route-map-provider";
import { TechChatButton } from "@/components/tech-chat/tech-chat-button";
import { Button } from "@/components/ui/button";
import type { ContractorJob } from "@/lib/api/contractor-portal-client";
import { cn } from "@/lib/utils";

/** Opens the project's route map (your location → job site). */
export function ContractorMapButton({
  job,
  compact = false,
  className,
}: {
  job: Pick<ContractorJob, "number" | "site" | "coordinates" | "customer">;
  compact?: boolean;
  className?: string;
}) {
  const openMap = useRouteMap();
  const line = siteLine(job);
  const [lng, lat] = job.coordinates || [0, 0];
  const coords = lat || lng ? { lat, lng } : null;
  if (!openMap || (!line && !coords)) return null;
  return (
    <Button
      type="button"
      size={compact ? "icon-sm" : "default"}
      variant="outline"
      className={cn("shrink-0", className)}
      data-row-nav-ignore
      title="View route on map"
      aria-label={`View route to ${job.number} on map`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMap({
          recordType: "job",
          recordNumber: job.number,
          customerName: job.customer?.name,
          customerAddress: line,
          customerCoords: coords,
        });
      }}
    >
      <Navigation className="size-3.5" aria-hidden />
      {compact ? null : "Directions"}
    </Button>
  );
}

/** Message the office about this job — opens the Messages page on that thread. */
export function ContractorChatButton({ jobId, number, compact = false }: { jobId: string; number: string; compact?: boolean }) {
  return (
    <TechChatButton
      side="technician"
      contextType="job"
      contextId={jobId}
      iconOnly={compact}
      label={compact ? `Message the office about ${number}` : "Message office"}
      variant="outline"
      className={compact ? "size-8 text-[var(--ct-accent)]" : undefined}
    />
  );
}
