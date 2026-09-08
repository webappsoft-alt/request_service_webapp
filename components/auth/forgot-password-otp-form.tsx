"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import {
  clearPasswordResetSession,
  readPasswordResetEmail,
  savePasswordResetEmail,
  savePasswordResetToken,
} from "@/components/auth/password-reset-session";
import { Button } from "@/components/ui/button";
import { postData, showApiErrorToast } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import type { DemoRole } from "@/lib/auth/demo-session";
import { REGISTRATION_OTP_LENGTH } from "@/lib/auth/pending-registration";
import { cn } from "@/lib/utils";

/** Password-reset OTP is 4 digits (matches registration OTP). */
const OTP_LENGTH = REGISTRATION_OTP_LENGTH;

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
              : "border-[#d7dee8] bg-[#f7f9fc]",
            "focus:border-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,63,125,0.18)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
      ))}
    </div>
  );
}

export function ForgotPasswordOtpForm({ role }: { role: DemoRole }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isProvider = role === "provider";

  const emailFromQuery = searchParams.get("email")?.trim() || "";
  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const forgotHref = isProvider ? "/pro/forgot-password" : "/forgot-password";
  const resetHref = isProvider ? "/pro/reset-password" : "/reset-password";
  const loginHref = isProvider ? "/pro/login" : "/login";

  useEffect(() => {
    const stored = readPasswordResetEmail();
    const next = emailFromQuery || stored;
    if (!next) {
      toast.error("Enter your email to receive a password reset code.");
      router.replace(forgotHref);
      return;
    }
    setEmail(next);
    savePasswordResetEmail(next);
  }, [emailFromQuery, forgotHref, router]);

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
    if (!email) return;
    if (otp.length !== OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }

    setLoading(true);
    try {
      const data = await postData<{
        message?: string;
        token?: string;
        success?: boolean;
      }>(
        authApi.verifyForgotOtp,
        { code: otp },
        { silent: true, skipLogoutOn401: true },
      );

      if (!data?.token) {
        showApiErrorToast("OTP verified but no reset token was returned.");
        return;
      }

      savePasswordResetToken(data.token, email);
      toast.success(
        (typeof data.message === "string" && data.message) ||
          "OTP verified. Choose a new password.",
      );
      router.replace(resetHref);
    } catch (error) {
      showApiErrorToast(error, "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!email || resendSeconds > 0) return;
    setLoading(true);
    try {
      const data = await postData<{ message?: string }>(
        authApi.forgotPassword,
        { email },
        { silent: true, skipLogoutOn401: true },
      );
      setOtp("");
      setResendSeconds(60);
      toast.success(
        data?.message || "Password reset OTP sent to your email",
      );
    } catch (error) {
      showApiErrorToast(error, "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  }

  const canVerify = otp.length === OTP_LENGTH && !loading && Boolean(email);

  return (
    <AuthShell
      audience={role}
      eyebrow={isProvider ? "Service companies" : "Homeowners"}
      title="Verify reset code"
      description={`Enter the ${OTP_LENGTH}-digit code we emailed you.`}
      footer={
        <>
          Return to{" "}
          <Link
            href={loginHref}
            className={authLinkClass}
            onClick={() => clearPasswordResetSession()}
          >
            {isProvider ? "provider login" : "customer login"}
          </Link>
          .
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        {email ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[#d7dee8] bg-[#f4f7fb] px-4 py-3.5">
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

        <div className="rounded-2xl border border-[#e6ebf2] bg-white px-4 py-6 sm:px-6">
          <p className="mb-5 text-center text-sm font-semibold text-foreground">
            Enter password reset code
          </p>
          <OtpBoxes value={otp} onChange={setOtp} disabled={loading} />
        </div>

        <Button
          type="submit"
          size="xl"
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!canVerify}
        >
          {loading ? "Verifying…" : "Verify code"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Didn’t get a code?{" "}
          <button
            type="button"
            className={cn(
              authLinkClass,
              "disabled:pointer-events-none disabled:opacity-50",
            )}
            onClick={onResend}
            disabled={loading || resendSeconds > 0 || !email}
          >
            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
          </button>
        </p>
      </form>
    </AuthShell>
  );
}
