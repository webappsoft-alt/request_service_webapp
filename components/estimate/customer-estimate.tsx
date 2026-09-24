"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileQuestion,
  FileText,
  Maximize2,
  Printer,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { customerPaths } from "@/lib/customer-paths";
import { toast } from "sonner";
import {
  EstimatePdfDocument,
  SignaturePadField,
  typedSignature,
  useSignPad,
} from "@/components/estimate/estimate-pdf";
import {
  useEstimateShare,
  type EstimateApproval,
  type EstimateShareSnapshot,
  type EstimateShareSiteVisit,
  type EstimateSiteVisitPhoto,
} from "@/components/portal/use-estimate-share";
import {
  extractErrorMessage,
  getData,
  postData,
  showApiErrorToast,
} from "@/components/api/apiFuntions";
import { publicApi, userApi } from "@/components/api/ApiRoutesFile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  forgetCustomerEstimateToken,
  rememberCustomerEstimateToken,
} from "@/lib/booking/customer-estimates-store";
import { formatDate, formatMoney } from "@/lib/format";
import { useAppDispatch } from "@/store/hooks";
import {
  fetchCustomerEstimates,
  fetchCustomerQuoteRequests,
} from "@/store/customerQuotesSlice";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toSiteVisitPhoto(
  entry: unknown,
  idx: number,
  idPrefix: string,
): EstimateSiteVisitPhoto | null {
  if (typeof entry === "string" && entry.trim()) {
    return {
      id: `${idPrefix}${idx + 1}`,
      name: `Photo ${idx + 1}`,
      url: entry.trim(),
      type: "image/jpeg",
    };
  }
  const record = asRecord(entry);
  if (!record) return null;
  const url = stringValue(record.url) || stringValue(record.dataUrl);
  if (!url) return null;
  return {
    id: stringValue(record.id) || `${idPrefix}${idx + 1}`,
    name: stringValue(record.name) || `Photo ${idx + 1}`,
    url,
    type: stringValue(record.type) || "image/jpeg",
    size: numberValue(record.size),
    addedAt: stringValue(record.addedAt),
    actor: stringValue(record.actor),
  };
}

function isImageAttachment(entry: unknown): boolean {
  if (typeof entry === "string" && entry.trim()) {
    const lower = entry.toLowerCase();
    return (
      Boolean(lower.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/)) ||
      lower.startsWith("data:image/")
    );
  }
  const record = asRecord(entry);
  if (!record) return false;
  const url = stringValue(record.url) || stringValue(record.dataUrl);
  const type = stringValue(record.type);
  return Boolean(
    type.startsWith("image/") ||
      url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i) ||
      url.startsWith("data:image/"),
  );
}

