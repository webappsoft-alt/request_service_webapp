"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  EstimatePdfDocument,
  SignaturePadField,
  typedSignature,
  useSignPad,
} from "@/components/estimate/estimate-pdf";
import {
  buildEstimateSnapshot,
  shareUrlFor,
  useEstimateShare,
} from "@/components/portal/use-estimate-share";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
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
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getAuthToken } from "@/components/api/apiFuntions";
import { shareEstimate } from "@/lib/api/crm-client";
import { estimateCanShare } from "@/lib/data/portal";
import type { PortalCustomerCrm } from "@/lib/data/crm-people";
import type { Estimate } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";

export type SendApprovalResult = {
  viaApi: boolean;
  token: string;
  url: string;
  href: string;
  status?: string;
};

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
  onSent: (result: SendApprovalResult) => void;
}) {
  const crm = useCrmApiData();
  const auth = useAppSelector(selectAuth);
  const { session, provider } = usePortalWorkspace();
  const share = useEstimateShare();
  const ready = estimateCanShare(estimate.status);
  // Match estimate detail: send when CRM is on or a session token is already available.
  const apiReady =
    crm.enabled ||
    Boolean(auth.token) ||
    (typeof window !== "undefined" && Boolean(getAuthToken()));

  const snapshot = useMemo(
    () =>
      buildEstimateSnapshot(estimate, {
        // Prefer the real CRM share token only — never invent a local fake token here.
        token: estimate.shareToken || undefined,
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
      <DialogContent
        className="max-h-[92vh] overflow-hidden p-0 sm:max-w-4xl"
        showCloseButton
      >
        <DialogHeader className="border-b border-black/10 px-5 py-4">
          <DialogTitle>Send {estimate.number} for approval</DialogTitle>
          <DialogDescription>
            Review the estimate as the customer will see it. Sign for the
            company on page 2, then send. This calls the CRM share API so the
            customer can open, revise, or sign the live estimate.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ApprovalPreview
            snapshot={snapshot}
            defaultSigner={
              [session?.firstName, session?.lastName].filter(Boolean).join(" ") ||
              provider.contact?.name ||
              provider.companyName
            }
            ready={ready}
            apiReady={apiReady}
            busyLabel="Sending…"
            onCancel={() => onOpenChange(false)}
            onSend={async (signed) => {
              if (!apiReady) {
                toast.error(
                  "CRM is not connected. Sign in as a Pro and try again.",
                );
                return;
              }
              try {
                const shared = await shareEstimate(estimate.id, {
                  companySignedBy: signed.companySignedBy,
                  companySignedAt: signed.companySignedAt,
                  companySignatureDataUrl: signed.companySignatureDataUrl,
                });
                const token = String(shared.shareToken || "").trim();
                if (!token) {
                  throw new Error(
                    "The CRM did not return a customer share link. Try again.",
                  );
                }
                const nextStatus =
                  (shared.status as Estimate["status"]) || "sent";
                crm.patchEstimate(estimate.id, {
                  status: nextStatus,
                  shareToken: token,
                  companySignature: {
                    signedBy: signed.companySignedBy || "",
                    signedAt: signed.companySignedAt || new Date().toISOString(),
                    imageBase64: signed.companySignatureDataUrl,
                  },
                });
                const next = { ...signed, token };
                share.saveSnapshot(next);
                const url = shareUrlFor(token);
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  // non-blocking
                }
                onSent({
                  viaApi: true,
                  token,
                  url,
                  href: url,
                  status: nextStatus,
                });
                if (shared.emailSent) {
                  toast.success(
                    shared.emailTo
                      ? `Estimate emailed to ${shared.emailTo}. Link also copied.`
                      : "Estimate emailed to the customer. Link also copied.",
                  );
                } else if (shared.emailSkippedReason) {
                  toast.success(
                    "Estimate shared with customer. Link copied — email skipped (no customer email).",
                  );
                } else if (shared.emailError) {
                  toast.success(
                    "Estimate shared with customer. Link copied — email could not be sent.",
                  );
                } else {
                  toast.success(
                    "Estimate shared with customer. They can review and sign now.",
                  );
                }
                onOpenChange(false);
              } catch (error) {
                toast.error(
                  extractErrorMessage(error) ||
                    (error instanceof Error
                      ? error.message
                      : "Could not send this estimate."),
                );
              }
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
  apiReady,
  busyLabel,
  onCancel,
  onSend,
}: {
  snapshot: ReturnType<typeof buildEstimateSnapshot>;
  defaultSigner: string;
  ready: boolean;
  apiReady: boolean;
  busyLabel?: string;
  onCancel: () => void;
  onSend: (
    snapshot: ReturnType<typeof buildEstimateSnapshot>,
  ) => void | Promise<void>;
}) {
  const companyPad = useSignPad();
  const [signer, setSigner] = useState(defaultSigner);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <div className="max-h-[68vh] overflow-y-auto bg-[#eef1f5] px-4 py-5">
        <EstimatePdfDocument
          snapshot={snapshot}
          companySlot={
            <SignaturePadField
              name={signer}
              onName={setSigner}
              pad={companyPad}
              showNameInput
              caption="Authorized company signature"
              date={new Date().toISOString()}
            />
          }
        />
      </div>
      <DialogFooter className="m-0 rounded-none">
        {!ready ? (
          <p className="mr-auto self-center text-sm text-amber-900">
            Finalize this estimate before sending.
          </p>
        ) : !apiReady ? (
          <p className="mr-auto self-center text-sm text-amber-900">
            CRM connection required to send to the customer.
          </p>
        ) : null}
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          data-action="confirm-send-approval"
          disabled={!ready || !apiReady || busy}
          onClick={() => {
            if (!signer.trim()) {
              toast.error("Enter the company signer name.");
              return;
            }
            const image = companyPad.dirty
              ? companyPad.toImage()
              : typedSignature(signer.trim());
            if (!image) {
              toast.error("Add the company signature on page 2.");
              return;
            }
            setBusy(true);
            void Promise.resolve(
              onSend({
                ...snapshot,
                companySignedBy: signer.trim(),
                companySignedAt: new Date().toISOString(),
                companySignatureDataUrl: image,
              }),
            ).finally(() => setBusy(false));
          }}
        >
          {busy && busyLabel ? busyLabel : "Send for approval"}
        </Button>
      </DialogFooter>
    </>
  );
}
