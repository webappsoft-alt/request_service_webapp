"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  EstimatePdfDocument,
  SignaturePadField,
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
import { cn } from "@/lib/utils";

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
  mode = "send",
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: Estimate;
  customer?: Pick<PortalCustomerCrm, "email" | "phone"> | PortalCustomerCrm;
  customerLabel: string;
  /** First send vs resend / post-change update. */
  mode?: "send" | "resend" | "update";
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

  const dialogTitle =
    mode === "update"
      ? `Send updated ${estimate.number}`
      : mode === "resend"
        ? `Send ${estimate.number} again`
        : `Send ${estimate.number} for approval`;
  const dialogDescription =
    mode === "update"
      ? "Review the revised estimate, sign for the company, then send the update on the same customer link."
      : mode === "resend"
        ? "Review the current estimate and send it again. Changes are recorded in activity and shown on the customer link."
        : "Review the estimate as the customer will see it. Sign for the company on page 2, then send. This creates the customer review link.";
  const confirmLabel =
    mode === "update"
      ? "Send update"
      : mode === "resend"
        ? "Send again"
        : "Send for approval";

  const localSnapshot = share.snapshotForEstimate(estimate.id);
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
        companySignedBy:
          estimate.companySignature?.signedBy ||
          localSnapshot?.companySignedBy,
        companySignedAt:
          estimate.companySignature?.signedAt ||
          localSnapshot?.companySignedAt,
        companySignatureDataUrl:
          estimate.companySignature?.imageBase64 ||
          (
            estimate.companySignature as
              | { signatureImageBase64?: string }
              | undefined
          )?.signatureImageBase64 ||
          localSnapshot?.companySignatureDataUrl,
      }),
    [customer, customerLabel, estimate, localSnapshot, provider, session?.email],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-hidden p-0 sm:max-w-4xl"
        showCloseButton
      >
        <DialogHeader className="border-b border-input px-5 py-4">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
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
            busyLabel={mode === "update" ? "Sending update…" : "Sending…"}
            confirmLabel={confirmLabel}
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
                  customerEmail: customer?.email,
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
                const sentVerb =
                  mode === "update"
                    ? "update sent"
                    : mode === "resend"
                      ? "sent again"
                      : "sent";
                if (shared.emailSent) {
                  toast.success(
                    shared.emailTo
                      ? `Estimate ${sentVerb} to ${shared.emailTo}.`
                      : `Estimate ${sentVerb} and emailed the customer.`,
                  );
                } else if (shared.emailSkippedReason) {
                  toast.error(
                    `Estimate ${sentVerb}, but email was skipped: ${shared.emailSkippedReason}`,
                  );
                } else if (shared.emailError) {
                  toast.error(
                    `Estimate ${sentVerb}, but email could not be delivered.`,
                  );
                } else {
                  toast.success(`Estimate ${sentVerb}.`);
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
  confirmLabel = "Send for approval",
  onCancel,
  onSend,
}: {
  snapshot: ReturnType<typeof buildEstimateSnapshot>;
  defaultSigner: string;
  ready: boolean;
  apiReady: boolean;
  busyLabel?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSend: (
    snapshot: ReturnType<typeof buildEstimateSnapshot>,
  ) => void | Promise<void>;
}) {
  const companyPad = useSignPad();
  const [signer, setSigner] = useState(
    snapshot.companySignedBy || defaultSigner,
  );
  const [keptImage, setKeptImage] = useState(
    snapshot.companySignatureDataUrl || "",
  );
  const [busy, setBusy] = useState(false);
  const [signatureHighlight, setSignatureHighlight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);

  function focusCompanySignature() {
    const target = signatureRef.current;
    const scroller = scrollRef.current;
    if (target && scroller) {
      const scrollerTop = scroller.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top;
      scroller.scrollTo({
        top: scroller.scrollTop + (targetTop - scrollerTop) - 24,
        behavior: "smooth",
      });
    } else {
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setSignatureHighlight(true);
    window.setTimeout(() => setSignatureHighlight(false), 2200);
    toast.error("Sign for the company on page 2 before sending.");
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="max-h-[68vh] overflow-y-auto bg-[#eef1f5] px-4 py-5"
      >
        <EstimatePdfDocument
          snapshot={snapshot}
          companySlot={
            <div
              ref={signatureRef}
              className={cn(
                "rounded-md transition-[box-shadow,background-color] duration-300",
                signatureHighlight &&
                  "bg-amber-50/80 ring-2 ring-amber-400 ring-offset-2 ring-offset-white",
              )}
            >
              <SignaturePadField
                name={signer}
                onName={setSigner}
                pad={companyPad}
                image={keptImage}
                onClearImage={() => setKeptImage("")}
                showNameInput
                caption="Authorized company signature (required)"
                date={
                  snapshot.companySignedAt || new Date().toISOString()
                }
              />
            </div>
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
            const image = companyPad.dirty
              ? companyPad.toImage()
              : keptImage;
            if (!signer.trim() || !image) {
              focusCompanySignature();
              return;
            }
            setBusy(true);
            void Promise.resolve(
              onSend({
                ...snapshot,
                companySignedBy: signer.trim(),
                companySignedAt:
                  companyPad.dirty || !snapshot.companySignedAt
                    ? new Date().toISOString()
                    : snapshot.companySignedAt,
                companySignatureDataUrl: image,
              }),
            ).finally(() => setBusy(false));
          }}
        >
          {busy && busyLabel ? busyLabel : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
