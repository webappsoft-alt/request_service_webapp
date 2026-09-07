"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EstimatePdfDocument, SignaturePadField, typedSignature, useSignPad } from "@/components/estimate/estimate-pdf";
import { buildEstimateSnapshot, shareUrlFor, useEstimateShare } from "@/components/portal/use-estimate-share";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { estimateCanShare } from "@/lib/data/portal";
import type { PortalCustomerCrm } from "@/lib/data/crm-people";
import type { Estimate } from "@/lib/types";

export function SendApprovalDialog({
  open,
  onOpenChange,
  estimate,
  customer,
  customerLabel,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: Estimate;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  onSent: () => void;
}) {
  const { session, provider } = usePortalWorkspace();
  const share = useEstimateShare();
  const ready = estimateCanShare(estimate.status);

  const snapshot = useMemo(
    () =>
      buildEstimateSnapshot(estimate, {
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
        customerName: customerLabel,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
      }),
    [customer, customerLabel, estimate, provider, session?.email],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-4xl" showCloseButton>
        <DialogHeader className="border-b border-black/10 px-5 py-4">
          <DialogTitle>Send {estimate.number} for approval</DialogTitle>
          <DialogDescription>
            Review the estimate as the customer will see it. Sign for the company on page 2, then send.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ApprovalPreview
            snapshot={snapshot}
            defaultSigner={[session?.firstName, session?.lastName].filter(Boolean).join(" ") || provider.contact?.name || provider.companyName}
            ready={ready}
            onCancel={() => onOpenChange(false)}
            onSend={(signed) => {
              share.saveSnapshot(signed);
              onSent();
              void navigator.clipboard.writeText(shareUrlFor(signed.token));
              toast.success("Estimate sent for approval. Customer link copied.");
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ApprovalPreview({
  snapshot,
  defaultSigner,
  ready,
  onCancel,
  onSend,
}: {
  snapshot: ReturnType<typeof buildEstimateSnapshot>;
  defaultSigner: string;
  ready: boolean;
  onCancel: () => void;
  onSend: (snapshot: ReturnType<typeof buildEstimateSnapshot>) => void;
}) {
  const companyPad = useSignPad();
  const [signer, setSigner] = useState(defaultSigner);

  return (
    <>
      <div className="max-h-[68vh] overflow-y-auto bg-[#eef1f5] px-4 py-5">
        <EstimatePdfDocument
          snapshot={snapshot}
          companySlot={<SignaturePadField name={signer} onName={setSigner} pad={companyPad} />}
        />
      </div>
      <DialogFooter className="m-0 rounded-none">
        {!ready ? <p className="mr-auto self-center text-sm text-amber-900">Finalize this estimate before sending.</p> : null}
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          data-action="confirm-send-approval"
          disabled={!ready}
          onClick={() => {
            if (!signer.trim()) {
              toast.error("Enter the company signer name.");
              return;
            }
            const image = companyPad.dirty ? companyPad.toImage() : typedSignature(signer.trim());
            if (!image) {
              toast.error("Add the company signature on page 2.");
              return;
            }
            onSend({
              ...snapshot,
              companySignedBy: signer.trim(),
              companySignedAt: new Date().toISOString(),
              companySignatureDataUrl: image,
            });
          }}
        >
          Send for approval
        </Button>
      </DialogFooter>
    </>
  );
}
