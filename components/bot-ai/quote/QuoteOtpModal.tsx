"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareText, Smartphone } from "lucide-react";
import { extractErrorMessage, postData } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import { OTP_LENGTH, OtpBoxes } from "@/components/marketplace/phone-otp-verification-panel";
import { Button } from "@/components/ui/button";
import { maskPhone, OTP_RESEND_SECONDS } from "@/lib/auth/pending-registration";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  elevatedModalAccent,
  elevatedModalButton,
  elevatedModalContent,
  elevatedModalOverlay,
} from "@/lib/modal-styles";
import { cn } from "@/lib/utils";


type Stage = "code" | "verifying" | "submitting";

/** Backend message (e.g. "OTP expired. Please request a new one.") instead of the HTTP status text. */
function errorMessage(error: unknown, fallback: string) {
  const message = extractErrorMessage(error);
  return message && !/^Request failed with status code/i.test(message) ? message : fallback;
}

/**
 * Phone verification + quote submission, on top of the page and the chat.
 * Reuses the existing endpoints: auth/verify-phone-otp, auth/send-phone-otp, then the
 * caller's submit (public/quote-requests). Once verified, a failed submit can be retried
 * without asking for a new code.
 */
export function QuoteOtpModal({
  open,
  onOpenChange,
  phone,
  email,
  onSubmitVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  email: string;
  /** Runs after the code is verified. Throw to keep the modal open with an error. */
  onSubmitVerified: () => Promise<void>;
}) {
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<Stage>("code");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(OTP_RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [sessionKey, setSessionKey] = useState({ open, phone });

  // Fresh state each time the modal opens for a (new) phone number.
  if (sessionKey.open !== open || sessionKey.phone !== phone) {
    setSessionKey({ open, phone });
    if (open) {
      setOtp("");
      setStage("code");
      setVerified(false);
      setError("");
      setResendIn(OTP_RESEND_SECONDS);
    }
  }

  useEffect(() => {
    if (!open || resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [open, resendIn]);

  const busy = stage !== "code" || resending;

  async function submit() {
    setStage("submitting");
    try {
      await onSubmitVerified();
      onOpenChange(false);
    } catch (submitError) {
      setError(
        `Your phone is verified, but the request couldn't be sent: ${errorMessage(submitError, "please try again.")}`,
      );
      setStage("code");
    }
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (verified) {
      await submit();
      return;
    }
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setStage("verifying");
    try {
      await postData(
        authApi.verifyPhoneOtp,
        { phone, code: otp },
        { token: null, skipLogoutOn401: true, silent: true },
      );
      setVerified(true);
    } catch (verifyError) {
      const message = errorMessage(verifyError, "Invalid verification code.");
      setError(message);
      setOtp("");
      // Expired / too many attempts: allow an immediate resend.
      if (/expired|no active code|too many/i.test(message)) setResendIn(0);
      setStage("code");
      return;
    }
    await submit();
  }

  async function onResend() {
    if (resendIn > 0 || busy) return;
    setResending(true);
    setError("");
    try {
      const response = await postData<{ resendInSeconds?: number }>(
        authApi.sendPhoneOtp,
        { phone, email },
        { token: null, skipLogoutOn401: true, silent: true },
      );
      setOtp("");
      setVerified(false);
      setResendIn(response?.resendInSeconds ?? OTP_RESEND_SECONDS);
    } catch (resendError) {
      setError(errorMessage(resendError, "Could not resend the code."));
    } finally {
      setResending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (stage === "submitting" ? undefined : onOpenChange(next))}>
      {/* Above the AI assistant panel (z-61). */}
      <DialogContent overlayClassName={elevatedModalOverlay} className={cn(elevatedModalContent, "sm:max-w-sm")}>
        <span aria-hidden className={elevatedModalAccent} />
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-linear-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
            <Smartphone className="size-5" aria-hidden />
          </span>
          <DialogTitle className="text-lg font-semibold">Confirm Verification Code</DialogTitle>
          {/* send-phone-otp texts the code (same as /get-a-quote). */}
          <DialogDescription className="text-sm leading-relaxed">
            Enter the {OTP_LENGTH}-digit code sent via text to{" "}
            <span className="font-semibold whitespace-nowrap text-foreground">{maskPhone(phone)}</span> to confirm your
            service request.
          </DialogDescription>
          <p className="flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-foreground/80">
            <MessageSquareText className="size-3.5 text-primary" aria-hidden />
            Sent to <span className="whitespace-nowrap">{phone}</span> · expires in 5 minutes
          </p>
        </div>

        <form onSubmit={onVerify} className="flex flex-col gap-4">
          <div
            className={cn(
              "rounded-2xl border bg-card px-3 py-5 shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10",
              verified && "opacity-60",
            )}
          >
            {verified ? (
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" aria-hidden />
                Phone verified
              </p>
            ) : (
              <OtpBoxes value={otp} onChange={setOtp} disabled={busy} />
            )}
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className={elevatedModalButton}
            disabled={busy || (!verified && otp.length !== OTP_LENGTH)}
          >
            {stage !== "code" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {stage === "verifying"
              ? "Verifying…"
              : stage === "submitting"
                ? "Sending your request…"
                : verified
                  ? "Try sending again"
                  : "Verify & Submit Quote"}
          </Button>

          {!verified ? (
            <p className="text-center text-xs text-muted-foreground">
              Didn&apos;t get a code?{" "}
              <button
                type="button"
                onClick={() => void onResend()}
                disabled={busy || resendIn > 0}
                className="font-semibold text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
              >
                {resending ? "Sending…" : resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