function toIso(value: unknown): string {
  const raw = stringValue(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function mapPublicEstimateToSnapshot(
  token: string,
  raw: unknown,
): { snapshot: EstimateShareSnapshot; approval?: EstimateApproval } | null {
  const root = asRecord(raw);
  if (!root) return null;
  if ("success" in root && root.success === false) return null;

  const estimate = asRecord(root?.data) ?? root;
  if (!estimate) return null;
  if ("success" in estimate && estimate.success === false) return null;

  const provider =
    asRecord(estimate.providerId) ?? asRecord(estimate.provider) ?? {};
  const location = asRecord(provider.location) ?? {};
  const snapshotCustomer =
    asRecord(estimate.customerSnapshot) ??
    asRecord(estimate.customerId) ??
    asRecord(estimate.customer) ??
    {};
  const address =
    asRecord(estimate.propertyAddress) ??
    asRecord(snapshotCustomer.address) ??
    asRecord(estimate.address) ??
    (Array.isArray(snapshotCustomer.addresses)
      ? asRecord(snapshotCustomer.addresses[0])
      : null) ??
    {};

  const companySignature =
    asRecord(estimate.companySignature) ??
    asRecord(estimate.providerSignature) ??
    asRecord(estimate.companyApproval);
  const approvalRaw = asRecord(estimate.approval);
  const estimateId =
    stringValue(estimate.id) ||
    stringValue(estimate._id) ||
    stringValue((asRecord(estimate._id) as { $oid?: string } | null)?.$oid) ||
    (isMongoObjectId(token) ? token.trim() : "");

  if (!estimateId) return null;

  const items = (Array.isArray(estimate.items) ? estimate.items : []).map(
    (entry) => {
      const item = asRecord(entry) ?? {};
      const kindRaw = stringValue(item.kind || item.type).toLowerCase();
      const quantity = Math.max(0, numberValue(item.quantity, 1));
      const unitPrice = numberValue(item.unitPrice);
      return {
        description: stringValue(item.description) || "Line item",
        kind: (kindRaw === "material" || kindRaw === "materials"
          ? "materials"
          : "labor") as "labor" | "materials",
        quantity,
        unit: stringValue(item.unit) || (kindRaw === "labor" ? "hr" : "ea"),
        unitPrice,
        total: numberValue(item.total, Math.round(quantity * unitPrice)),
      };
    },
  );

  const companySignedBy =
    stringValue(companySignature?.signedBy) ||
    stringValue(estimate.companySignedBy) ||
    stringValue(provider.companyName);
  const companySignedAt =
    toIso(companySignature?.signedAt) || toIso(estimate.companySignedAt);
  const companySignatureDataUrl =
    stringValue(companySignature?.signatureImageBase64) ||
    stringValue(companySignature?.imageBase64) ||
    stringValue(companySignature?.signature) ||
    stringValue(estimate.companySignatureDataUrl);

  const siteVisitRaw = asRecord(estimate.siteVisit);
  let siteVisit: EstimateShareSiteVisit | undefined = undefined;
  if (siteVisitRaw) {
    const rawPhotos = Array.isArray(siteVisitRaw.photos)
      ? siteVisitRaw.photos
      : [];
    const photos = rawPhotos
      .map((entry, idx) => toSiteVisitPhoto(entry, idx, "photo_"))
      .filter((item): item is EstimateSiteVisitPhoto => item !== null);

    const technician = stringValue(siteVisitRaw.technician);
    const visitedAt = stringValue(siteVisitRaw.visitedAt);
    const accessNotes = stringValue(siteVisitRaw.accessNotes);
    const findings = stringValue(siteVisitRaw.findings);
    const recommendations = stringValue(siteVisitRaw.recommendations);
    const measurements = stringValue(siteVisitRaw.measurements);
    const employeeId = stringValue(siteVisitRaw.employeeId);

    const hasText =
      Boolean(technician) ||
      Boolean(visitedAt) ||
      Boolean(accessNotes) ||
      Boolean(findings) ||
      Boolean(recommendations) ||
      Boolean(measurements);

    if (hasText || photos.length > 0) {
      siteVisit = {
        employeeId: employeeId || undefined,
        technician: technician || undefined,
        visitedAt: visitedAt || undefined,
        accessNotes: accessNotes || undefined,
        findings: findings || undefined,
        recommendations: recommendations || undefined,
        measurements: measurements || undefined,
        photos,
      };
    }
  }

  // Fallback: check attachments if siteVisit photos are empty
  if (
    Array.isArray(estimate.attachments) &&
    (!siteVisit || siteVisit.photos.length === 0)
  ) {
    const attachmentPhotos = estimate.attachments
      .map((entry, idx) =>
        isImageAttachment(entry) ? toSiteVisitPhoto(entry, idx, "attach_") : null,
      )
      .filter((item): item is EstimateSiteVisitPhoto => item !== null);

    if (attachmentPhotos.length > 0) {
      siteVisit = siteVisit
        ? { ...siteVisit, photos: attachmentPhotos }
        : { photos: attachmentPhotos };
    }
  }

  const snapshot: EstimateShareSnapshot = {
    token,
    estimateId,
    number:
      stringValue(estimate.number) ||
      `EST-${estimateId.slice(-4).toUpperCase()}`,
    companyName: stringValue(provider.companyName) || "Service company",
    companyEmail: stringValue(provider.email),
    companyPhone: stringValue(provider.phone),
    companyStreet: stringValue(location.address),
    companyCity: stringValue(location.city),
    companyState: stringValue(location.state),
    companyZip: stringValue(location.zip),
    licensed: Boolean(
      asRecord(provider.profile)?.licensed ?? provider.licensed,
    ),
    insured: Boolean(asRecord(provider.profile)?.insured ?? provider.insured),
    customerName:
      [
        stringValue(snapshotCustomer.firstName),
        stringValue(snapshotCustomer.lastName),
      ]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      stringValue(snapshotCustomer.companyName) ||
      stringValue(estimate.customerName) ||
      "Customer",
    customerEmail:
      stringValue(snapshotCustomer.email) ||
      stringValue(estimate.customerEmail) ||
      undefined,
    customerPhone:
      stringValue(snapshotCustomer.phone) ||
      stringValue(estimate.customerPhone) ||
      undefined,
    street: stringValue(address.street),
    city: stringValue(address.city),
    state: stringValue(address.state),
    zip: stringValue(address.zip),
    issuedAt:
      toIso(estimate.issuedAt) ||
      toIso(estimate.createdAt) ||
      new Date().toISOString(),
    expiresAt: toIso(estimate.expiresAt) || undefined,
    notes: stringValue(estimate.notes) || undefined,
    terms: stringValue(estimate.terms) || undefined,
    items,
    subtotal: numberValue(estimate.subtotal),
    tax: numberValue(estimate.tax),
    total: numberValue(estimate.total),
    createdAt: toIso(estimate.createdAt) || new Date().toISOString(),
    status: stringValue(estimate.status) || undefined,
    companySignedBy: companySignedBy || undefined,
    companySignedAt: companySignedAt || undefined,
    companySignatureDataUrl: companySignatureDataUrl || undefined,
    siteVisit,
  };

  const signedAt =
    toIso(approvalRaw?.signedAt) || toIso(approvalRaw?.approvedAt);
  const signedBy =
    stringValue(approvalRaw?.signedBy) || stringValue(approvalRaw?.name);
  const approvalImage =
    stringValue(approvalRaw?.signatureImageBase64) ||
    stringValue(approvalRaw?.signature);

  const approval =
    signedAt || signedBy || stringValue(estimate.status) === "accepted"
      ? {
          estimateId,
          signedBy: signedBy || snapshot.customerName,
          signedAt: signedAt || new Date().toISOString(),
          signatureDataUrl: approvalImage,
        }
      : undefined;

  return { snapshot, approval };
}

function isMongoObjectId(value: string) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());
}

