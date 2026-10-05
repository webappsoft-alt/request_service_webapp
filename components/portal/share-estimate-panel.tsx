"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { EstimatePdfDocument } from "@/components/estimate/estimate-pdf";
import { SendApprovalDialog, type SendApprovalResult } from "@/components/portal/send-approval-dialog";
import {
  buildEstimateSnapshot,
  shareUrlFor,
  useEstimateShare,
} from "@/components/portal/use-estimate-share";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shareEstimate as shareEstimateApi } from "@/lib/api/crm-client";
import { crmCustomerName } from "@/lib/data/crm-people";
import { estimateCanShare } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import type { Estimate } from "@/lib/types";
import type { PortalCustomerCrm } from "@/lib/data/crm-people";
import { getAuthToken } from "@/components/api/apiFuntions";
import { useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";

export { buildEstimateSnapshot };

export function EstimateShareTab({
  estimate,
  customer,
  customerLabel,
  locked = false,
  onSent,
  onFinalize,
  finalizing = false,
}: {
  estimate: Estimate;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  locked?: boolean;
  onSent: (result?: SendApprovalResult) => void;
  onFinalize?: () => void;
  finalizing?: boolean;
}) {
  const { session, provider } = usePortalWorkspace();
  const crm = useCrmApiData();
  const auth = useAppSelector(selectAuth);
  const share = useEstimateShare();
  const snapshot = share.snapshotForEstimate(estimate.id);
  const localApproval = share.approvalOf(estimate.id);
  const apiSignature = estimate.signature;
  const approval =
    localApproval ||
    (apiSignature
      ? {
          estimateId: estimate.id,
          signedBy: apiSignature.signedBy,
          signedAt: apiSignature.signedAt,
          signatureDataUrl: apiSignature.imageBase64 || "",
        }
      : undefined);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const ready = estimateCanShare(estimate.status);
  const apiReady =
    crm.enabled ||
    Boolean(auth.token) ||
    (typeof window !== "undefined" && Boolean(getAuthToken()));
  const waitingOnCustomer = !approval && (Boolean(snapshot) || estimate.status === "sent");

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const displayUrl =
    url ||
    (estimate.shareToken
      ? shareUrlFor(estimate.shareToken)
      : snapshot?.token
        ? shareUrlFor(snapshot.token)
        : "");

  async function publish() {
    if (!ready) {
      toast.error(
        "This estimate cannot be shared yet. Finalize it in the office first, or wait until it is ready to send.",
      );
      return "";
    }
    if (!apiReady) {
      toast.error("CRM is not connected. Sign in as a Pro and try again.");
      return "";
    }
    try {
      const existingSig =
        estimate.companySignature?.imageBase64 ||
        snapshot?.companySignatureDataUrl ||
        "";
      const existingBy =
        estimate.companySignature?.signedBy ||
        snapshot?.companySignedBy ||
        "";
      const shared = await shareEstimateApi(
        estimate.id,
        {
          ...(existingSig || existingBy
            ? {
                companySignedBy: existingBy || undefined,
                companySignedAt:
                  estimate.companySignature?.signedAt ||
                  snapshot?.companySignedAt ||
                  new Date().toISOString(),
                companySignatureDataUrl: existingSig || undefined,
              }
            : {}),
          customerEmail: customer?.email,
        },
      );
      const token = String(shared.shareToken || "").trim();
      if (!token) {
        toast.error("The CRM did not return a customer share link.");
        return "";
      }
      const href = shareUrlFor(token);
      const nextStatus = (shared.status as Estimate["status"]) || "sent";
      crm.patchEstimate(estimate.id, {
        status: nextStatus,
        shareToken: token,
      });
      const next = buildEstimateSnapshot(estimate, {
        token,
        email: session?.email,
        companyName: provider.companyName,
        companyEmail: provider.email,
        companyPhone: provider.phone,
        companyStreet: provider.street,
        companyCity: provider.city,
        companyState: provider.state,
        companyZip: provider.zip,
        logoUrl: provider.logoUrl,
        logoInitials: provider.logoInitials,
        licensed: provider.licensed,
        insured: provider.insured,
        customerName: customer ? crmCustomerName(customer) : customerLabel,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
        companySignedBy: existingBy || undefined,
        companySignedAt:
          estimate.companySignature?.signedAt ||
          snapshot?.companySignedAt ||
          undefined,
        companySignatureDataUrl: existingSig || undefined,
      });
      share.saveSnapshot(next);
      setUrl(href);
      onSent({
        viaApi: true,
        token,
        url: href,
        href,
        status: nextStatus,
      });
      if (shared.emailSent) {
        toast.success(
          shared.emailTo
            ? `Estimate has been sent to ${shared.emailTo}.`
            : "Estimate has been sent.",
        );
      } else if (shared.emailSkippedReason) {
        toast.success("Estimate has been sent. Link ready — email skipped.");
      } else if (shared.emailError) {
        toast.success(
          "Estimate has been sent. Link ready — email could not be delivered.",
        );
      } else {
        toast.success("Estimate has been sent.");
      }
      return href;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not share this estimate with the customer.",
      );
      return "";
    }
  }

  async function copy() {
    const targetUrl = displayUrl || (await publish());
    if (!targetUrl) return;
    try {
      await navigator.clipboard.writeText(targetUrl);
      setUrl(targetUrl);
      setCopied(true);
      toast.success("Customer link copied.");
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 3000);
    } catch {
      toast.error("Failed to copy link.");
    }
  }

  async function openCustomerView() {
    const existingToken = String(
      estimate.shareToken || snapshot?.token || "",
    ).trim();
    let token = existingToken;
    if (!token) {
      const publishedUrl = await publish();
      if (!publishedUrl) return;
      token =
        publishedUrl.match(/\/e\/([^/?#]+)/)?.[1] ||
        String(estimate.shareToken || "").trim();
    }
    if (!token) return;
    window.open(shareUrlFor(token), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-soft pb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Share with customer</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Preview, send for approval, or copy the customer link for {customerLabel}.
          </p>
        </div>
        {approval ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="size-3.5" />
            Signed
          </span>
        ) : waitingOnCustomer ? (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
            Waiting on customer
          </span>
        ) : ready ? (
          <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
            Ready to send
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Not ready
          </span>
        )}
      </div>

      {ready ? null : (
        <div className="flex flex-col gap-3 rounded-lg bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-950">
            {estimate.status === "site_visit"
              ? "Complete the site visit and save field notes before this estimate can be finalized or sent."
              : estimate.status === "inspected"
                ? "Add pricing on Labour & Material, then Finalize before sending."
                : estimate.status === "draft"
                  ? "Finish pricing, then Finalize before sending the customer link."
                  : "Finalize the estimate first so you can send the customer approval link."}
          </p>
          {(estimate.status === "draft" ||
            estimate.status === "inspected" ||
            estimate.status === "changes_requested") &&
          onFinalize ? (
            <Button size="sm" className="h-8 shrink-0" disabled={finalizing} onClick={onFinalize}>
              {finalizing ? "Finalizing…" : "Finalize estimate"}
            </Button>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 rounded-lg border border-border-soft bg-card p-4 lg:col-span-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Customer link
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Copy the link or open the customer view after the estimate is ready.
            </p>
          </div>
          <Input
            readOnly
            value={displayUrl}
            placeholder="Create the link, then copy it"
            className="h-9 border-border-soft bg-[#fafbfc] font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            {locked || Boolean(approval) ? null : (
              <Button
                size="sm"
                className="h-8"
                onClick={() => setPreviewOpen(true)}
                disabled={!ready}
              >
                Send for approval
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-border-soft"
              onClick={() => void copy()}
              disabled={!ready}
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy link
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-border-soft"
              onClick={() => void openCustomerView()}
              disabled={!ready}
            >
              <ExternalLink className="size-3.5" />
              Open customer view
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border-soft bg-card p-4 lg:col-span-2">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Status
          </p>
          {approval ? (
            <div className="mt-3 space-y-2">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <CheckCircle2 className="size-4" />
                Signed by {approval.signedBy}
              </p>
              <p className="text-sm text-muted-foreground">
                Approved {formatDate(approval.signedAt.slice(0, 10))}. Convert this quote to a job to schedule the work.
              </p>
              {approval.signatureDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`Signature of ${approval.signedBy}`}
                  src={approval.signatureDataUrl}
                  className="mt-2 h-14 w-40 object-contain"
                />
              ) : null}
            </div>
          ) : waitingOnCustomer ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Waiting on the customer to sign {estimate.number}.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No customer signature yet. Send for approval when the quote is ready.
            </p>
          )}
        </div>
      </div>

      {snapshot ? <EstimatePdfDocument snapshot={snapshot} approval={approval} /> : null}
      <SendApprovalDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        estimate={estimate}
        customer={customer}
        customerLabel={customerLabel}
        onSent={({ href, viaApi, token, url: sentUrl, status }) => {
          const frontendUrl = token ? shareUrlFor(token) : (sentUrl || href);
          setUrl(frontendUrl);
          onSent({
            viaApi,
            token,
            url: frontendUrl,
            href: frontendUrl,
            status,
          });
        }}
      />
    </div>
  );
}
