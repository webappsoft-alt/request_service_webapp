"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileQuestion,
  Printer,
  ShieldCheck,
} from "lucide-react";
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
} from "@/components/portal/use-estimate-share";
import {
  extractErrorMessage,
  getData,
  postData,
  showApiErrorToast,
} from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  forgetCustomerEstimateToken,
  rememberCustomerEstimateToken,
} from "@/lib/booking/customer-estimates-store";
import { formatDate, formatMoney } from "@/lib/format";

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

  const companySignature = asRecord(estimate.signature);
  const approvalRaw = asRecord(estimate.approval);
  const estimateId =
    stringValue(estimate.id) ||
    stringValue(estimate._id) ||
    stringValue((asRecord(estimate._id) as { $oid?: string } | null)?.$oid);

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
    stringValue(companySignature?.imageBase64) ||
    stringValue(companySignature?.signature) ||
    stringValue(estimate.companySignatureDataUrl);

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
    companySignedBy: companySignedBy || undefined,
    companySignedAt: companySignedAt || undefined,
    companySignatureDataUrl: companySignatureDataUrl || undefined,
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

export function CustomerEstimatePage({ token }: { token: string }) {
  const share = useEstimateShare();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<EstimateShareSnapshot | null>(null);
  const [approval, setApproval] = useState<EstimateApproval | undefined>(
    undefined,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getData(publicApi.estimate(token), undefined, {
        token: null,
        skipLogoutOn401: true,
        silent: true,
        force: true,
      });

      const root = asRecord(response);
      if (root && root.success === false) {
        forgetCustomerEstimateToken(token);
        setError(
          stringValue(root.message) ||
            "Estimate proposal not found or link has expired",
        );
        setSnapshot(null);
        setApproval(undefined);
        setLoading(false);
        return;
      }

      const mapped = mapPublicEstimateToSnapshot(token, response);
      if (mapped) {
        rememberCustomerEstimateToken(token);
        setSnapshot(mapped.snapshot);
        setApproval(
          mapped.approval || share.approvalOf(mapped.snapshot.estimateId),
        );
        setLoading(false);
        return;
      }

      forgetCustomerEstimateToken(token);
      setError("Estimate proposal not found or link has expired");
      setSnapshot(null);
      setApproval(undefined);
      setLoading(false);
    } catch (err) {
      forgetCustomerEstimateToken(token);
      const message = extractErrorMessage(err);
      setError(message || "Estimate proposal not found or link has expired");
      setSnapshot(null);
      setApproval(undefined);
      setLoading(false);
    }
  }, [token, share.approvalOf]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(signedBy: string, signatureImageBase64: string) {
    if (!snapshot) return;
    try {
      await postData(
        publicApi.estimateApprove(token),
        { signedBy, signatureImageBase64 },
        { token: null, skipLogoutOn401: true },
      );
    } catch (err) {
      showApiErrorToast(err, "Unable to approve this estimate.");
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
      "Estimate signed and approved! The company has been notified.",
    );
    void load();
  }

  if (loading) {
    return <EstimateDocumentSkeleton />;
  }

  if (!snapshot) {
    return (
      <main id="main-content" className="min-h-svh bg-[#eef1f5] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-md bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <FileQuestion className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Estimate proposal not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ||
              "Estimate proposal not found or link has expired. Please ask the service company to send a new link."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="min-h-svh bg-[#eef1f5] px-4 py-6 sm:py-10 print:min-h-0 print:bg-white print:p-0 print:m-0"
    >
      <div className="mx-auto w-full max-w-[8.5in] space-y-4 print:max-w-none print:space-y-0 print:p-0 print:m-0">
        {/* Top bar with quick actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-black/10 bg-card px-4 py-3 print:hidden">
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
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <ShieldCheck className="size-3.5" /> Ready for review
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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

        {/* 2-page document preview with signature field on page 2 */}
        <EstimatePdfDocument
          snapshot={snapshot}
          approval={approval}
          customerSlot={
            approval ? undefined : (
              <CustomerSignSlot snapshot={snapshot} onSign={approve} />
            )
          }
        />

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
    <div>
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
            {busy ? "Signing…" : `Sign and approve ${snapshot.number}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EstimateDocument({
  snapshot,
}: {
  snapshot: EstimateShareSnapshot;
}) {
  return <EstimatePdfDocument snapshot={snapshot} />;
}

export function EstimateDocumentSkeleton() {
  return (
    <main
      id="main-content"
      className="min-h-svh bg-[#eef1f5] px-4 py-6 sm:py-10"
    >
      <div className="mx-auto w-full max-w-[8.5in] space-y-4">
        {/* Top bar skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-black/10 bg-card px-4 py-3">
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
          <footer className="flex items-center justify-between border-t border-black/10 bg-[#f8fafc] px-8 py-2">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-16" />
          </footer>
        </article>
      </div>
    </main>
  );
}
