"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { EstimatePdfDocument } from "@/components/estimate/estimate-pdf";
import { SendApprovalDialog } from "@/components/portal/send-approval-dialog";
import {
  buildEstimateSnapshot,
  sharePath,
  shareTokenFor,
  shareUrlFor,
  useEstimateShare,
} from "@/components/portal/use-estimate-share";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  onSent: () => void;
}) {
  const { session, provider } = usePortalWorkspace();
  const share = useEstimateShare();
  const token = shareTokenFor(estimate.id);
  const snapshot = share.snapshotOf(token);
  const approval = share.approvalOf(estimate.id);
  const [url, setUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  function publish() {
    if (!estimateCanShare(estimate.status)) {
      toast.error("Finalize the estimate in the office before sending it to the customer.");
      return "";
    }
    const next = buildEstimateSnapshot(estimate, {
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
    onSent();
    const href = shareUrlFor(next.token);
    setUrl(href);
    return href;
  }

  const ready = estimateCanShare(estimate.status);

  function copy() {
    const href = url || publish();
    if (!href) return;
    void navigator.clipboard.writeText(href);
    toast.success("Customer link copied. Send it so they can review and sign.");
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
          <Input readOnly value={url || (snapshot ? shareUrlFor(token) : "Create the link, then copy it")} />
          <Button onClick={() => setPreviewOpen(true)} disabled={!ready}>
            Send for approval
          </Button>
          <Button variant="outline" onClick={copy} disabled={!ready}>
            <Copy />
            Copy link
          </Button>
          {ready ? (
            <Button variant="outline" asChild>
              <Link href={sharePath(token)} target="_blank" onClick={() => publish()}>
                <ExternalLink />
                Open customer view
              </Link>
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
        onSent={() => {
          onSent();
          setUrl(shareUrlFor(shareTokenFor(estimate.id)));
        }}
      />
    </div>
  );
}
