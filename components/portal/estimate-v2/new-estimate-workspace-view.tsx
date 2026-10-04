"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PortalPage } from "@/components/portal/portal-page";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import {
  createEmptyLine,
} from "@/components/portal/line-items-editor";
import { SendApprovalDialog } from "@/components/portal/send-approval-dialog";
import { shareUrlFor } from "@/components/portal/use-estimate-share";
import { SiteVisitsPanel } from "@/components/portal/estimate-v2/site-visits-panel";
import { ExistingInformationPanel } from "@/components/portal/estimate-v2/existing-information-panel";
import { SectionedLineItemsEditor } from "@/components/portal/estimate-v2/sectioned-line-items-editor";
import { workItemsToJobCostLines } from "@/components/portal/estimate-v2/work-items-editor";
import {
  jobCostMix,
  type JobCostLine,
} from "@/components/portal/use-job-costing";
import {
  buildEstimate,
  linesToEstimateItems,
  todayISO,
} from "@/components/portal/work-builders";
import {
  estimateStatusLabel,
  estimateStatusToneDistinct,
  opportunityStatusForEstimateStatus,
  opportunityStatusLabel,
  opportunityStatusTone,
} from "@/lib/data/estimate-v2-status";
import {
  getEstimateV2Opportunity,
  getOpportunityByEstimateId,
  updateEstimateV2Opportunity,
  createEstimateV2SiteAssessment,
  createEstimateV2Estimate,
  resolveEstimateV2Acceptance,
  type AssessmentWorkItem,
  type EstimateV2Opportunity,
  type EstimateV2SiteAssessment,
  type OpportunityAttachment,
  type OpportunityMeasurement,
  type PrepChoice,
} from "@/lib/api/estimate-v2-client";
import {
  finalizeEstimate,
  getEstimate,
  shareEstimate,
  updateEstimate,
} from "@/lib/api/crm-client";
import { formatDate, formatMoney } from "@/lib/format";
import type { Estimate, EstimateChangeRequest, EstimateCustomerUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchTaxRatePercent } from "@/lib/tax/state-tax";
import { estimateCanShare } from "@/lib/data/portal";
import { stripChangeRequestLinesFromNotes } from "@/lib/data/estimate-change-requests";

const PREP_OPTIONS = [
  {
    id: "schedule_assessment" as const,
    title: "Schedule site assessment",
    body: "Someone needs to visit before pricing.",
  },
  {
    id: "have_information" as const,
    title: "I already have the information",
    body: "Skip the visit — enter photos, notes, and work items you already have.",
  },
  {
    id: "create_now" as const,
    title: "Create estimate now",
    body: "On-site or ready to price immediately.",
  },
] as const;

const RAIL_CARD =
  "rounded-2xl border border-[#94a3b8] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const ACTIVITY_PREVIEW_COUNT = 4;
const MAIN_CARD =
  "rounded-2xl border border-[#94a3b8] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
      {children}
    </h2>
  );
}

