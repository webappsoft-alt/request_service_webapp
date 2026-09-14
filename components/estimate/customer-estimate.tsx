"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  EstimatePdfDocument,
  SignaturePadField,
  typedSignature,
  useSignPad,
} from "@/components/estimate/estimate-pdf";
import {
  type EstimateApproval,
  type EstimateShareSnapshot,
} from "@/components/portal/use-estimate-share";
import { getData, postData, showApiErrorToast } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { Button } from "@/components/ui/button";
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
  const snapshotCustomer = asRecord(estimate.customerSnapshot) ?? {};
  const address =
    asRecord(snapshotCustomer.address) ??
    asRecord(estimate.propertyAddress) ??
    asRecord(estimate.address) ??
    {};
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
    licensed: Boolean(asRecord(provider.profile)?.licensed),
    insured: Boolean(asRecord(provider.profile)?.insured),
    customerName:
      [stringValue(snapshotCustomer.firstName), stringValue(snapshotCustomer.lastName)]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      stringValue(snapshotCustomer.companyName) ||
      "Customer",
    customerEmail: stringValue(snapshotCustomer.email) || undefined,
    customerPhone: stringValue(snapshotCustomer.phone) || undefined,
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
  };

  const signedAt = toIso(approvalRaw?.signedAt);
  const signedBy = stringValue(approvalRaw?.signedBy);
  const approval =
    signedAt || signedBy || stringValue(estimate.status) === "accepted"
      ? {
          estimateId,
          signedBy: signedBy || snapshot.customerName,
          signedAt: signedAt || new Date().toISOString(),
          signatureDataUrl: stringValue(approvalRaw?.signatureImageBase64),
        }
      : undefined;

  return { snapshot, approval };
}

export function CustomerEstimatePage({ token }: { token: string }) {
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
      if (!mapped) {
        setError("Estimate link not found");
        setSnapshot(null);
        setApproval(undefined);
        return;
      }
      setSnapshot(mapped.snapshot);
      setApproval(mapped.approval);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Estimate link not found");
      setSnapshot(null);
      setApproval(undefined);
    } finally {
      setLoading(false);
    }
  }, [token]);

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
      setApproval({
        estimateId: snapshot.estimateId,
        signedBy,
        signedAt: new Date().toISOString(),
        signatureDataUrl: signatureImageBase64,
      });
      toast.success("Estimate signed. The company can start the job.");
      await load();
    } catch (err) {
      showApiErrorToast(err, "Unable to approve this estimate.");
    }
  }

  if (loading) {
    return (
      <main id="main-content" className="min-h-svh bg-[#eef1f5] px-4 py-16">
        <div className="mx-auto max-w-lg border border-black/15 bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Loading estimate…</p>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main id="main-content" className="min-h-svh bg-[#eef1f5] px-4 py-16">
        <div className="mx-auto max-w-lg border border-black/15 bg-card p-8 text-center">
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
    <main id="main-content" className="min-h-svh bg-[#eef1f5] px-4 py-8">
      <div className="mx-auto max-w-3xl">
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
          <p className="mx-auto mt-4 flex max-w-[8.5in] items-center gap-2 rounded-[4px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="size-4" />
            Signed by {approval.signedBy} on {formatDate(approval.signedAt.slice(0, 10))}
          </p>
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
  const [name, setName] = useState(snapshot.customerName);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pad = useSignPad();

  return (
    <div className="mt-2">
      <SignaturePadField name={name} onName={setName} pad={pad} />
      <label className="mt-3 flex items-start gap-2 text-[11px] leading-4">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>
          I have read pages 1 and 2 and authorize {snapshot.companyName} to proceed for{" "}
          {formatMoney(snapshot.total)}.
        </span>
      </label>
      <Button
        className="mt-3"
        size="sm"
        disabled={!name.trim() || !agreed || busy}
        onClick={() => {
          const image = pad.dirty ? pad.toImage() : typedSignature(name.trim());
          if (!image) return;
          setBusy(true);
          void Promise.resolve(onSign(name.trim(), image)).finally(() => setBusy(false));
        }}
      >
        {busy ? "Signing…" : `Sign and approve ${snapshot.number}`}
      </Button>
    </div>
  );
}

export function EstimateDocument({ snapshot }: { snapshot: EstimateShareSnapshot }) {
  return <EstimatePdfDocument snapshot={snapshot} />;
}
