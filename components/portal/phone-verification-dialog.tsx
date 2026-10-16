"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { OtpBoxes } from "@/components/auth/otp-verification-form";
import { postData, refreshAuthMe, showApiErrorToast } from "@/components/api/apiFuntions";
import { providerApi } from "@/components/api/ApiRoutesFile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { phoneDigits } from "@/lib/auth/phone-verification";
import { REGISTRATION_OTP_LENGTH } from "@/lib/auth/pending-registration";

type SendResponse = { maskedPhone?: string; resendInSeconds?: number };

export type PhoneVerificationDialogProps = {
  open: boolean;
  /** Number to prefill (and, with `lockPhone`, the only number allowed). */
  initialPhone?: string;
  /** Profile phone change: the number was already chosen in the form. */
  lockPhone?: boolean;
  /** Gate mode: no close button, Esc or outside click. */
  dismissible?: boolean;
  title?: string;
  description?: string;
  onCancel?: () => void;
  /** Called after the backend saved the number as verified and auth was refreshed. */
  onVerified: (phone: string) => void;
  /** Extra footer content, e.g. a sign-out link in gate mode. */
  footer?: React.ReactNode;
  /** Backdrop classes, e.g. a stronger blur when the dashboard shows through. */
  overlayClassName?: string;
};

export function PhoneVerificationDialog({
  open,
  initialPhone = "",
  lockPhone = false,
  dismissible = true,
  title = "Verify your phone number",
  description = "We'll text a 4-digit code to confirm this number belongs to your business.",
  onCancel,
  onVerified,
  footer,
  overlayClassName,
}: PhoneVerificationDialogProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // State starts from `initialPhone`; mount a fresh dialog (or change its key) for a new number.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    if (phoneDigits(phone).length < 10) {
      toast.error("Enter a valid mobile number");
      return;
    }
    setSending(true);
    try {
      const res = await postData<SendResponse>(providerApi.phoneSendOtp, { phone }, { silent: true });
      setMaskedPhone(res?.maskedPhone || phone);
      setResendIn(Number(res?.resendInSeconds) || 60);
      setCode("");
      setStep("code");
    } catch (error) {
      showApiErrorToast(error, "Could not send the code.");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    if (code.length !== REGISTRATION_OTP_LENGTH) {
      toast.error("Enter the 4-digit code");
      return;
    }
    setVerifying(true);
    try {
      const res = await postData<{ phone?: string }>(
        providerApi.phoneVerify,
        { phone, code },
        { silent: true },
      );
      // Pull the saved number + isPhoneVerified into the auth store.
      await refreshAuthMe().catch(() => null);
      toast.success("Phone number verified");
      onVerified(res?.phone || phone);
    } catch (error) {
      setCode("");
      showApiErrorToast(error, "That code didn't work.");
    } finally {
      setVerifying(false);
    }
  }

  const blockClose = (event: Event) => {
    if (!dismissible) event.preventDefault();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && dismissible) onCancel?.();
      }}
    >
      <DialogContent
        showCloseButton={dismissible}
        onEscapeKeyDown={blockClose}
        onPointerDownOutside={blockClose}
        onInteractOutside={blockClose}
        overlayClassName={overlayClassName}
        className="sm:max-w-md shadow-2xl"
      >
        <DialogHeader className="items-center text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {step === "phone" ? <Smartphone className="size-6" /> : <ShieldCheck className="size-6" />}
          </div>
          <DialogTitle className="text-lg">{step === "phone" ? title : "Enter the code"}</DialogTitle>
          <DialogDescription>
            {step === "phone" ? description : `We texted a 4-digit code to ${maskedPhone}. It expires in 5 minutes.`}
          </DialogDescription>
        </DialogHeader>

        {step === "phone" ? (
          <div className="space-y-4">
            <AuthPhoneInput
              id="verify-phone"
              value={phone}
              onChange={setPhone}
              disabled={lockPhone || sending}
              placeholder="Enter mobile number"
            />
            <Button type="button" className="w-full" onClick={sendCode} disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : null}
              Text me a code
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <OtpBoxes value={code} onChange={setCode} disabled={verifying} />
            <Button
              type="button"
              className="w-full"
              onClick={verifyCode}
              disabled={verifying || code.length !== REGISTRATION_OTP_LENGTH}
            >
              {verifying ? <Loader2 className="size-4 animate-spin" /> : null}
              Verify
            </Button>
            <div className="flex items-center justify-between text-xs">
              {lockPhone ? (
                <span />
              ) : (
                <button
                  type="button"
                  className="font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setStep("phone")}
                  disabled={verifying}
                >
                  Change number
                </button>
              )}
              <button
                type="button"
                className="font-medium text-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
                onClick={sendCode}
                disabled={resendIn > 0 || sending || verifying}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </div>
        )}

        {footer ? <div className="border-t pt-3 text-center text-xs text-muted-foreground">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