function ChangeRequestsRail({
  status,
  changeRequests,
  customerUpdates,
}: {
  status?: string;
  changeRequests: EstimateChangeRequest[];
  customerUpdates: EstimateCustomerUpdate[];
}) {
  const sorted = [...changeRequests].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  if (!sorted.length && !customerUpdates.length) return null;

  const openCount = sorted.filter((row) => !row.addressedAt).length;
  const waiting = status === "changes_requested" || openCount > 0;
  const latest = sorted[0];
  const older = sorted.slice(1);
  const latestUpdate = [...customerUpdates].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )[0];

  return (
    <div
      className={cn(
        RAIL_CARD,
        waiting
          ? "border-fuchsia-300 bg-fuchsia-50/80"
          : "border-emerald-300 bg-emerald-50/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <SectionLabel>
          {waiting ? "Customer requested changes" : "Changes addressed"}
        </SectionLabel>
        {!waiting ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-xs leading-relaxed",
          waiting ? "text-fuchsia-900/80" : "text-emerald-900/80",
        )}
      >
        {waiting
          ? "Revise the estimate, then use Preview & send update. The customer will see what changed on the same link."
          : "You sent an update for these requests. New asks from the customer will show here again."}
      </p>

      {latest ? (
        <div
          className={cn(
            "mt-3 rounded-lg border bg-white p-2.5",
            waiting ? "border-fuchsia-200" : "border-emerald-200",
          )}
        >
          <div className="flex items-start gap-2">
            {waiting ? null : (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            )}
            <div className="min-w-0">
              <p className="text-sm leading-snug text-slate-800">{latest.reason}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {formatDate(latest.at)}
                {waiting ? " · Latest" : " · Done"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {older.length ? (
        <ul className="mt-2 max-h-28 space-y-1.5 overflow-y-auto pr-0.5">
          {older.map((row, index) => (
            <li
              key={row.id || `${row.at}-${index}`}
              className="flex items-start gap-1.5 rounded-md bg-white/80 px-2 py-1.5"
            >
              {row.addressedAt || !waiting ? (
                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-600" />
              ) : (
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fuchsia-400" />
              )}
              <div className="min-w-0">
                <p className="line-clamp-2 text-xs leading-snug text-slate-700">
                  {row.reason}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(row.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {sorted.length > 1 ? (
        <p className="mt-1.5 text-[10px] text-slate-500">
          {sorted.length} requests · newest first
        </p>
      ) : null}

      {latestUpdate && !waiting ? (
        <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/80">
          Last sent: {latestUpdate.summary}
        </p>
      ) : null}
    </div>
  );
}

function customerNameFromOpportunity(opportunity: EstimateV2Opportunity) {
  const c = opportunity.customerId;
  if (!c || typeof c === "string") return "Customer";
  const company = String(c.companyName || "").trim();
  if (company) return company;
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.email || "Customer";
}

function customerContactFromOpportunity(opportunity: EstimateV2Opportunity) {
  const c = opportunity.customerId;
  if (!c || typeof c === "string") return undefined;
  const email = String(c.email || "").trim();
  const phone = String(c.phone || "").trim();
  if (!email && !phone) return undefined;
  return { email, phone };
}

function customerIdOf(opportunity: EstimateV2Opportunity) {
  const c = opportunity.customerId;
  if (!c) return "";
  if (typeof c === "string") return c;
  return String(c.id || c._id || "");
}

function propertyLine(opportunity: EstimateV2Opportunity) {
  const p = opportunity.propertyAddress || {};
  return [p.address || p.street, p.city, p.state, p.zip].filter(Boolean).join(", ") || "—";
}

function estimateItemKind(type: string | undefined): JobCostLine["kind"] {
  const raw = String(type || "labor").toLowerCase();
  if (raw === "equipment") return "equipment";
  if (raw === "material" || raw === "materials") return "materials";
  return "labor";
}

/** Stamp workspace section/images onto saved estimate items for the send preview. */
function withWorkspaceLineMeta(estimate: Estimate, lines: JobCostLine[]): Estimate {
  return {
    ...estimate,
    items: estimate.items.map((item) => {
      const match =
        lines.find((line) => line.id === item.id) ||
        lines.find(
          (line) =>
            (line.description || "").trim() === (item.description || "").trim() &&
            line.kind === estimateItemKind(item.type),
        );
      if (!match) return item;
      const section = String(match.section || item.section || "").trim();
      const images =
        match.kind === "materials"
          ? (match.images || item.images || []).filter((src) => Boolean(String(src || "").trim()))
          : item.images;
      return {
        ...item,
        ...(section ? { section } : { section: undefined }),
        ...(images?.length ? { images } : {}),
      };
    }),
  };
}

function estimateToLines(estimate: Estimate | null): JobCostLine[] {
  if (!estimate?.items?.length) return [createEmptyLine("labor")];
  return estimate.items.map((item) => {
    const kind = estimateItemKind(item.type);
    return {
      id: item.id || `line_${Math.random().toString(36).slice(2)}`,
      description: item.description || "",
      kind,
      quantity: Number(item.quantity) || 1,
      unit: item.unit || (kind === "labor" ? "hr" : "ea"),
      unitPrice: Number(item.unitPrice) || 0,
      ...(kind === "materials"
        ? { images: Array.isArray(item.images) ? item.images : [] }
        : {}),
      ...(String(item.section || "").trim()
        ? { section: String(item.section).trim() }
        : {}),
    };
  });
}

/** Combine opportunity + visit work items into starting estimate lines. */
function collectStartingLines(data: EstimateV2Opportunity): JobCostLine[] {
  const fromVisits = (data.siteAssessments || [])
    .filter((visit) => !["cancelled", "no_show"].includes(visit.status))
    .flatMap((visit) => workItemsToJobCostLines(visit.workItems || []));
  const fromOpportunity = workItemsToJobCostLines(data.workItems || []);
  return [...fromVisits, ...fromOpportunity];
}

export function NewEstimateWorkspaceView({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const { employees } = usePortalCrew();
  const estimateSectionRef = useRef<HTMLDivElement>(null);

  const [opportunity, setOpportunity] = useState<EstimateV2Opportunity | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptStep, setAcceptStep] = useState<"choose" | "job" | "invoice">("choose");
  const [jobStartAt, setJobStartAt] = useState("");
  const [jobDueAt, setJobDueAt] = useState("");
  const [invoiceDueAt, setInvoiceDueAt] = useState("");
  const [sendEstimate, setSendEstimate] = useState<Estimate | null>(null);
  useEffect(() => {
    if (!acceptOpen) {
      setAcceptStep("choose");
      return;
    }
    const today = todayISO();
    setJobStartAt(today);
    setJobDueAt(today);
    const invoiceDue = new Date(`${today}T12:00:00`);
    invoiceDue.setDate(invoiceDue.getDate() + 14);
    setInvoiceDueAt(invoiceDue.toISOString().slice(0, 10));
    setAcceptStep(estimate?.jobId ? "invoice" : "choose");
  }, [acceptOpen, estimate?.jobId]);

  const [scopeOfWork, setScopeOfWork] = useState("");
  const [terms, setTerms] = useState("Proposal valid for 30 calendar days from issue date.");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<JobCostLine[]>([createEmptyLine("labor")]);
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [prepFindings, setPrepFindings] = useState("");
  const [prepMeasurements, setPrepMeasurements] = useState<OpportunityMeasurement[]>([]);
  const [prepAttachments, setPrepAttachments] = useState<OpportunityAttachment[]>([]);
  const [prepWorkItems, setPrepWorkItems] = useState<AssessmentWorkItem[]>([]);
  const prepInfoRef = useRef<HTMLDivElement>(null);
  /** When Existing info / Site visits is expanded, hide the estimate builder underneath. */
  const [prepPanelOpen, setPrepPanelOpen] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) setLoading(true);
    try {
      let data: EstimateV2Opportunity;
      try {
        data = await getEstimateV2Opportunity(opportunityId);
      } catch {
        // Deep links may still carry a classic Estimate id — resolve to opportunity.
        const byEstimate = await getOpportunityByEstimateId(opportunityId, {
          silent: true,
        });
        if (byEstimate?.id && byEstimate.id !== opportunityId) {
          router.replace(`/pro/dashboard/new-estimate/${byEstimate.id}`);
          return;
        }
        throw new Error("Estimate not found.");
      }
      setOpportunity(data);
      setFollowUpAt(
        data.followUpAt ? new Date(data.followUpAt).toISOString().slice(0, 10) : "",
      );
      setFollowUpNotes(data.followUpNotes || "");
      setPrepFindings(data.prepFindings || "");
      setPrepMeasurements(
        (data.prepMeasurements || []).map((item, index) => ({
          ...item,
          id: item.id || `pm_${index}`,
          label: item.label || "",
          value: item.value || "",
          unit: item.unit || "",
        })),
      );
      setPrepAttachments(
        (data.customerAttachments || []).map((item, index) => ({
          ...item,
          id: item.id || `pa_${index}`,
          name: item.name || "",
          url: item.url,
          type: item.type || "",
          size: item.size || 0,
          addedAt: item.addedAt,
        })),
      );
      setPrepWorkItems(
        (data.workItems || []).map((item, index) => {
          const typeRaw = String(item.type || "labor").toLowerCase();
          const type =
            typeRaw === "equipment"
              ? ("equipment" as const)
              : typeRaw === "material" || typeRaw === "materials"
                ? ("material" as const)
                : ("labor" as const);
          return {
            ...item,
            id: item.id || `owi_${index}`,
            description: item.description || "",
            type,
            quantity: item.quantity ?? 1,
            unit: item.unit || (type === "labor" ? "hr" : "ea"),
            unitPrice: item.unitPrice ?? null,
          };
        }),
      );

      const linked = data.estimates?.[0] || null;
      let freshEstimate: Estimate | null = null;
      if (linked?.id) {
        freshEstimate = (await getEstimate(linked.id)) || linked;
        setEstimate(freshEstimate);
        setScopeOfWork(
          stripChangeRequestLinesFromNotes(
            freshEstimate.notes || data.description || data.prepFindings || "",
          ),
        );
        setTerms(freshEstimate.terms || "Proposal valid for 30 calendar days from issue date.");
        setDiscount(Number(freshEstimate.discount) || 0);
        const fromEstimate = estimateToLines(freshEstimate);
        const estimateHasContent = fromEstimate.some(
          (line) => line.description.trim() && line.description !== "Labour",
        );
        if (estimateHasContent) {
          setLines(fromEstimate);
        } else {
          const fromWork = collectStartingLines(data);
          setLines(fromWork.length ? fromWork : [createEmptyLine("labor")]);
        }

        // Heal drift: opportunity pipeline status must follow the linked estimate.
        const expected = opportunityStatusForEstimateStatus(freshEstimate.status);
        if (expected && data.status !== expected) {
          try {
            await updateEstimateV2Opportunity(data.id, { status: expected });
            data = { ...data, status: expected };
            setOpportunity(data);
          } catch {
            /* non-blocking */
          }
        }
      } else {
        setEstimate(null);
        setScopeOfWork(data.description || data.prepFindings || "");
        setTerms("Proposal valid for 30 calendar days from issue date.");
        setDiscount(0);
        const fromWork = collectStartingLines(data);
        setLines(fromWork.length ? fromWork : [createEmptyLine("labor")]);
      }

      const rate = await fetchTaxRatePercent(data.propertyAddress?.state);
      setTaxRatePercent(rate);

      // Full load only: open prep path when no estimate yet; never fight silent refreshes.
      if (!silent) {
        const needsPrep =
          data.prepChoice === "have_information" ||
          data.prepChoice === "schedule_assessment";
        const hasEst = Boolean(data.estimates?.[0]?.id);
        setPrepPanelOpen(needsPrep && !hasEst);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load estimate.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [opportunityId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const visits: EstimateV2SiteAssessment[] = useMemo(
    () => opportunity?.siteAssessments || [],
    [opportunity],
  );

  const hasCompletedVisit = useMemo(
    () => visits.some((visit) => visit.status === "completed"),
    [visits],
  );

  const visitSupportSummary = useMemo(() => {
    const fromExisting = opportunity?.prepChoice === "have_information";
    const activeVisits = fromExisting
      ? []
      : visits.filter((visit) => !["cancelled", "no_show"].includes(visit.status));
    const visitWorkCount = activeVisits.reduce(
      (sum, visit) =>
        sum +
        (visit.workItems || []).filter((item) => String(item.description || "").trim())
          .length,
      0,
    );
    const oppWorkCount = (opportunity?.workItems || []).filter((item) =>
      String(item.description || "").trim(),
    ).length;
    const photoCount = fromExisting
      ? opportunity?.customerAttachments?.length || 0
      : activeVisits.reduce((sum, visit) => sum + (visit.photos?.length || 0), 0);
    const noteCount = fromExisting
      ? String(opportunity?.prepFindings || "").trim()
        ? 1
        : 0
      : activeVisits.reduce((sum, visit) => {
          const bits = [visit.findings, visit.notes, visit.customerRequirements].filter(
            (value) => String(value || "").trim(),
          );
          return sum + bits.length;
        }, 0);
    const measurementCount = fromExisting
      ? opportunity?.prepMeasurements?.length || 0
      : activeVisits.reduce((sum, visit) => sum + (visit.measurements?.length || 0), 0);
    const workItemCount = fromExisting ? oppWorkCount : visitWorkCount + oppWorkCount;
    if (!activeVisits.length && !workItemCount && !measurementCount && !photoCount && !noteCount) {
      return null;
    }
    return {
      visitCount: activeVisits.length,
      photoCount,
      noteCount,
      measurementCount,
      workItemCount,
      fromExistingInformation: fromExisting,
    };
  }, [visits, opportunity]);

  const mix = useMemo(() => jobCostMix(lines), [lines]);
  const subtotal = mix.total;
  const taxAmount = Math.round(subtotal * (taxRatePercent / 100) * 100) / 100;
  const grandTotal = Math.max(0, subtotal - (Number(discount) || 0) + taxAmount);
  const filledLines = useMemo(
    () => lines.filter((line) => line.description.trim() || Number(line.unitPrice) > 0),
    [lines],
  );

  /** Site visits only for the assessment path — never when user already has information. */
  const showVisits =
    opportunity?.prepChoice === "schedule_assessment" ||
    (visits.length > 0 &&
      opportunity?.prepChoice !== "have_information" &&
      opportunity?.prepChoice !== "create_now");

  const showPrepInfo = opportunity?.prepChoice === "have_information";

  const activityTimeline = useMemo(() => {
    type TimelineItem = {
      key: string;
      action: string;
      details?: string;
      at: string;
    };
    const items: TimelineItem[] = [];

    for (const [index, item] of (opportunity?.activities || []).entries()) {
      if (!item?.action) continue;
      items.push({
        key: `opp-${item.at || index}-${item.action}`,
        action: item.action,
        details: item.details || undefined,
        at: item.at || "",
      });
    }

    for (const [index, item] of (estimate?.activities || []).entries()) {
      if (!item?.title) continue;
      items.push({
        key: `est-act-${item.id || index}-${item.title}`,
        action: item.title,
        details: item.description || undefined,
        at: item.createdAt || "",
      });
    }

    for (const [index, item] of (estimate?.logs || []).entries()) {
      if (!item?.action) continue;
      // Prefer higher-level activities for share/status noise when both exist.
      if (
        item.action === "Status set" ||
        item.action === "Estimate shared" ||
        item.action === "Updated estimate shared"
      ) {
        continue;
      }
      items.push({
        key: `est-log-${item.id || index}-${item.action}`,
        action: item.action,
        details: item.details || undefined,
        at: item.timestamp || "",
      });
    }

    const seen = new Set<string>();
    return items
      .sort(
        (a, b) =>
          new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
      )
      .filter((item) => {
        const day = String(item.at || "").slice(0, 10);
        const dedupe = `${item.action}|${item.details || ""}|${day}`;
        if (seen.has(dedupe)) return false;
        seen.add(dedupe);
        return true;
      });
  }, [opportunity?.activities, estimate?.activities, estimate?.logs]);

  const informationSourceLabel = useMemo(() => {
    if (!opportunity) return null;
    if (opportunity.prepChoice === "have_information") {
      const when = opportunity.updatedAt || opportunity.createdAt;
      return `Existing information${when ? ` · ${formatDate(when)}` : ""}`;
    }
    const completed = visits.filter((visit) =>
      ["completed", "in_progress"].includes(visit.status),
    );
    const sourceVisit = completed[0] || visits[0];
    if (sourceVisit) {
      const label =
        sourceVisit.visitTypeLabel ||
        `Visit #${sourceVisit.sequenceNumber || 1}`;
      const when = sourceVisit.scheduledAt || sourceVisit.completedAt;
      return `Site assessment · ${label}${when ? ` · ${formatDate(when)}` : ""}`;
    }
    if (opportunity.prepChoice === "create_now") return "Created directly";
    return null;
  }, [opportunity, visits]);

  const canBuildEstimate =
    Boolean(estimate) ||
    opportunity?.prepChoice === "have_information" ||
    opportunity?.prepChoice === "create_now" ||
    hasCompletedVisit ||
    opportunity?.status === "assessment_completed" ||
    opportunity?.status === "estimate_draft" ||
    opportunity?.status === "estimate_sent" ||
    opportunity?.status === "won";

  /** On visit / existing-info paths, hide the estimate while that panel is expanded. */
  const showEstimateSection =
    opportunity?.prepChoice === "create_now" ||
    (!showVisits && !showPrepInfo) ||
    !prepPanelOpen;

  async function ensureEstimate() {
    if (!opportunity) return null;
    if (estimate?.id) return estimate;
    setSaving(true);
    try {
      const created = await createEstimateV2Estimate(opportunity.id, {
        title: opportunity.title,
        notes: scopeOfWork || opportunity.description || "",
        terms,
        discount: Number(discount) || 0,
        customerId: customerIdOf(opportunity),
        propertyAddress: opportunity.propertyAddress,
      });
      if (!created.estimate?.id) throw new Error("Estimate was not created.");
      setEstimate(created.estimate);
      toast.success(`${created.estimate.number} created.`);
      await load();
      return created.estimate;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create estimate.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function setPrepChoice(prepChoice: PrepChoice) {
    if (!opportunity) return;
    setSaving(true);
    try {
      await updateEstimateV2Opportunity(opportunity.id, { prepChoice });
      if (prepChoice === "schedule_assessment" && visits.length === 0) {
        const customerDescription = String(opportunity.description || "").trim();
        const officeNotes = String(opportunity.internalNotes || "").trim();
        await createEstimateV2SiteAssessment(opportunity.id, {
          status: "scheduled",
          visitType: "initial_assessment",
          instructions: customerDescription || opportunity.title,
          // Copies from estimate create — edits on the visit stay on the assessment only.
          customerRequirements: customerDescription,
          findings: officeNotes || customerDescription,
        });
      }
      await load();
      toast.success("Preparation path updated.");

      if (prepChoice === "create_now") {
        setPrepPanelOpen(false);
        window.setTimeout(() => {
          estimateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      } else if (prepChoice === "have_information" || prepChoice === "schedule_assessment") {
        setPrepPanelOpen(true);
        if (prepChoice === "have_information") {
          window.setTimeout(() => {
            prepInfoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 80);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update preparation path.");
    } finally {
      setSaving(false);
    }
  }

  async function savePrepInfo() {
    if (!opportunity) return;
    setSaving(true);
    try {
      await updateEstimateV2Opportunity(opportunity.id, {
        prepFindings,
        prepMeasurements: prepMeasurements.filter((item) => String(item.label || "").trim()),
        customerAttachments: prepAttachments,
        workItems: prepWorkItems.filter((item) => String(item.description || "").trim()),
      });
      await load();
      setPrepPanelOpen(false);
      toast.success("Existing information saved.");
      window.setTimeout(() => {
        estimateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save information.");
    } finally {
      setSaving(false);
    }
  }

  async function continueToEstimate() {
    if (!opportunity) return;
    setSaving(true);
    try {
      await updateEstimateV2Opportunity(opportunity.id, {
        prepFindings,
        prepMeasurements: prepMeasurements.filter((item) => String(item.label || "").trim()),
        customerAttachments: prepAttachments,
        workItems: prepWorkItems.filter((item) => String(item.description || "").trim()),
      });
      const created = await createEstimateV2Estimate(opportunity.id, {
        title: opportunity.title,
        notes: scopeOfWork || prepFindings || opportunity.description || "",
        terms,
        discount: Number(discount) || 0,
        customerId: customerIdOf(opportunity),
        propertyAddress: opportunity.propertyAddress,
      });
      if (!created.estimate?.id) throw new Error("Estimate was not created.");
      toast.success(
        created.reused
          ? `${created.estimate.number} updated with work items.`
          : `${created.estimate.number} created from work items.`,
      );
      await load();
      window.setTimeout(() => {
        setPrepPanelOpen(false);
        estimateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not continue to estimate.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEstimateDraft(options?: {
    silent?: boolean;
  }): Promise<Estimate | null> {
    if (!opportunity) return null;
    setSaving(true);
    try {
      let current = estimate;
      if (!current?.id) {
        const created = await createEstimateV2Estimate(opportunity.id, {
          title: opportunity.title,
          notes: scopeOfWork,
          terms,
          discount: Number(discount) || 0,
          customerId: customerIdOf(opportunity),
          propertyAddress: opportunity.propertyAddress,
        });
        current = created.estimate;
      }
      if (!current?.id) throw new Error("Estimate missing.");

      const filled = filledLines.length ? filledLines : [createEmptyLine("labor")];
      const draft = buildEstimate({
        id: current.id,
        number: current.number,
        title: opportunity.title,
        providerId: current.providerId,
        customerId: customerIdOf(opportunity) || current.customerId,
        customerName: customerNameFromOpportunity(opportunity),
        address: {
          id: opportunity.propertyAddress?.addressId || current.propertyAddress?.id || `addr_${current.id}`,
          address: opportunity.propertyAddress?.address || opportunity.propertyAddress?.street || "",
          street: opportunity.propertyAddress?.street || opportunity.propertyAddress?.address || "",
          city: opportunity.propertyAddress?.city || "",
          state: opportunity.propertyAddress?.state || "",
          zip: opportunity.propertyAddress?.zip || "",
          country: "US",
          lat: opportunity.propertyAddress?.lat ?? null,
          lng: opportunity.propertyAddress?.lng ?? null,
          latitude: opportunity.propertyAddress?.lat ?? null,
          longitude: opportunity.propertyAddress?.lng ?? null,
        },
        status: current.status === "draft" ? "draft" : current.status,
        issuedAt: current.issuedAt || todayISO(),
        notes: scopeOfWork,
        terms,
        lines: filled,
        taxRatePercent,
      });

      const saved = await updateEstimate(current.id, {
        ...draft,
        discount: Number(discount) || 0,
        items: linesToEstimateItems(current.id, filled, taxRatePercent),
      });
      const next = saved || draft;
      setEstimate(next);
      if (!options?.silent) {
        toast.success(
          next.status === "draft" ? "Estimate draft saved." : "Estimate saved.",
        );
      }
      await load({ silent: true });
      return next;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save estimate.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function openSendDialog() {
    const saved = await saveEstimateDraft({ silent: true });
    let current = saved || estimate;
    if (!current?.id) current = await ensureEstimate();
    if (!current?.id) return;
    try {
      if (
        current.status === "draft" ||
        current.status === "site_visit" ||
        current.status === "inspected"
      ) {
        const finalized = await finalizeEstimate(current.id, current);
        const refreshed = finalized || (await getEstimate(current.id));
        current = refreshed || { ...current, status: "finalized" };
        setEstimate(current);
        const expected = opportunityStatusForEstimateStatus(current.status);
        if (expected && opportunity && opportunity.status !== expected) {
          try {
            await updateEstimateV2Opportunity(opportunity.id, { status: expected });
            setOpportunity({ ...opportunity, status: expected });
          } catch {
            /* non-blocking */
          }
        }
      }
      // Preview uses live workspace sections/images even if an older API omitted them.
      const forSend = withWorkspaceLineMeta(current, lines);
      setEstimate(forSend);
      setSendEstimate(forSend);
      setSendOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not prepare estimate for send.");
    }
  }

  /**
   * Public customer link `/e/{shareToken}` — works for registered and outside customers.
   * Creates the token (without emailing) when needed, then copies to clipboard.
   */
  async function copyShareLink() {
    try {
      // Persist latest line items / notes before minting a public link.
      const saved = await saveEstimateDraft();
      let current = saved || estimate;
      if (!current?.id) current = await ensureEstimate();
      if (!current?.id) {
        toast.error("Save the estimate first.");
        return;
      }

      setSaving(true);
      let token = String(current.shareToken || "").trim();

      if (!token) {
        if (
          current.status === "draft" ||
          current.status === "site_visit" ||
          current.status === "inspected"
        ) {
          const finalized = await finalizeEstimate(current.id, current);
          current = finalized || { ...current, status: "finalized" };
          setEstimate(current);
        }

        if (!estimateCanShare(current.status) && current.status !== "finalized") {
          toast.error("Finalize or send the estimate before sharing a customer link.");
          return;
        }

        const shared = await shareEstimate(current.id, { skipEmail: true });
        token = String(shared.shareToken || "").trim();
        if (!token) {
          toast.error("Could not create a customer share link.");
          return;
        }
        const nextStatus =
          (shared.status as Estimate["status"]) ||
          (current.status === "finalized" ? "sent" : current.status);
        current = {
          ...current,
          shareToken: token,
          status: nextStatus,
        };
        setEstimate(current);
        const expected = opportunityStatusForEstimateStatus(current.status);
        if (expected && opportunity && opportunity.status !== expected) {
          try {
            await updateEstimateV2Opportunity(opportunity.id, { status: expected });
            setOpportunity({ ...opportunity, status: expected });
          } catch {
            /* non-blocking */
          }
        }
      }

      const linkUrl = shareUrlFor(token);
      if (!linkUrl) {
        toast.error("Could not create a customer share link.");
        return;
      }
      await navigator.clipboard.writeText(linkUrl);
      toast.success("Customer link copied — send it to anyone. No account needed.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not copy the customer link.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveFollowUp() {
    if (!opportunity) return;
    setSaving(true);
    try {
      await updateEstimateV2Opportunity(opportunity.id, {
        followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        followUpNotes,
      });
      toast.success("Follow-up saved.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save follow-up.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptance(
    nextAction: "start_now" | "schedule_later" | "invoice_now",
  ) {
    if (!opportunity || !estimate?.id) return;
    if (nextAction === "invoice_now") {
      if (!invoiceDueAt) {
        toast.error("Set the invoice due date before creating it.");
        return;
      }
    } else if (!jobStartAt || !jobDueAt) {
      toast.error("Set the job start and due dates.");
      return;
    } else if (jobDueAt < jobStartAt) {
      toast.error("Due date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      const result = await resolveEstimateV2Acceptance(opportunity.id, {
        estimateId: estimate.id,
        nextAction,
        markAccepted:
          estimate.status !== "accepted" &&
          estimate.status !== "converted_to_job",
        signedBy: "Customer (office)",
        title: opportunity.title,
        dueAt: nextAction === "invoice_now" ? invoiceDueAt : jobDueAt,
        scheduledAt: nextAction === "invoice_now" ? undefined : jobStartAt,
      });
      if (nextAction === "invoice_now") {
        toast.success(
          `${result.invoice?.number || "Invoice"} created from ${estimate.number}.`,
        );
        setAcceptOpen(false);
        if (result.invoice?.id) {
          router.push(`/pro/dashboard/invoices/${result.invoice.id}`);
          return;
        }
      } else {
        toast.success(`${result.job?.number || "Job"} created and scheduled.`);
        setAcceptOpen(false);
        if (result.job?.id) {
          router.push(`/pro/dashboard/jobs/${result.job.id}`);
          return;
        }
      }
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not continue from this estimate.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PortalPage eyebrow="Work / Estimate" title="Loading…">
        <div className="h-40 animate-pulse rounded-xl border border-input bg-secondary/40" />
      </PortalPage>
    );
  }

  if (!opportunity) {
    return (
      <PortalPage eyebrow="Work / Estimate" title="Estimate not found">
        <Button variant="outline" onClick={() => router.push("/pro/dashboard/new-estimate")}>
          Back to list
        </Button>
      </PortalPage>
    );
  }

  const estimateLocked =
    estimate?.status === "accepted" ||
    estimate?.status === "converted_to_job" ||
    estimate?.status === "rejected" ||
    estimate?.status === "expired";

  const alreadyShared =
    Boolean(estimate?.shareToken) ||
    estimate?.status === "sent" ||
    estimate?.status === "changes_requested" ||
    estimate?.status === "accepted" ||
    estimate?.status === "converted_to_job";

  const sendButtonLabel =
    estimate?.status === "changes_requested"
      ? "Preview & send update"
      : alreadyShared
        ? "Send again"
        : "Preview & send";

  return (
    <PortalPage
      eyebrow="Work / Estimate"
      title={`${opportunity.number} · ${opportunity.title}`}
      description={`${customerNameFromOpportunity(opportunity)} · ${propertyLine(opportunity)}`}
      badge={
        estimate?.status ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
              estimateStatusToneDistinct(estimate.status),
            )}
          >
            {estimateStatusLabel(estimate.status)}
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
              opportunityStatusTone(opportunity.status),
            )}
          >
            {opportunityStatusLabel(opportunity.status)}
          </span>
        )
      }
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/pro/dashboard/new-estimate">All estimates</Link>
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.58fr)_minmax(0,2.42fr)]">
        {/* Left rail */}
        <section className="space-y-3.5">
          {(estimate?.changeRequests?.length || estimate?.customerUpdates?.length) ? (
            <div className="lg:sticky lg:top-4 lg:z-10">
              <ChangeRequestsRail
                status={estimate?.status}
                changeRequests={estimate?.changeRequests || []}
                customerUpdates={estimate?.customerUpdates || []}
              />
            </div>
          ) : null}

          <div className={RAIL_CARD}>
            <SectionLabel>Customer & property</SectionLabel>
            <p className="mt-2.5 text-[15px] font-semibold tracking-tight text-slate-900">
              {customerNameFromOpportunity(opportunity)}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {propertyLine(opportunity)}
            </p>
          </div>

          <div className={RAIL_CARD}>
            <SectionLabel>Work request</SectionLabel>
            {opportunity.categoryName ? (
              <p className="mt-2.5 inline-flex rounded-md bg-primary/8 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-primary uppercase">
                {opportunity.categoryName}
              </p>
            ) : null}
            <p className="mt-2 text-[15px] font-semibold tracking-tight text-slate-900">
              {opportunity.title}
            </p>
            {opportunity.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {opportunity.description}
              </p>
            ) : null}
          </div>

          <div className={RAIL_CARD}>
            <SectionLabel>How will this estimate be prepared?</SectionLabel>
            <div className="mt-3 grid gap-2">
              {PREP_OPTIONS.map((option) => {
                const selected = opportunity.prepChoice === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={saving}
                    onClick={() => void setPrepChoice(option.id)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition",
                      selected
                        ? "border-primary bg-primary/[0.06] ring-1 ring-primary/30"
                        : "border-[#94a3b8] bg-[#fafbfc] hover:border-primary/50 hover:bg-white",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-slate-300 bg-white",
                      )}
                    >
                      {selected ? <Check className="size-2.5 stroke-[3]" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm tracking-tight",
                          selected ? "font-semibold text-slate-900" : "font-medium text-slate-800",
                        )}
                      >
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                        {option.body}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {(estimate?.status === "sent" ||
            (opportunity.status === "estimate_sent" &&
              estimate?.status !== "changes_requested")) && (
            <div className={RAIL_CARD}>
              <SectionLabel>Follow-up</SectionLabel>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Customer hasn&apos;t accepted yet — set a follow-up.
              </p>
              <div className="mt-3 grid gap-2">
                <Input type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
                <Textarea
                  rows={2}
                  placeholder="Follow-up notes"
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                />
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void saveFollowUp()}>
                  Save follow-up
                </Button>
              </div>
            </div>
          )}

          {activityTimeline.length ? (
            <div className={RAIL_CARD}>
              <div className="flex items-baseline justify-between gap-2">
                <SectionLabel>Activity</SectionLabel>
                {activityTimeline.length > ACTIVITY_PREVIEW_COUNT ? (
                  <span className="text-[10px] font-medium tabular-nums text-slate-400">
                    {activityTimeline.length}
                  </span>
                ) : null}
              </div>
              <ol
                className={
                  activityExpanded && activityTimeline.length > ACTIVITY_PREVIEW_COUNT
                    ? "relative mt-3 max-h-64 space-y-0 overflow-y-auto border-l border-[#b4becc] pl-4 pr-1"
                    : "relative mt-3 space-y-0 border-l border-[#b4becc] pl-4"
                }
              >
                {(activityExpanded
                  ? activityTimeline
                  : activityTimeline.slice(0, ACTIVITY_PREVIEW_COUNT)
                ).map((item) => (
                  <li key={item.key} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full border-2 border-primary bg-white" />
                    <p className="text-sm font-medium text-slate-900">{item.action}</p>
                    {item.details ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                        {item.details}
                      </p>
                    ) : null}
                    {item.at ? (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDate(item.at)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
              {activityTimeline.length > ACTIVITY_PREVIEW_COUNT ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="mt-1 h-7 w-full justify-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                  onClick={() => setActivityExpanded((open) => !open)}
                >
                  {activityExpanded ? (
                    <>
                      Show less
                      <ChevronUp className="size-3" />
                    </>
                  ) : (
                    <>
                      Show {activityTimeline.length - ACTIVITY_PREVIEW_COUNT} more
                      <ChevronDown className="size-3" />
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Main column */}
        <section className="min-w-0 space-y-4">
          {showVisits ? (
            <SiteVisitsPanel
              opportunityId={opportunity.id}
              opportunityTitle={opportunity.title}
              opportunityDescription={opportunity.description || ""}
              opportunityInternalNotes={opportunity.internalNotes || ""}
              visits={visits}
              employees={employees}
              saving={saving}
              onRefresh={load}
              onSavingChange={setSaving}
              showBuildEstimate={canBuildEstimate}
              hasEstimate={Boolean(estimate?.id)}
              collapsed={!prepPanelOpen}
              onCollapsedChange={(collapsed) => setPrepPanelOpen(!collapsed)}
              onBuildEstimate={async () => {
                setPrepPanelOpen(false);
                if (!estimate?.id) {
                  await ensureEstimate();
                }
                window.setTimeout(() => {
                  estimateSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }, 180);
              }}
            />
          ) : null}

          {showPrepInfo ? (
            <div ref={prepInfoRef}>
              <ExistingInformationPanel
                findings={prepFindings}
                onFindingsChange={setPrepFindings}
                measurements={prepMeasurements}
                onMeasurementsChange={setPrepMeasurements}
                attachments={prepAttachments}
                onAttachmentsChange={setPrepAttachments}
                workItems={prepWorkItems}
                onWorkItemsChange={setPrepWorkItems}
                saving={saving}
                collapsed={!prepPanelOpen}
                onCollapsedChange={(collapsed) => setPrepPanelOpen(!collapsed)}
                hasEstimate={Boolean(estimate?.id)}
                onSave={savePrepInfo}
                onContinue={continueToEstimate}
              />
            </div>
          ) : null}

          {/* Estimate builder — hidden on visit path until Build estimate creates a draft */}
          {showEstimateSection ? (
          <div ref={estimateSectionRef} className={MAIN_CARD}>
            {canBuildEstimate ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8dee8] pb-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                      Estimate{estimate?.number ? ` · ${estimate.number}` : ""}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {estimate?.status
                        ? estimateStatusLabel(estimate.status)
                        : "Ready to build"}
                    </p>
                    {informationSourceLabel ? (
                      <p className="mt-1.5 text-xs text-slate-500">
                        Information source ·{" "}
                        <span className="font-medium text-slate-800">{informationSourceLabel}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {!estimate && !showVisits ? (
                      <Button size="sm" disabled={saving} onClick={() => void ensureEstimate()}>
                        Build estimate
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving || estimateLocked}
                      onClick={() => void saveEstimateDraft()}
                    >
                      Save draft
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving || !estimate?.id}
                      onClick={() => void copyShareLink()}
                    >
                      <Link2 className="size-3.5" />
                      Copy share link
                    </Button>
                    <Button
                      size="sm"
                      disabled={saving || estimateLocked}
                      onClick={() => void openSendDialog()}
                    >
                      {sendButtonLabel}
                    </Button>
                    {(estimate?.status === "sent" ||
                      estimate?.status === "accepted" ||
                      estimate?.status === "converted_to_job") ? (
                      <>
                        {estimate.jobId ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/pro/dashboard/jobs/${estimate.jobId}`}>
                              Open job
                            </Link>
                          </Button>
                        ) : null}
                        {estimate.invoiceId ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/pro/dashboard/invoices/${estimate.invoiceId}`}>
                              Open invoice
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={saving}
                            onClick={() => setAcceptOpen(true)}
                          >
                            {estimate.jobId
                              ? "Create invoice…"
                              : estimate.status === "accepted" ||
                                  estimate.status === "converted_to_job"
                                ? "Create job or invoice…"
                                : "Customer accepted…"}
                          </Button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="scope">Scope of work</Label>
                    <Textarea
                      id="scope"
                      rows={3}
                      value={scopeOfWork}
                      disabled={estimateLocked}
                      onChange={(e) => setScopeOfWork(e.target.value)}
                      placeholder="Customer-facing description of the work…"
                      className="min-h-[88px] resize-y bg-[#fafbfc]"
                    />
                  </div>

                  <div>
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Label>Line items</Label>
                        <p className="text-xs text-slate-500">
                          Group by trade or stage (Plumbing, Electrical…) — qty × unit price
                        </p>
                      </div>
                    </div>
                    <SectionedLineItemsEditor
                      lines={lines}
                      onChange={setLines}
                      locked={estimateLocked}
                    />
                  </div>

                  <div className="overflow-hidden rounded-xl border border-[#b4becc] bg-[#f8fafc]">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[#b4becc] px-4 py-2.5">
                      <h3 className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                        Estimate summary
                      </h3>
                      <p className="text-xs text-slate-500">
                        {[
                          estimate?.number,
                          opportunity.categoryName,
                          filledLines.length
                            ? `${filledLines.length} line item${filledLines.length === 1 ? "" : "s"}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <div className="grid gap-6 bg-white p-4 sm:grid-cols-2">
                      <div className="space-y-2.5 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Labour</span>
                          <span className="font-medium tabular-nums text-slate-900">{formatMoney(mix.labor)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Material</span>
                          <span className="font-medium tabular-nums text-slate-900">{formatMoney(mix.materials)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Equipment</span>
                          <span className="font-medium tabular-nums text-slate-900">{formatMoney(mix.equipment)}</span>
                        </div>
                      </div>

                      <div className="space-y-2.5 text-sm sm:border-l sm:border-[#d8dee8] sm:pl-6">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Subtotal</span>
                          <span className="tabular-nums text-slate-900">{formatMoney(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <Label htmlFor="discount" className="text-slate-500">
                            Discount
                          </Label>
                          <div className="relative w-24">
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2 text-xs text-slate-400"
                            >
                              $
                            </span>
                            <Input
                              id="discount"
                              className="h-8 border-[#b4becc] bg-[#fafbfc] pl-4 pr-1 text-right text-xs tabular-nums shadow-none"
                              type="number"
                              min={0}
                              step="0.01"
                              value={discount}
                              disabled={estimateLocked}
                              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-500">
                          <span>Tax ({taxRatePercent}%)</span>
                          <span className="tabular-nums">{formatMoney(taxAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t border-[#d8dee8] pt-2.5 text-base font-semibold text-slate-900">
                          <span>Total</span>
                          <span className="tabular-nums">{formatMoney(grandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[#b4becc] bg-white px-4 py-3">
                      <Label htmlFor="terms" className="text-[11px] text-slate-500">
                        Terms
                      </Label>
                      <Input
                        id="terms"
                        className="mt-1 h-8 border-[#b4becc] bg-[#fafbfc] shadow-none"
                        value={terms}
                        disabled={estimateLocked}
                        onChange={(e) => setTerms(e.target.value)}
                      />
                    </div>
                  </div>

                  {visitSupportSummary &&
                  (visitSupportSummary.photoCount > 0 ||
                    visitSupportSummary.noteCount > 0 ||
                    visitSupportSummary.measurementCount > 0 ||
                    visitSupportSummary.workItemCount > 0) ? (
                    <div className="rounded-xl border border-dashed border-[#b4becc] bg-[#fafbfc] px-4 py-3.5">
                      <h3 className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                        Supporting information
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {visitSupportSummary.fromExistingInformation
                          ? "From existing information"
                          : `From ${visitSupportSummary.visitCount || 0} site visit${
                              visitSupportSummary.visitCount === 1 ? "" : "s"
                            }`}
                        {visitSupportSummary.workItemCount
                          ? ` · ${visitSupportSummary.workItemCount} work item(s)`
                          : ""}
                        {visitSupportSummary.photoCount
                          ? ` · ${visitSupportSummary.photoCount} photo/attachment(s)`
                          : ""}
                        {visitSupportSummary.noteCount
                          ? ` · ${visitSupportSummary.noteCount} note(s)`
                          : ""}
                        {visitSupportSummary.measurementCount
                          ? ` · ${visitSupportSummary.measurementCount} measurement(s)`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Measurements stay informational. Work items seed the line items above — edit freely.
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Estimate</h2>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
                  Choose <span className="font-medium text-slate-900">Create estimate now</span> or{" "}
                  <span className="font-medium text-slate-900">I already have the information</span>
                  , or complete a site visit first.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => void setPrepChoice("create_now")}
                  >
                    Create estimate now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void setPrepChoice("have_information")}
                  >
                    I already have the information
                  </Button>
                </div>
              </>
            )}
          </div>
          ) : (
            <div ref={estimateSectionRef} className="h-0 overflow-hidden" aria-hidden />
          )}
        </section>
      </div>

      {sendEstimate || estimate ? (
        <SendApprovalDialog
          open={sendOpen}
          onOpenChange={(open) => {
            setSendOpen(open);
            if (!open) setSendEstimate(null);
          }}
          estimate={sendEstimate || estimate!}
          customer={customerContactFromOpportunity(opportunity)}
          customerLabel={customerNameFromOpportunity(opportunity)}
          mode={
            (sendEstimate || estimate)?.status === "changes_requested"
              ? "update"
              : alreadyShared
                ? "resend"
                : "send"
          }
          onSent={async (result) => {
            setSendOpen(false);
            setSendEstimate(null);
            if (estimate) {
              setEstimate({
                ...estimate,
                status: (result.status as Estimate["status"]) || "sent",
                shareToken: result.token || estimate.shareToken,
              });
            }
            try {
              await updateEstimateV2Opportunity(opportunity.id, {
                status: "estimate_sent",
              });
              setOpportunity({ ...opportunity, status: "estimate_sent" });
            } catch {
              /* backend share also syncs; non-blocking */
            }
            await load({ silent: true });
          }}
        />
      ) : null}

      <Dialog
        open={acceptOpen}
        onOpenChange={(open) => {
          setAcceptOpen(open);
          if (!open) setAcceptStep("choose");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acceptStep === "job"
                ? "Schedule the job"
                : acceptStep === "invoice"
                  ? "Invoice due date"
                  : estimate?.jobId
                    ? "Create invoice"
                    : "What happens next?"}
            </DialogTitle>
            <DialogDescription>
              {acceptStep === "job"
                ? "Set when work starts and when it is due. The job shows on the calendar from start through due."
                : acceptStep === "invoice"
                  ? "Set when this invoice is due. That date is shown on the calendar and to the customer."
                  : estimate?.jobId
                    ? "Bill this work as an invoice from the current job and estimate line items."
                    : "Convert to a job and pick start and due dates, or create an invoice with a due date."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mt-4 flex-col gap-3 border-t-0 pt-4 sm:flex-col sm:justify-stretch">
            {acceptStep === "choose" ? (
              <>
                <Button disabled={saving} onClick={() => setAcceptStep("job")}>
                  Convert to job
                </Button>
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setAcceptStep("invoice")}
                >
                  Create invoice (skip job)
                </Button>
              </>
            ) : null}
            {acceptStep === "job" ? (
              <>
                <div className="grid w-full gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="job-start-at">Start date</Label>
                    <Input
                      id="job-start-at"
                      type="date"
                      value={jobStartAt}
                      onChange={(event) => {
                        const next = event.target.value;
                        setJobStartAt(next);
                        if (jobDueAt && next && jobDueAt < next) setJobDueAt(next);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="job-due-at">Due date</Label>
                    <Input
                      id="job-due-at"
                      type="date"
                      min={jobStartAt || undefined}
                      value={jobDueAt}
                      onChange={(event) => setJobDueAt(event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex w-full gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={saving}
                    onClick={() => setAcceptStep("choose")}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={saving || !jobStartAt || !jobDueAt || jobDueAt < jobStartAt}
                    onClick={() => void handleAcceptance("schedule_later")}
                  >
                    {saving ? "Creating…" : "Create job"}
                  </Button>
                </div>
              </>
            ) : null}
            {acceptStep === "invoice" ? (
              <>
                <div className="w-full space-y-1.5 text-left">
                  <Label htmlFor="invoice-due-at">Due date</Label>
                  <Input
                    id="invoice-due-at"
                    type="date"
                    value={invoiceDueAt}
                    onChange={(event) => setInvoiceDueAt(event.target.value)}
                  />
                </div>
                <div className="flex w-full gap-2">
                  {estimate?.jobId ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={saving}
                      onClick={() => setAcceptStep("choose")}
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    className="flex-1"
                    disabled={saving || !invoiceDueAt}
                    onClick={() => void handleAcceptance("invoice_now")}
                  >
                    {saving ? "Creating…" : "Create invoice"}
                  </Button>
                </div>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalPage>
  );
}
