"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usStateName } from "@/lib/data/us-states";
import type { ServiceArea } from "@/store/serviceAreasSlice";

/** ZIP codes revealed per "See more" click. */
const ZIP_BATCH = 40;

/** One city's coverage in a modal: city, state, ZIP count and its ZIP codes in batches. */
export function ServiceAreaDetailDialog({
  area,
  onOpenChange,
  onEdit,
}: {
  area: ServiceArea | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (area: ServiceArea) => void;
}) {
  return (
    <Dialog open={Boolean(area)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-lenis-prevent>
        {/* Keyed per area so each opening starts with the first batch. */}
        {area ? (
          <ServiceAreaDetailBody key={area.id} area={area} onClose={() => onOpenChange(false)} onEdit={onEdit} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ServiceAreaDetailBody({
  area,
  onClose,
  onEdit,
}: {
  area: ServiceArea;
  onClose: () => void;
  onEdit: (area: ServiceArea) => void;
}) {
  const [visible, setVisible] = useState(ZIP_BATCH);
  const cityLabel = [area.location.city, area.location.state].filter(Boolean).join(", ") || area.title;
  const zips = area.zips;
  const shown = zips.slice(0, visible);
  const remaining = zips.length - shown.length;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{cityLabel}</DialogTitle>
        <DialogDescription>
          Customers anywhere in this city — any of its ZIP Codes — can find you and send you requests.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "City", value: area.location.city || area.title },
            { label: "State", value: usStateName(area.location.state) || area.location.state || "—" },
            { label: "ZIP Codes", value: String(zips.length) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-input bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-0.5 truncate font-semibold">{item.value}</p>
            </div>
          ))}
        </div>

        <div>
          {/* "See more" sits beside the count so it is always in view, never under the footer. */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">ZIP Codes</p>
              <p className="text-xs text-muted-foreground">
                Showing {shown.length} of {zips.length}
              </p>
            </div>
            {remaining > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVisible((count) => count + ZIP_BATCH)}
              >
                See more ({remaining} left)
              </Button>
            ) : null}
          </div>
          {zips.length ? (
            <ul className="mt-3 grid max-h-[min(16rem,35dvh)] grid-cols-4 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-6">
              {shown.map((zip) => (
                <li
                  key={zip}
                  className="rounded-md border border-input bg-muted/40 px-2 py-1.5 text-center text-sm tabular-nums"
                >
                  {zip}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No ZIP Codes are listed for this city.</p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button
          type="button"
          onClick={() => {
            onClose();
            onEdit(area);
          }}
        >
          Edit
        </Button>
      </DialogFooter>
    </>
  );
}
