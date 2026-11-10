"use client";

import { PipelineBoard } from "@/components/portal/pipeline/pipeline-board";
import { PortalPage } from "@/components/portal/portal-page";

export function PipelineView() {
  return (
    <PortalPage
      eyebrow="Sales & work"
      title="Pipeline"
      description="Drag a card, or use its ⋯ menu, to move it forward. Customers and crew are notified automatically."
    >
      <PipelineBoard />
    </PortalPage>
  );
}
