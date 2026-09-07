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
import { Button } from "@/components/ui/button";
import { useAppDispatch } from "@/store/hooks";
import { setCredentials, type AuthPayload } from "@/store/authSlice";
import { postData, showApiErrorToast } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import { cn } from "@/lib/utils";

const PENDING_KEY = "rs-pending-registration";
const OTP_LENGTH = 4;

type PendingRegistration = Record<string, unknown> & { email?: string };

function readPending(): PendingRegistration | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingRegistration;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

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
    const joined = next.join("").slice(0, OTP_LENGTH);
    onChange(joined);
    if (char && index < OTP_LENGTH - 1) {
      focusAt(index + 1);
    }
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        const next = digits.map((d, i) => (i === index ? "" : d));
        onChange(next.join(""));
        return;
      }
      if (index > 0) {
        const next = digits.map((d, i) => (i === index - 1 ? "" : d));
        onChange(next.join(""));
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
    <div className="flex items-center justify-center gap-3 sm:gap-4">
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
            "h-16 w-14 rounded-2xl border-2 text-center text-2xl font-semibold text-foreground outline-none transition-all sm:h-[4.25rem] sm:w-[3.75rem]",
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

export function OtpVerificationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  const emailFromQuery = searchParams.get("email")?.trim() || "";
  const [pending, setPending] = useState<PendingRegistration | null>(null);
  const email = emailFromQuery || pending?.email || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    setPending(readPending());
  }, []);

  useEffect(() => {
    if (!emailFromQuery && !readPending()?.email) {
      toast.error("Start registration again to receive a verification code.");
      router.replace("/register");
    }
  }, [emailFromQuery, router]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setResendSeconds((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function finalizeAccount(code: string) {
    if (!email) return;
    setLoading(true);
    try {
      const data = await postData<AuthPayload>(
        authApi.verifyOtp,
        { email, code, autoRegister: true },
        { silent: true, skipLogoutOn401: true },
      );

      if (data?.token && data?.user) {
        dispatch(setCredentials(data));
        clearPending();
        toast.success(
          (typeof data.message === "string" && data.message) ||
            "Email verified. You’re signed in.",
        );
        router.replace("/");
        return;
      }

      if (data?.verificationToken) {
        const registered = await postData<AuthPayload>(
          authApi.register,
          {
            email: (typeof data.email === "string" && data.email) || email,
            verificationToken: data.verificationToken,
          },
          { silent: true, skipLogoutOn401: true },
        );

        if (registered?.token && registered?.user) {
          dispatch(setCredentials(registered));
          clearPending();
          toast.success(
            (typeof registered.message === "string" && registered.message) ||
              "Account created. You’re signed in.",
          );
          router.replace("/");
          return;
        }
      }

      showApiErrorToast("OTP verification response was incomplete.");
    } catch (error) {
      showApiErrorToast(error, "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }
    await finalizeAccount(otp);
  }

  async function onResend() {
    const draft = pending || readPending();
    if (!draft || resendSeconds > 0) return;
    setLoading(true);
    try {
      const data = await postData<{ message?: string }>(
        authApi.sendOtp,
        draft,
        { silent: true, skipLogoutOn401: true },
      );
      setPending(draft);
      setOtp("");
      setResendSeconds(60);
      toast.success(data?.message || "A new code was sent to your email.");
    } catch (error) {
      showApiErrorToast(error, "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  }

  const canResend = Boolean(pending || readPending());
  const canVerify = otp.length === OTP_LENGTH && !loading;

  return (
    <AuthShell
      audience="customer"
      eyebrow="Homeowners"
      title="Verify your email"
      description={
        email ? (
          <>
            We emailed a {OTP_LENGTH}-digit code to{" "}
            <span className="font-semibold text-foreground">{email}</span>.
          </>
        ) : (
          `Enter the ${OTP_LENGTH}-digit code from your email.`
        )
      }
      footer={
        <>
          Wrong email?{" "}
          <Link href="/register" className={authLinkClass}>
            Go back to sign up
          </Link>
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
            Enter verification code
          </p>
          <OtpBoxes value={otp} onChange={setOtp} disabled={loading} />
        </div>

        <Button
          type="submit"
          size="xl"
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!canVerify}
        >
          {loading ? "Verifying…" : "Verify and continue"}
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
            disabled={!canResend || loading || resendSeconds > 0}
          >
            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
          </button>
        </p>
      </form>
    </AuthShell>
  );
}
