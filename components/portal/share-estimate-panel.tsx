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
        existingSig || existingBy
          ? {
              companySignedBy: existingBy || undefined,
              companySignedAt:
                estimate.companySignature?.signedAt ||
                snapshot?.companySignedAt ||
                new Date().toISOString(),
              companySignatureDataUrl: existingSig || undefined,
            }
          : undefined,
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
            ? `Estimate emailed to ${shared.emailTo}.`
            : "Estimate emailed to the customer.",
        );
      } else if (shared.emailSkippedReason) {
        toast.message("Link ready", { description: shared.emailSkippedReason });
      } else if (shared.emailError) {
        toast.message("Link ready", {
          description: "Email could not be sent — check mail settings on the server.",
        });
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
      <div className="rounded-[4px] border border-black/10 bg-card p-4">
        <h2 className="text-sm font-semibold">Send for approval</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview the estimate as a two-page document, sign for the company, then send the customer link.
        </p>
        {ready ? null : (
          <div className="mt-3 flex flex-col gap-2 rounded-[4px] border border-amber-200 bg-amber-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              {estimate.status === "site_visit"
                ? "Site visit is still pending. Assign a team member, complete the visit, and save field notes before this estimate can be finalized or sent."
                : estimate.status === "inspected"
                  ? "Site visit notes are in. Add pricing on Line items, then Finalize before sending to the customer."
                  : estimate.status === "draft"
                    ? "Office draft. Finish pricing, then Finalize before sending the customer link."
                    : "Finalize the estimate first so you can send the customer approval link."}
            </p>
            {(estimate.status === "draft" ||
              estimate.status === "inspected" ||
              estimate.status === "changes_requested") &&
            onFinalize ? (
              <Button size="sm" disabled={finalizing} onClick={onFinalize} className="shrink-0">
                {finalizing ? "Finalizing…" : "Finalize estimate"}
              </Button>
            ) : null}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <Input
              readOnly
              value={displayUrl}
              placeholder="Create the link, then copy it"
              className="h-9 w-full font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            {locked || Boolean(approval) ? null : (
              <Button
                className="h-9 px-3.5"
                onClick={() => setPreviewOpen(true)}
                disabled={!ready}
              >
                Send for approval
              </Button>
            )}
            <Button
              className="h-9 px-3.5"
              variant="outline"
              onClick={() => void copy()}
              disabled={!ready}
            >
              {copied ? (
                <>
                  <Check className="size-4 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  <span>Copy link</span>
                </>
              )}
            </Button>
            {ready ? (
              <Button
                className="h-9 px-3.5"
                variant="outline"
                onClick={() => void openCustomerView()}
              >
                <ExternalLink className="size-4" />
                Open customer view
              </Button>
            ) : (
              <Button
                className="h-9 px-3.5"
                variant="outline"
                disabled
              >
                <ExternalLink className="size-4" />
                Open customer view
              </Button>
            )}
          </div>
        </div>
      </div>
      {approval ? (
        <div className="rounded-[4px] border border-emerald-200 bg-emerald-50 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="size-4" />
            Signed by {approval.signedBy}
          </p>
          <p className="mt-1 text-sm text-emerald-950">
            Approved {formatDate(approval.signedAt.slice(0, 10))}. Convert this quote to a job to schedule the work.
          </p>
          {approval.signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`Signature of ${approval.signedBy}`}
              src={approval.signatureDataUrl}
              className="mt-3 h-16 w-48 object-contain"
            />
          ) : null}
        </div>
      ) : waitingOnCustomer ? (
        <p className="text-sm text-muted-foreground">Waiting on the customer to sign {estimate.number}.</p>
      ) : null}
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