function canCustomerSignStatus(status?: string) {
  const value = String(status || "").toLowerCase();
  // Customer may accept once a proposal exists (draft/finalized/sent).
  // Site-visit / inspected still wait for the pro to finalize & send.
  return value === "sent" || value === "finalized" || value === "draft";
}

export function CustomerEstimatePage({
  token,
  estimateId: estimateIdProp,
  embedded = false,
}: {
  token?: string;
  /** Authenticated CRM estimate id (preferred over public share token). */
  estimateId?: string;
  /** When true, renders inside dashboard portal shell without page wrapper */
  embedded?: boolean;
}) {
  const dispatch = useAppDispatch();
  const share = useEstimateShare();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<EstimateShareSnapshot | null>(null);
  const [approval, setApproval] = useState<EstimateApproval | undefined>(
    undefined,
  );
  const [rejecting, setRejecting] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [accessKey, setAccessKey] = useState(
    () => String(token || estimateIdProp || "").trim(),
  );
  const [viaUserApi, setViaUserApi] = useState(() =>
    Boolean(estimateIdProp || isMongoObjectId(String(token || ""))),
  );
  const [wantAccept] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("accept") === "1";
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const explicitId = String(estimateIdProp || "").trim();
    const key = String(token || "").trim();
    const useUserApi = Boolean(explicitId) || isMongoObjectId(key);
    const lookupId = explicitId || (isMongoObjectId(key) ? key : "");
    const publicToken = !useUserApi ? key : "";

    if (!lookupId && !publicToken) {
      setError("Estimate link is missing or invalid.");
      setSnapshot(null);
      setApproval(undefined);
      setLoading(false);
      return;
    }

    setViaUserApi(useUserApi);

    try {
      const response = useUserApi
        ? await getData(userApi.estimate(lookupId), undefined, {
            silent: true,
            force: true,
          })
        : await getData(publicApi.estimate(publicToken), undefined, {
            token: null,
            skipLogoutOn401: true,
            silent: true,
            force: true,
          });

      const root = asRecord(response);
      if (root && root.success === false) {
        if (!useUserApi) forgetCustomerEstimateToken(publicToken);
        setError(
          stringValue(root.message) ||
            "Estimate proposal not found or link has expired",
        );
        setSnapshot(null);
        setApproval(undefined);
        setLoading(false);
        return;
      }

      const estimate = asRecord(root?.data) ?? root;
      const shareToken =
        stringValue(estimate?.shareToken) || (useUserApi ? "" : publicToken);
      const mapKey = shareToken || lookupId || publicToken;
      const mapped = mapPublicEstimateToSnapshot(mapKey, {
        success: true,
        data: estimate,
      });
      if (mapped) {
        // Prefer CRM id when viewing via authenticated API so approve/reject
        // hit /user/estimates/:id even if a share token also exists.
        if (useUserApi && lookupId) {
          mapped.snapshot.estimateId = lookupId;
        }
        if (shareToken) rememberCustomerEstimateToken(shareToken);
        setAccessKey(
          useUserApi
            ? lookupId
            : shareToken || mapped.snapshot.estimateId || publicToken,
        );
        setSnapshot(mapped.snapshot);
        setApproval(
          mapped.approval || share.approvalOf(mapped.snapshot.estimateId),
        );
        setLoading(false);
        return;
      }

      if (!useUserApi) forgetCustomerEstimateToken(publicToken);
      setError("Estimate proposal not found or link has expired");
      setSnapshot(null);
      setApproval(undefined);
      setLoading(false);
    } catch (err) {
      if (!useUserApi && publicToken) forgetCustomerEstimateToken(publicToken);
      const message = extractErrorMessage(err);
      setError(message || "Estimate proposal not found or link has expired");
      setSnapshot(null);
      setApproval(undefined);
      setLoading(false);
    }
  }, [token, estimateIdProp, share]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const estimateId = snapshot?.estimateId || String(estimateIdProp || "").trim();
  const canSign = Boolean(
    snapshot && !approval && canCustomerSignStatus(snapshot.status),
  );
  const canRequestChanges = Boolean(
    snapshot && !approval && canCustomerSignStatus(snapshot.status),
  );
  const preparing =
    Boolean(snapshot) &&
    !approval &&
    !canCustomerSignStatus(snapshot?.status) &&
    snapshot?.status !== "rejected" &&
    snapshot?.status !== "expired" &&
    snapshot?.status !== "accepted" &&
    snapshot?.status !== "converted_to_job";
  const hasSiteVisit = Boolean(
    snapshot?.siteVisit &&
      (snapshot.siteVisit.photos.length > 0 ||
        snapshot.siteVisit.findings ||
        snapshot.siteVisit.technician ||
        snapshot.siteVisit.accessNotes ||
        snapshot.siteVisit.recommendations ||
        snapshot.siteVisit.measurements ||
        snapshot.status === "inspected"),
  );

  useEffect(() => {
    if (!wantAccept || !canSign || loading) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById("customer-accept-sign")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [wantAccept, canSign, loading]);

  async function approve(signedBy: string, signatureImageBase64: string) {
    if (!snapshot) return;
    try {
      if (viaUserApi && estimateId) {
        await postData(userApi.estimateApprove(estimateId), {
          signedBy,
          signatureImageBase64,
        });
      } else {
        await postData(
          publicApi.estimateApprove(accessKey),
          { signedBy, signatureImageBase64 },
          { token: null, skipLogoutOn401: true },
        );
      }
    } catch (err) {
      showApiErrorToast(err, "Unable to approve this estimate.");
      return;
    }

    const nextApproval: EstimateApproval = {
      estimateId: snapshot.estimateId,
      signedBy,
      signedAt: new Date().toISOString(),
      signatureDataUrl: signatureImageBase64,
    };
    share.approve(snapshot, signedBy, signatureImageBase64);
    setApproval(nextApproval);
    toast.success(
      "Estimate signed and approved! Other estimates for this request were declined. The company has been notified.",
    );
    void dispatch(fetchCustomerQuoteRequests());
    void dispatch(fetchCustomerEstimates());
    void load();
  }

  async function rejectEstimate() {
    if (!snapshot || rejecting) return;
    const confirmed = window.confirm(
      "Decline this estimate? The professional will be notified.",
    );
    if (!confirmed) return;
    setRejecting(true);
    try {
      if (viaUserApi && estimateId) {
        await postData(userApi.estimateReject(estimateId), {
          reason: "Customer declined this estimate.",
        });
      } else {
        await postData(
          publicApi.estimateReject(accessKey),
          { reason: "Customer declined this estimate." },
          { token: null, skipLogoutOn401: true },
        );
      }
      toast.success("Estimate declined.");
      void load();
    } catch (err) {
      showApiErrorToast(err, "Unable to decline this estimate.");
    } finally {
      setRejecting(false);
    }
  }

  async function submitChangeRequest() {
    if (!snapshot || requestingChanges) return;
    const reason = changeReason.trim();
    if (reason.length < 3) {
      toast.error("Please describe what needs to be changed.");
      return;
    }
    setRequestingChanges(true);
    try {
      if (viaUserApi && estimateId) {
        await postData(userApi.estimateRequestChanges(estimateId), { reason });
      } else {
        await postData(
          publicApi.estimateRequestChanges(accessKey),
          { reason },
          { token: null, skipLogoutOn401: true },
        );
      }
      toast.success("Change request sent to the professional.");
      setShowChangeForm(false);
      setChangeReason("");
      void load();
    } catch (err) {
      showApiErrorToast(err, "Unable to request changes.");
    } finally {
      setRequestingChanges(false);
    }
  }

  if (loading) {
    return <EstimateDocumentSkeleton embedded={embedded} />;
  }

  if (!snapshot) {
    const isTimeout =
      Boolean(error) &&
      (error?.toLowerCase().includes("timeout") ||
        error?.toLowerCase().includes("network") ||
        error?.toLowerCase().includes("econnrefused") ||
        error?.toLowerCase().includes("exceeded"));

    const emptyCard = (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 sm:p-10 text-center shadow-xs">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/60 text-muted-foreground shadow-2xs">
          <FileQuestion className="size-7 text-primary/80" />
        </div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          {isTimeout ? "Unable to load estimate" : "Estimate proposal not found"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {isTimeout
            ? "The request took longer than expected to respond. Please check your connection or try again."
            : "The estimate proposal link may have expired, been updated, or is no longer accessible."}
        </p>

        {error ? (
          <div className="mx-auto mt-3.5 inline-flex max-w-md items-center gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0 text-amber-600" />
            <span className="truncate font-mono">{error}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => void load()}
            size="sm"
            className="gap-1.5 font-medium"
          >
            <RotateCcw className="size-3.5" />
            Try again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.estimates}>
              <ArrowLeft className="size-3.5" />
              All estimates
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={customerPaths.requests}>
              Quote requests
            </Link>
          </Button>
        </div>

        <div className="mt-8 border-t border-border/70 pt-5 text-xs text-muted-foreground">
          <p>
            Need help? Reach out to your provider via{" "}
            <Link
              href={customerPaths.messages}
              className="font-medium text-primary hover:underline"
            >
              Messages
            </Link>{" "}
            or check your quote requests.
          </p>
        </div>
      </div>
    );

    if (embedded) {
      return <div className="w-full py-4 sm:py-8">{emptyCard}</div>;
    }

    return (
      <main
        id="main-content"
        className="flex min-h-svh items-center justify-center bg-muted/20 px-4 py-16"
      >
        {emptyCard}
      </main>
    );
  }

  const documentContent = (
    <div className="mx-auto w-full max-w-[8.5in] space-y-4 print:max-w-none print:space-y-0 print:p-0 print:m-0">
      {/* Top bar with quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs print:hidden">
        <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {snapshot.companyName}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">
              {snapshot.number}
            </span>
            {approval ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="size-3.5" /> Approved
              </span>
            ) : snapshot.status === "rejected" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                Rejected
              </span>
            ) : snapshot.status === "changes_requested" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Changes requested
              </span>
            ) : snapshot.status === "inspected" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                <ShieldCheck className="size-3.5" /> Site Inspected
              </span>
            ) : preparing ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                In progress
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <ShieldCheck className="size-3.5" /> Ready for review
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasSiteVisit && (snapshot.siteVisit?.photos?.length ?? 0) > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  document
                    .getElementById("site-inspection-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="gap-1.5"
              >
                <Camera className="size-3.5 text-primary" />
                <span>Photos ({snapshot.siteVisit?.photos.length})</span>
              </Button>
            ) : null}
            {canSign ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  document
                    .getElementById("customer-accept-sign")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                Accept
              </Button>
            ) : null}
            {canRequestChanges ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rejecting || requestingChanges}
                  onClick={() => setShowChangeForm((open) => !open)}
                >
                  Request changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rejecting || requestingChanges}
                  onClick={() => void rejectEstimate()}
                >
                  {rejecting ? "Declining…" : "Decline estimate"}
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Printer className="size-4" />
              <span>Print / PDF</span>
            </Button>
          </div>
        </div>

        {hasSiteVisit ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs sm:text-sm text-sky-950 shadow-2xs print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <Camera className="size-4" />
              </div>
              <div>
                <span className="font-semibold text-sky-900">
                  {snapshot.status === "inspected"
                    ? "Site Inspection Completed"
                    : "Site Inspection Report Attached"}
                </span>
                {snapshot.siteVisit?.technician ? (
                  <span className="text-sky-800">
                    {" "}
                    · Inspected by {snapshot.siteVisit.technician}
                  </span>
                ) : null}
                {snapshot.siteVisit?.visitedAt ? (
                  <span className="text-sky-700">
                    {" "}
                    on {formatDate(snapshot.siteVisit.visitedAt)}
                  </span>
                ) : null}
                {(snapshot.siteVisit?.photos?.length ?? 0) > 0 ? (
                  <span className="text-sky-700">
                    {" "}
                    ({snapshot.siteVisit?.photos.length}{" "}
                    {snapshot.siteVisit?.photos.length === 1
                      ? "photo"
                      : "photos"}
                    )
                  </span>
                ) : null}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-sky-300 bg-white text-xs font-medium text-sky-900 hover:bg-sky-50 hover:text-sky-950"
              onClick={() => {
                document
                  .getElementById("site-inspection-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              View report &amp; photos ↓
            </Button>
          </div>
        ) : null}

        {preparing && snapshot.status !== "inspected" ? (
          <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 print:hidden">
            Your professional is still preparing this estimate
            {snapshot.status === "site_visit"
              ? " (site visit in progress)"
              : ""}
            . You can review the current draft here.{" "}
            <strong>Review &amp; accept</strong>, request changes, and sign will
            unlock after they send it for your approval.
          </div>
        ) : null}

        {snapshot.status === "rejected" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950 print:hidden">
            This estimate was rejected because another proposal for the same
            request was accepted. No further action is available on this
            estimate.
          </div>
        ) : null}

        {showChangeForm && canRequestChanges ? (
          <div className="rounded-md border border-black/10 bg-card p-4 print:hidden">
            <p className="text-sm font-medium">What should be changed?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The professional will update this same estimate and send it back
              for your review.
            </p>
            <textarea
              className="mt-3 w-full min-h-24 rounded-md border border-black/15 bg-background px-3 py-2 text-sm"
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              placeholder="Example: Please reduce labor hours and add materials for the kitchen repair."
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={requestingChanges || changeReason.trim().length < 3}
                onClick={() => void submitChangeRequest()}
              >
                {requestingChanges ? "Sending…" : "Send change request"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={requestingChanges}
                onClick={() => {
                  setShowChangeForm(false);
                  setChangeReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {snapshot.status === "changes_requested" ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 print:hidden">
            Your change request was sent. Waiting for the professional to revise
            and re-share this estimate.
          </div>
        ) : null}

        {/* If status is inspected or site_visit, show the inspection section first */}
        {snapshot.status === "inspected" || snapshot.status === "site_visit" ? (
          <CustomerSiteInspectionSection
            siteVisit={snapshot.siteVisit}
            status={snapshot.status}
          />
        ) : null}

        {/* 2-page document preview with signature field on page 2 */}
        <EstimatePdfDocument
          snapshot={snapshot}
          approval={approval}
          customerSlot={
            canSign ? (
              <CustomerSignSlot snapshot={snapshot} onSign={approve} />
            ) : undefined
          }
        />

        {/* If status is not inspected / site_visit, show the inspection section after the proposal document */}
        {snapshot.status !== "inspected" && snapshot.status !== "site_visit" ? (
          <CustomerSiteInspectionSection
            siteVisit={snapshot.siteVisit}
            status={snapshot.status}
          />
        ) : null}

        {approval ? (
          <div className="mx-auto flex max-w-[8.5in] items-center gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 print:hidden">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-emerald-900">
                Signed & Approved
              </span>{" "}
              by {approval.signedBy} on{" "}
              {formatDate(approval.signedAt.slice(0, 10))}. The service company
              has received your approval and can proceed with scheduling.
            </div>
          </div>
        ) : null}
      </div>
  );

  if (embedded) {
    return <div className="w-full space-y-4 print:space-y-0">{documentContent}</div>;
  }

  return (
    <main
      id="main-content"
      className="min-h-svh bg-muted/20 px-4 py-6 sm:py-10 print:min-h-0 print:bg-white print:p-0 print:m-0"
    >
      {documentContent}
    </main>
  );
}

function CustomerSignSlot({
  snapshot,
  onSign,
}: {
  snapshot: EstimateShareSnapshot;
  onSign: (name: string, image: string) => void | Promise<void>;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pad = useSignPad();

  return (
    <div id="customer-accept-sign" className="scroll-mt-24 space-y-3">
      <div>
        <p className="text-sm font-semibold text-[#003F7D]">
          Accept this estimate
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign below to accept this proposal. Other estimates for the same
          request will be rejected automatically.
        </p>
      </div>
      <SignaturePadField
        name={snapshot.customerName}
        pad={pad}
        showNameInput={false}
        caption="Customer signs to approve this estimate"
      />
      <div>
        <label className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-foreground cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-black/20"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          <span>
            I have read pages 1 and 2 and authorize{" "}
            <strong>{snapshot.companyName}</strong> to proceed for{" "}
            <strong>{formatMoney(snapshot.total)}</strong>.
          </span>
        </label>
        <div className="print:hidden">
          <Button
            className="mt-3 w-full sm:w-auto"
            size="sm"
            disabled={!agreed || busy}
            onClick={() => {
              const image = pad.dirty
                ? pad.toImage()
                : typedSignature(snapshot.customerName);
              if (!image) {
                toast.error("Please provide a signature.");
                return;
              }
              setBusy(true);
              void Promise.resolve(
                onSign(snapshot.customerName, image),
              ).finally(() => setBusy(false));
            }}
          >
            {busy ? "Accepting…" : `Accept ${snapshot.number}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerSiteInspectionSection({
  siteVisit,
  status,
}: {
  siteVisit?: EstimateShareSiteVisit;
  status?: string;
}) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const photos = siteVisit?.photos || [];
  const hasPhotos = photos.length > 0;
  const isInspected = status === "inspected" || status === "site_visit";
  const hasDetails = Boolean(
    siteVisit?.technician ||
      siteVisit?.visitedAt ||
      siteVisit?.accessNotes ||
      siteVisit?.findings ||
      siteVisit?.recommendations ||
      siteVisit?.measurements,
  );

  useEffect(() => {
    if (selectedPhotoIndex === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedPhotoIndex(null);
      } else if (event.key === "ArrowLeft") {
        setSelectedPhotoIndex((prev) =>
          prev !== null ? (prev - 1 + photos.length) % photos.length : 0,
        );
      } else if (event.key === "ArrowRight") {
        setSelectedPhotoIndex((prev) =>
          prev !== null ? (prev + 1) % photos.length : 0,
        );
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhotoIndex, photos.length]);

  if (!siteVisit && !isInspected) return null;
  if (!hasPhotos && !hasDetails && !isInspected) return null;

  return (
    <>
      <section
        id="site-inspection-section"
        className="scroll-mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-xs print:m-0 print:break-before-page print:border-black/15 print:p-0 print:shadow-none"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4 sm:px-6 print:border-black/10 print:bg-transparent">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Camera className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Site Inspection &amp; Field Report
                </h2>
                {status === "inspected" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    <CheckCircle2 className="size-3 text-blue-600" /> Inspected
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                On-site observations, measurements, and photo documentation recorded by your professional.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {siteVisit?.technician ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-medium text-foreground">
                <User className="size-3.5 text-muted-foreground" />
                <span>{siteVisit.technician}</span>
              </span>
            ) : null}
            {siteVisit?.visitedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-medium text-foreground">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>{formatDate(siteVisit.visitedAt)}</span>
              </span>
            ) : null}
            {hasPhotos ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1 font-semibold text-primary">
                <Camera className="size-3.5" />
                <span>
                  {photos.length} {photos.length === 1 ? "photo" : "photos"}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {/* Notes & details */}
          {hasDetails ? (
            <div className="grid gap-3.5 sm:grid-cols-2">
              {siteVisit?.findings ? (
                <div className="rounded-lg border border-border bg-muted/20 p-4 sm:col-span-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                    <FileText className="size-3.5 text-primary" />
                    <span>Inspection Findings</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {siteVisit.findings}
                  </p>
                </div>
              ) : null}

              {siteVisit?.recommendations ? (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                    <Sparkles className="size-3.5 text-amber-600" />
                    <span>Recommended Work</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {siteVisit.recommendations}
                  </p>
                </div>
              ) : null}

              {siteVisit?.measurements ? (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                    <Ruler className="size-3.5 text-emerald-600" />
                    <span>Measurements &amp; Details</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {siteVisit.measurements}
                  </p>
                </div>
              ) : null}

              {siteVisit?.accessNotes ? (
                <div className="rounded-lg border border-border bg-muted/20 p-4 sm:col-span-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    <span>Access &amp; Site Notes</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {siteVisit.accessNotes}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Photo gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Inspection Photos
                </h3>
                {hasPhotos ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {photos.length}
                  </span>
                ) : null}
              </div>
              {hasPhotos ? (
                <span className="hidden text-xs text-muted-foreground sm:inline print:hidden">
                  Click any photo to enlarge
                </span>
              ) : null}
            </div>

            {hasPhotos ? (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id || index}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-md print:cursor-default print:border-black/15 print:shadow-none"
                  >
                    <div className="relative aspect-4/3 w-full overflow-hidden bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.name || `Site photo ${index + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 print:transform-none"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 print:hidden">
                        <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-xs">
                          <Maximize2 className="size-3.5" />
                          Enlarge
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border bg-card p-2.5 print:border-black/10">
                      <p className="truncate text-xs font-medium text-foreground">
                        {photo.name || `Photo ${index + 1}`}
                      </p>
                      {photo.size ? (
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {photo.size > 1024 * 1024
                            ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB`
                            : `${Math.round(photo.size / 1024)} KB`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No inspection photos attached.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Fullscreen Lightbox Modal */}
      {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 sm:p-6 backdrop-blur-md transition-opacity animate-in fade-in-0 duration-150 print:hidden"
              onClick={() => setSelectedPhotoIndex(null)}
              role="dialog"
              aria-modal="true"
            >
              {/* Top controls */}
              <div
                className="absolute inset-x-4 top-4 z-10 flex items-center justify-between text-white sm:inset-x-6 sm:top-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium tracking-wide">
                    {selectedPhotoIndex + 1} of {photos.length}
                  </span>
                  <span className="max-w-xs truncate text-xs text-white/80 sm:max-w-md">
                    {photos[selectedPhotoIndex].name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={photos[selectedPhotoIndex].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                    title="Open full image in new tab"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoIndex(null)}
                    className="cursor-pointer rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                    aria-label="Close"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              {/* Prev button */}
              {photos.length > 1 && (
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPhotoIndex((prev) =>
                      prev !== null
                        ? (prev - 1 + photos.length) % photos.length
                        : 0,
                    );
                  }}
                  className="absolute left-3 z-10 cursor-pointer rounded-full bg-white/15 p-2.5 text-white transition-colors hover:bg-white/30 sm:left-6"
                >
                  <ChevronLeft className="size-6" />
                </button>
              )}

              {/* Image */}
              <div
                className="relative flex max-h-[85vh] max-w-[92vw] select-none items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[selectedPhotoIndex].url}
                  alt={photos[selectedPhotoIndex].name}
                  className="max-h-[82vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
                />
              </div>

              {/* Next button */}
              {photos.length > 1 && (
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPhotoIndex((prev) =>
                      prev !== null ? (prev + 1) % photos.length : 0,
                    );
                  }}
                  className="absolute right-3 z-10 cursor-pointer rounded-full bg-white/15 p-2.5 text-white transition-colors hover:bg-white/30 sm:right-6"
                >
                  <ChevronRight className="size-6" />
                </button>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function EstimateDocument({
  snapshot,
}: {
  snapshot: EstimateShareSnapshot;
}) {
  return <EstimatePdfDocument snapshot={snapshot} />;
}

export function EstimateDocumentSkeleton({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const content = (
    <div className="mx-auto w-full max-w-[8.5in] space-y-4">
      {/* Top bar skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <span className="text-muted-foreground">·</span>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>

        {/* Page 1 Skeleton */}
        <article className="mx-auto w-full max-w-204 overflow-hidden rounded-xs border border-black/15 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <div className="min-h-[10.4in] px-8 py-7">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-14 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                <Skeleton className="ml-auto h-3 w-16" />
                <Skeleton className="ml-auto h-6 w-24" />
                <Skeleton className="ml-auto h-3 w-20" />
              </div>
            </div>

            {/* Prepared by / Customer */}
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>

            {/* Meta bar */}
            <div className="mt-6 grid grid-cols-3 gap-3 border border-black/10 bg-[#f8fafc] px-3 py-2.5">
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>

            {/* Work details table */}
            <div className="mt-6 space-y-2">
              <Skeleton className="h-3 w-24" />
              <div className="overflow-hidden rounded-[2px] border border-black/10">
                <div className="flex h-8 items-center justify-between bg-[#e8eef5] px-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="divide-y divide-black/8 bg-white">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex h-10 items-center justify-between px-2"
                    >
                      <Skeleton className="h-3.5 w-44" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subtotal */}
            <div className="mt-4 ml-auto w-56 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex justify-between border-t border-black/10 pt-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
          <footer className="flex items-center justify-between border-t border-black/10 bg-[#f8fafc] px-8 py-2">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-16" />
          </footer>
        </article>

        {/* Page 2 Skeleton */}
        <article className="mx-auto w-full max-w-[8.5in] overflow-hidden rounded-[2px] border border-black/15 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <div className="min-h-[10.4in] space-y-6 px-8 py-7">
            {/* Header compact */}
            <div className="flex items-start justify-between border-b border-black/10 pb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-[4px]" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Terms and conditions */}
            <div className="space-y-3">
              <Skeleton className="h-3 w-36" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>

            {/* Signatures */}
            <div className="mt-8 grid gap-6 pt-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-8 w-44 rounded-md" />
              </div>
            </div>
          </div>
          <footer className="flex items-center justify-between border-t border-border bg-muted/30 px-8 py-2">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-16" />
          </footer>
        </article>
      </div>
  );

  if (embedded) {
    return <div className="w-full space-y-4">{content}</div>;
  }

  return (
    <main
      id="main-content"
      className="min-h-svh bg-muted/20 px-4 py-6 sm:py-10"
    >
      {content}
    </main>
  );
}
