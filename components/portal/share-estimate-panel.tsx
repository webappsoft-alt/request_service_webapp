"use client";

import { useState } from "react";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
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

export { buildEstimateSnapshot };

export function EstimateShareTab({
  estimate,
  customer,
  customerLabel,
  onSent,
}: {
  estimate: Estimate;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  onSent: (result?: SendApprovalResult) => void;
}) {
  const { session, provider } = usePortalWorkspace();
  const crm = useCrmApiData();
  const share = useEstimateShare();
  const snapshot = share.snapshotForEstimate(estimate.id);
  const approval = share.approvalOf(estimate.id);
  const [url, setUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const ready = estimateCanShare(estimate.status);
  const apiReady = crm.enabled && crm.ready;

  async function publish() {
    if (!ready) {
      toast.error("Finalize the estimate in the office before sending it to the customer.");
      return "";
    }
    let token = snapshot?.token;
    let href = snapshot ? shareUrlFor(snapshot.token) : "";
    if (apiReady) {
      const shared = await shareEstimateApi(estimate.id);
      token = shared.shareToken || token;
      href = shared.shareUrl
        ? new URL(shared.shareUrl, window.location.origin).toString()
        : shared.shareToken
          ? shareUrlFor(shared.shareToken)
          : href;
      await crm.refresh();
    }
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
    const nextHref = href || shareUrlFor(next.token);
    setUrl(nextHref);
    onSent({
      viaApi: apiReady,
      token: next.token,
      url: nextHref,
      href: nextHref,
    });
    return nextHref;
  }

  async function copy() {
    const href = url || (await publish());
    if (!href) return;
    void navigator.clipboard.writeText(href);
    toast.success("Customer link copied. Send it so they can review and sign.");
  }

  async function openCustomerView() {
    const href = url || (snapshot ? shareUrlFor(snapshot.token) : await publish());
    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[4px] border border-black/10 bg-card p-4">
        <h2 className="text-sm font-semibold">Send for approval</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview the estimate as a two-page document, sign for the company, then send the customer link.
        </p>
        {ready ? null : (
          <p className="mt-3 text-sm text-amber-900">Finalize this estimate before creating a customer link.</p>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={url || (snapshot ? shareUrlFor(snapshot.token) : "Create the link, then copy it")} />
          <Button onClick={() => setPreviewOpen(true)} disabled={!ready}>
            Send for approval
          </Button>
          <Button variant="outline" onClick={() => void copy()} disabled={!ready}>
            <Copy />
            Copy link
          </Button>
          {ready ? (
            <Button variant="outline" onClick={() => void openCustomerView()}>
              <ExternalLink />
              Open customer view
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <ExternalLink />
              Open customer view
            </Button>
          )}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`Signature of ${approval.signedBy}`} src={approval.signatureDataUrl} className="mt-3 h-16 w-48 object-contain" />
        </div>
      ) : snapshot ? (
        <p className="text-sm text-muted-foreground">Waiting on the customer to sign {estimate.number}.</p>
      ) : null}
      {snapshot ? <EstimatePdfDocument snapshot={snapshot} approval={approval} /> : null}
      <SendApprovalDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        estimate={estimate}
        customer={customer}
        customerLabel={customerLabel}
        onSent={({ href, viaApi, token, url }) => {
          setUrl(href || url);
          onSent({ viaApi, token, url: href || url, href: href || url });
        }}
      />
    </div>
  );
}
