"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";
import { postData } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import { Button } from "@/components/ui/button";
import { REGISTRATION_OTP_LENGTH } from "@/lib/auth/pending-registration";
import { cn } from "@/lib/utils";

const OTP_LENGTH = REGISTRATION_OTP_LENGTH;
const RESEND_SECONDS = 30;

function OtpBoxes({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || "");

  function focusAt(index: number) {
    const el = inputsRef.current[index];
    if (!el) return;
    el.focus();
    el.select();
  }

  function updateDigit(index: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1);
    const next = digits.map((d, i) => (i === index ? char : d));
    onChange(next.join("").slice(0, OTP_LENGTH));
    if (char && index < OTP_LENGTH - 1) focusAt(index + 1);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        onChange(digits.map((d, i) => (i === index ? "" : d)).join(""));
        return;
      }
      if (index > 0) {
        onChange(digits.map((d, i) => (i === index - 1 ? "" : d)).join(""));
        focusAt(index - 1);
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusAt(index - 1);
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusAt(index + 1);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    onChange(pasted);
    focusAt(Math.min(pasted.length, OTP_LENGTH - 1));
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          onFocus={(event) => event.currentTarget.select()}
          className={cn(
            "h-12 w-10 rounded-xl border-2 text-center text-xl font-semibold text-foreground outline-none transition-all sm:h-14 sm:w-12 sm:rounded-2xl sm:text-2xl",
            digit
              ? "border-primary bg-primary/5 shadow-[0_0_0_3px_rgba(0,63,125,0.12)]"
              : "border-input bg-[#f7f9fc]",
            "focus:border-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,63,125,0.18)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
      ))}
    </div>
  );
}

export function PhoneOtpVerificationPanel({
  phone,
  email,
  onVerified,
  onBack,
}: {
  phone: string;
  email: string;
  onVerified: () => void | Promise<void>;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setResendSeconds((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit verification code.`);
      return;
    }

    setLoading(true);
    try {
      await postData(
        authApi.verifyPhoneOtp,
        { phone, code: otp },
        { token: null, skipLogoutOn401: true, silent: true },
      );
      toast.success("Phone verified.");
      try {
        await onVerified();
      } catch {
        // Quote/request errors are toasted by the parent flow.
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invalid verification code.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (resendSeconds > 0 || loading) return;
    setLoading(true);
    try {
      const response = await postData<{ message?: string }>(
        authApi.sendPhoneOtp,
        { phone, email },
        { token: null, skipLogoutOn401: true, silent: true },
      );
      setOtp("");
      setResendSeconds(RESEND_SECONDS);
      toast.success(
        response?.message ||
          "Verification code sent. Check your email.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not resend verification code.",
      );
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = otp.length === OTP_LENGTH && !loading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          Verify phone number
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Enter the {OTP_LENGTH}-digit code we emailed you.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        {email ? (
          <div className="flex items-center gap-3 rounded-2xl border border-input bg-[#f4f7fb] px-4 py-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Mail className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Code sent to
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {email}
              </p>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-input bg-white px-4 py-6 sm:px-6">
          <p className="mb-5 text-center text-sm font-semibold text-foreground">
            Enter verification code
          </p>
          <OtpBoxes value={otp} onChange={setOtp} disabled={loading} />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="xl"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!canSubmit}
          >
            {loading ? "Submitting…" : "Submit"}
            {!loading ? <ArrowRight data-icon="inline-end" /> : null}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Didn’t get a code?{" "}
          <button
            type="button"
            className={cn(
              "font-semibold text-primary hover:text-primary/80",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
            onClick={() => void onResend()}
            disabled={loading || resendSeconds > 0}
          >
            {resendSeconds > 0
              ? `Resend in ${resendSeconds}s`
              : "Resend code"}
          </button>
        </p>

        <button
          type="button"
          className="text-center text-sm font-semibold text-primary hover:text-primary/80"
          onClick={onBack}
          disabled={loading}
        >
          Back to contact details
        </button>
      </form>
    </div>
  );
}
