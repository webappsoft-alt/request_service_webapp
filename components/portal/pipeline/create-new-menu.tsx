"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, FilePenLine, Plus, UserPlus } from "lucide-react";
import {
  CreateJobDialog,
  CreateLeadDialog,
} from "@/components/portal/create-work-dialogs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PipelineCard } from "@/lib/api/pipeline-client";
import type { PortalRequest } from "@/lib/data/portal";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/store/hooks";
import { pipelineCardAdded } from "@/store/pipelineSlice";

/** A new lead as the board's "New leads" card (same fields the server's card builder fills). */
function leadCard(request: PortalRequest): PipelineCard {
  const cityState = [request.city, request.state].filter(Boolean).join(" ");
  const address = [request.address, cityState, request.zip]
    .map((part) => String(part || "").trim())
    .filter((part) => part.length > 1)
    .join(", ");
  const now = new Date().toISOString();
  return {
    key: `request:${request.id}`,
    kind: "request",
    id: request.id,
    groupId: "leads_new",
    number: request.number,
    title: request.serviceName || "New lead",
    category: "",
    customerName: request.customerName || "No customer",
    address,
    status: request.status || "new",
    statusOf: "request",
    blocker: null,
    source: request.source || "phone",
    value: 0,
    date: request.createdAt || now,
    updatedAt: request.updatedAt || now,
    href: `/pro/dashboard/requests/${request.id}`,
  };
}

type Choice = "lead" | "estimate" | "schedule";

const CHOICES: {
  id: Choice;
  title: string;
  text: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    id: "lead",
    title: "New lead",
    text: "Add a customer request taken by phone or in person. You can build the estimate later.",
    icon: UserPlus,
  },
  {
    id: "estimate",
    title: "New estimate",
    text: "Build an estimate for a new or existing customer. The starting point for most projects.",
    icon: FilePenLine,
  },
  {
    id: "schedule",
    title: "Schedule a job",
    text: "Put work straight on the calendar, with a date, time and crew.",
    icon: CalendarPlus,
  },
];

/**
 * The Pipeline's "+ Create new": a chooser that opens the app's existing create flows (the lead
 * and job dialogs, the estimate wizard), so nothing is created differently from the other tabs.
 */
export function CreateNewMenu({ className }: { className?: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);

  const choose = (choice: Choice) => {
    setChooserOpen(false);
    if (choice === "lead") setLeadOpen(true);
    else if (choice === "schedule") setJobOpen(true);
    else router.push("/pro/dashboard/new-estimate/new");
  };

  return (
    <>
      <Button
        size="sm"
        className={cn("h-8 gap-1.5 text-[12px]", className)}
        onClick={() => setChooserOpen(true)}
      >
        <Plus className="size-3.5" aria-hidden />
        Create new
      </Button>

      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle>What would you like to create?</DialogTitle>
            <DialogDescription>
              It lands on the pipeline in the right column.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            {CHOICES.map(({ id, title, text, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                className={cn(
                  "group flex flex-col items-center gap-2 rounded-xl border border-input bg-card px-4 py-5 text-center outline-none",
                  "transition-[background-color,border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5",
                  "hover:border-primary hover:bg-primary hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring/50",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-white/15 group-hover:text-white">
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-semibold transition-colors group-hover:text-white">
                  {title}
                </span>
                <span className="text-[12px] leading-snug text-muted-foreground transition-colors group-hover:text-white/80">
                  {text}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mounted only while open: each dialog loads its customer lists when it mounts. */}
      {leadOpen ? (
        <CreateLeadDialog
          open={leadOpen}
          onOpenChange={setLeadOpen}
          // Stay on the board: the saved lead goes straight into Leads, no reload.
          onCreated={(request) =>
            dispatch(
              pipelineCardAdded({ card: leadCard(request), at: Date.now() }),
            )
          }
        />
      ) : null}
      {jobOpen ? (
        <CreateJobDialog open={jobOpen} onOpenChange={setJobOpen} />
      ) : null}
    </>
  );
}
