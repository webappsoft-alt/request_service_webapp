"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
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
  LineItemsEditor,
} from "@/components/portal/line-items-editor";
import { SendApprovalDialog } from "@/components/portal/send-approval-dialog";
import { SiteVisitsPanel } from "@/components/portal/estimate-v2/site-visits-panel";
import { ExistingInformationPanel } from "@/components/portal/estimate-v2/existing-information-panel";
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
  getEstimateV2Opportunity,
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
  updateEstimate,
} from "@/lib/api/crm-client";
import { formatDate, formatMoney } from "@/lib/format";
import type { Estimate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchTaxRatePercent } from "@/lib/tax/state-tax";

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

function customerNameFromOpportunity(opportunity: EstimateV2Opportunity) {
  const c = opportunity.customerId;
  if (!c || typeof c === "string") return "Customer";
  const company = String(c.companyName || "").trim();
  if (company) return company;
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.email || "Customer";
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEstimateV2Opportunity(opportunityId);
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
      if (linked?.id) {
        const fresh = (await getEstimate(linked.id)) || linked;
        setEstimate(fresh);
        setScopeOfWork(fresh.notes || data.description || data.prepFindings || "");
        setTerms(fresh.terms || "Proposal valid for 30 calendar days from issue date.");
        setDiscount(Number(fresh.discount) || 0);
        const fromEstimate = estimateToLines(fresh);
        const estimateHasContent = fromEstimate.some(
          (line) => line.description.trim() && line.description !== "Labour",
        );
        if (estimateHasContent) {
          setLines(fromEstimate);
        } else {
          const fromWork = collectStartingLines(data);
          setLines(fromWork.length ? fromWork : [createEmptyLine("labor")]);
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load estimate.");
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

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
        await createEstimateV2SiteAssessment(opportunity.id, {
          status: "scheduled",
          visitType: "initial_assessment",
          instructions: opportunity.description || opportunity.title,
        });
      }
      await load();
      toast.success("Preparation path updated.");

      if (prepChoice === "create_now") {
        window.setTimeout(() => {
          estimateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      } else if (prepChoice === "have_information") {
        window.setTimeout(() => {
          prepInfoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
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
      toast.success("Existing information saved.");
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
        estimateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not continue to estimate.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEstimateDraft() {
    if (!opportunity) return;
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
      setEstimate(saved || draft);
      toast.success("Estimate draft saved.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save estimate.");
    } finally {
      setSaving(false);
    }
  }

  async function openSendDialog() {
    await saveEstimateDraft();
    let current = estimate;
    if (!current?.id) current = await ensureEstimate();
    if (!current?.id) return;
    try {
      if (current.status === "draft" || current.status === "site_visit" || current.status === "inspected") {
        await finalizeEstimate(current.id, current);
        const refreshed = await getEstimate(current.id);
        setEstimate(refreshed || { ...current, status: "finalized" });
      }
      setSendOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not prepare estimate for send.");
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

  async function handleAcceptance(nextAction: "start_now" | "schedule_later") {
    if (!opportunity || !estimate?.id) return;
    setSaving(true);
    try {
      const result = await resolveEstimateV2Acceptance(opportunity.id, {
        estimateId: estimate.id,
        nextAction,
        markAccepted: estimate.status !== "accepted" && estimate.status !== "converted_to_job",
        signedBy: "Customer (office)",
        title: opportunity.title,
      });
      toast.success(
        nextAction === "start_now"
          ? `${result.job?.number || "Job"} ready to start.`
          : `${result.job?.number || "Job"} created — schedule when ready.`,
      );
      setAcceptOpen(false);
      if (result.job?.id) {
        router.push(`/pro/dashboard/jobs/${result.job.id}`);
        return;
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert estimate.");
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

  return (
    <PortalPage
      eyebrow="Work / Estimate"
      title={`${opportunity.number} · ${opportunity.title}`}
      description={`${customerNameFromOpportunity(opportunity)} · ${propertyLine(opportunity)}`}
      badge={
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-slate-700">
          {opportunity.status.replace(/_/g, " ")}
        </span>
      }
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/pro/dashboard/new-estimate">All estimates</Link>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.55fr)_minmax(0,2.45fr)]">
        {/* Left rail */}
        <section className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-input bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customer & property
            </h2>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {customerNameFromOpportunity(opportunity)}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {propertyLine(opportunity)}
            </p>
          </div>

          <div className="rounded-xl border border-input bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Work request
            </h2>
            {opportunity.categoryName ? (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                {opportunity.categoryName}
              </p>
            ) : null}
            <p className="mt-1 text-sm font-semibold">{opportunity.title}</p>
            {opportunity.description ? (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {opportunity.description}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-input bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              How will this estimate be prepared?
            </h2>
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
                      "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition",
                      selected
                        ? "border-primary bg-primary/8 shadow-[inset_0_0_0_1px_hsl(var(--primary))]"
                        : "border-input hover:border-primary/40 hover:bg-secondary/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background",
                      )}
                    >
                      {selected ? <Check className="size-2.5 stroke-[3]" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-sm", selected ? "font-semibold" : "font-medium")}>
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {option.body}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {(estimate?.status === "sent" ||
            estimate?.status === "finalized" ||
            opportunity.status === "estimate_sent") && (
            <div className="rounded-xl border border-input bg-card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Follow-up
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
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

          {opportunity.activities?.length ? (
            <div className="rounded-xl border border-input bg-card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Activity
              </h2>
              <ol className="relative mt-3 space-y-0 border-l border-input pl-4">
                {[...opportunity.activities]
                  .reverse()
                  .slice(0, 10)
                  .map((item, index) => (
                    <li key={`${item.at}-${index}`} className="relative pb-4 last:pb-0">
                      <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full border-2 border-primary bg-background" />
                      <p className="text-sm font-medium text-foreground">{item.action}</p>
                      {item.details ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.details}</p>
                      ) : null}
                      {item.at ? (
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          {formatDate(item.at)}
                        </p>
                      ) : null}
                    </li>
                  ))}
              </ol>
            </div>
          ) : null}
        </section>

        {/* Main column */}
        <section className="min-w-0 space-y-4">
          {showVisits ? (
            <SiteVisitsPanel
              opportunityId={opportunity.id}
              opportunityTitle={opportunity.title}
              visits={visits}
              employees={employees}
              saving={saving}
              onRefresh={load}
              onSavingChange={setSaving}
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
                onSave={savePrepInfo}
                onContinue={continueToEstimate}
              />
            </div>
          ) : null}

          {/* Estimate builder */}
          <div ref={estimateSectionRef} className="rounded-xl border border-input bg-card p-5">
            {canBuildEstimate ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold">
                      Estimate{estimate?.number ? ` · ${estimate.number}` : ""}
                    </h2>
                    <p className="text-xs capitalize text-muted-foreground">
                      {estimate?.status?.replace(/_/g, " ") || "Ready to build"}
                    </p>
                    {informationSourceLabel ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Information source ·{" "}
                        <span className="font-medium text-foreground">{informationSourceLabel}</span>
                      </p>
                    ) : null}
                  </div>
                  {!estimate ? (
                    <Button size="sm" disabled={saving} onClick={() => void ensureEstimate()}>
                      Build estimate
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="scope">Scope of work</Label>
                    <Textarea
                      id="scope"
                      rows={3}
                      value={scopeOfWork}
                      disabled={estimateLocked}
                      onChange={(e) => setScopeOfWork(e.target.value)}
                      placeholder="Customer-facing description of the work…"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Label>Line items</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Labour, materials, equipment — qty × unit price
                        </p>
                      </div>
                      {!estimateLocked ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLines((prev) => [...prev, createEmptyLine("labor")])}
                          >
                            <Plus className="size-3.5" />
                            Labour
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLines((prev) => [...prev, createEmptyLine("materials")])}
                          >
                            <Plus className="size-3.5" />
                            Material
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLines((prev) => [...prev, createEmptyLine("equipment")])}
                          >
                            <Plus className="size-3.5" />
                            Equipment
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <LineItemsEditor lines={lines} onChange={setLines} locked={estimateLocked} />
                  </div>

                  <div className="overflow-hidden rounded-lg border border-border-soft bg-card">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border-soft bg-[#f7f8fa] px-3 py-2">
                      <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Estimate summary
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
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

                    <div className="grid gap-6 p-4 sm:grid-cols-2">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Labour</span>
                          <span className="font-medium tabular-nums">{formatMoney(mix.labor)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Material</span>
                          <span className="font-medium tabular-nums">{formatMoney(mix.materials)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Equipment</span>
                          <span className="font-medium tabular-nums">{formatMoney(mix.equipment)}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm sm:border-l sm:border-border-soft sm:pl-6">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="tabular-nums">{formatMoney(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <Label htmlFor="discount" className="text-muted-foreground">
                            Discount
                          </Label>
                          <div className="relative w-24">
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2 text-xs text-muted-foreground"
                            >
                              $
                            </span>
                            <Input
                              id="discount"
                              className="h-8 border-border-soft bg-[#fafbfc] pl-4 pr-1 text-right text-xs tabular-nums shadow-none"
                              type="number"
                              min={0}
                              step="0.01"
                              value={discount}
                              disabled={estimateLocked}
                              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-muted-foreground">
                          <span>Tax ({taxRatePercent}%)</span>
                          <span className="tabular-nums">{formatMoney(taxAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t border-border-soft pt-2 text-base font-semibold">
                          <span>Total</span>
                          <span className="tabular-nums">{formatMoney(grandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border-soft px-3 py-3">
                      <Label htmlFor="terms" className="text-[11px] text-muted-foreground">
                        Terms
                      </Label>
                      <Input
                        id="terms"
                        className="mt-1 h-8 border-border-soft bg-[#fafbfc] shadow-none"
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
                    <div className="rounded-lg border border-dashed border-input px-4 py-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Supporting information
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
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
                      <p className="mt-1 text-xs text-muted-foreground">
                        Measurements stay informational. Work items seed the line items above — edit freely.
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
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
                      disabled={saving || estimateLocked}
                      onClick={() => void openSendDialog()}
                    >
                      Preview & send
                    </Button>
                    {(estimate?.status === "sent" ||
                      estimate?.status === "accepted" ||
                      estimate?.status === "finalized") &&
                    estimate?.status !== "converted_to_job" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={saving}
                        onClick={() => setAcceptOpen(true)}
                      >
                        Customer accepted…
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold">Estimate</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose <span className="font-medium text-foreground">Create estimate now</span> or{" "}
                  <span className="font-medium text-foreground">I already have the information</span>
                  , or complete a site visit first.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
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
        </section>
      </div>

      {estimate ? (
        <SendApprovalDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          estimate={estimate}
          customerLabel={customerNameFromOpportunity(opportunity)}
          onSent={async () => {
            toast.success("Estimate sent to customer.");
            setSendOpen(false);
            try {
              await updateEstimateV2Opportunity(opportunity.id, {
                status: "estimate_sent",
              });
            } catch {
              /* non-blocking */
            }
            await load();
          }}
        />
      ) : null}

      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What happens next?</DialogTitle>
            <DialogDescription>
              Customer accepted the estimate. Start work now, or create the job and schedule it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button disabled={saving} onClick={() => void handleAcceptance("start_now")}>
              Start work now
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => void handleAcceptance("schedule_later")}
            >
              Schedule work later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalPage>
  );
}
