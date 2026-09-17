"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, Printer, ShieldCheck } from "lucide-react";
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
import { getData, postData, showApiErrorToast } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { Button } from "@/components/ui/button";
import { rememberCustomerEstimateToken } from "@/lib/booking/customer-estimates-store";
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
  const estimate = asRecord(root?.data) ?? root;
  if (!estimate) return null;

  const provider = asRecord(estimate.providerId) ?? asRecord(estimate.provider) ?? {};
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
    (Array.isArray(snapshotCustomer.addresses) && asRecord(snapshotCustomer.addresses[0])) ??
    {};

  const companySignature = asRecord(estimate.signature);
  const approvalRaw = asRecord(estimate.approval);
  const estimateId =
    stringValue(estimate.id) ||
    stringValue(estimate._id) ||
    stringValue((asRecord(estimate._id) as { $oid?: string } | null)?.$oid);

  if (!estimateId) return null;

  const items = (Array.isArray(estimate.items) ? estimate.items : []).map((entry) => {
    const item = asRecord(entry) ?? {};
    const kindRaw = stringValue(item.kind || item.type).toLowerCase();
    const quantity = Math.max(0, numberValue(item.quantity, 1));
    const unitPrice = numberValue(item.unitPrice);
    return {
      description: stringValue(item.description) || "Line item",
      kind: (kindRaw === "material" || kindRaw === "materials" ? "materials" : "labor") as
        | "labor"
        | "materials",
      quantity,
      unit: stringValue(item.unit) || (kindRaw === "labor" ? "hr" : "ea"),
      unitPrice,
      total: numberValue(item.total, Math.round(quantity * unitPrice)),
    };
  });

  const companySignedBy =
    stringValue(companySignature?.signedBy) ||
    stringValue(estimate.companySignedBy) ||
    stringValue(provider.companyName);
  const companySignedAt =
    toIso(companySignature?.signedAt) ||
    toIso(estimate.companySignedAt);
  const companySignatureDataUrl =
    stringValue(companySignature?.imageBase64) ||
    stringValue(companySignature?.signature) ||
    stringValue(estimate.companySignatureDataUrl);

  const snapshot: EstimateShareSnapshot = {
    token,
    estimateId,
    number: stringValue(estimate.number) || `EST-${estimateId.slice(-4).toUpperCase()}`,
    companyName: stringValue(provider.companyName) || "Service company",
    companyEmail: stringValue(provider.email),
    companyPhone: stringValue(provider.phone),
    companyStreet: stringValue(location.address),
    companyCity: stringValue(location.city),
    companyState: stringValue(location.state),
    companyZip: stringValue(location.zip),
    licensed: Boolean(asRecord(provider.profile)?.licensed ?? provider.licensed),
    insured: Boolean(asRecord(provider.profile)?.insured ?? provider.insured),
    customerName:
      [stringValue(snapshotCustomer.firstName), stringValue(snapshotCustomer.lastName)]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      stringValue(snapshotCustomer.companyName) ||
      stringValue(estimate.customerName) ||
      "Customer",
    customerEmail: stringValue(snapshotCustomer.email) || stringValue(estimate.customerEmail) || undefined,
    customerPhone: stringValue(snapshotCustomer.phone) || stringValue(estimate.customerPhone) || undefined,
    street: stringValue(address.street),
    city: stringValue(address.city),
    state: stringValue(address.state),
    zip: stringValue(address.zip),
    issuedAt: toIso(estimate.issuedAt) || toIso(estimate.createdAt) || new Date().toISOString(),
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

  const signedAt = toIso(approvalRaw?.signedAt) || toIso(approvalRaw?.approvedAt);
  const signedBy = stringValue(approvalRaw?.signedBy) || stringValue(approvalRaw?.name);
  const approvalImage = stringValue(approvalRaw?.signatureImageBase64) || stringValue(approvalRaw?.signature);

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
  const [approval, setApproval] = useState<EstimateApproval | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getData(publicApi.estimate(token), undefined, {
        token: null,
        skipLogoutOn401: true,
        silent: true,
      });
      const mapped = mapPublicEstimateToSnapshot(token, response);
      if (mapped) {
        rememberCustomerEstimateToken(token);
        setSnapshot(mapped.snapshot);
        setApproval(mapped.approval || share.approvalOf(mapped.snapshot.estimateId));
        setLoading(false);
        return;
      }
    } catch {
      // Fallback to local store if available
    }

    const local = share.snapshotOf(token);
    if (local) {
      rememberCustomerEstimateToken(token);
      setSnapshot(local);
      setApproval(share.approvalOf(local.estimateId));
      setLoading(false);
      return;
    }

    setError("Estimate link not found");
    setSnapshot(null);
    setApproval(undefined);
    setLoading(false);
  }, [token, share.snapshotOf, share.approvalOf]);

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
    toast.success("Estimate signed and approved! The company has been notified.");
    void load();
  }

  if (loading) {
    return (
      <main id="main-content" className="min-h-svh bg-[#eef1f5] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-md border border-black/15 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading estimate…</p>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main id="main-content" className="min-h-svh bg-[#eef1f5] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-md border border-black/15 bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Estimate link not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ||
              "Ask the company to send the estimate again. The link is created when they send it for approval."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-svh bg-[#eef1f5] px-4 py-6 sm:py-10 print:min-h-0 print:bg-white print:p-0 print:m-0">
      <div className="mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-0 print:p-0 print:m-0">
        {/* Top bar with quick actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-black/10 bg-card px-4 py-3 shadow-sm print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{snapshot.companyName}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">{snapshot.number}</span>
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
          <div className="mx-auto flex max-w-[8.5in] items-center gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-emerald-900">Signed & Approved</span> by {approval.signedBy} on{" "}
              {formatDate(approval.signedAt.slice(0, 10))}. The service company has received your approval and can proceed with scheduling.
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
      <SignaturePadField name={snapshot.customerName} pad={pad} showNameInput={false} />
      <p className="hidden print:block mt-2 text-[11px] text-muted-foreground">Customer signs to approve this estimate</p>
      <div className="print:hidden">
        <label className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-foreground cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-black/20"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          <span>
            I have read pages 1 and 2 and authorize <strong>{snapshot.companyName}</strong> to proceed for{" "}
            <strong>{formatMoney(snapshot.total)}</strong>.
          </span>
        </label>
        <Button
          className="mt-3 w-full sm:w-auto"
          size="sm"
          disabled={!agreed || busy}
          onClick={() => {
            const image = pad.dirty ? pad.toImage() : typedSignature(snapshot.customerName);
            if (!image) {
              toast.error("Please provide a signature.");
              return;
            }
            setBusy(true);
            void Promise.resolve(onSign(snapshot.customerName, image)).finally(() => setBusy(false));
          }}
        >
          {busy ? "Signing…" : `Sign and approve ${snapshot.number}`}
        </Button>
      </div>
    </div>
  );
}

export function EstimateDocument({ snapshot }: { snapshot: EstimateShareSnapshot }) {
  return <EstimatePdfDocument snapshot={snapshot} />;
}

