"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import {
  clearPasswordResetSession,
  readPasswordResetToken,
  savePasswordResetEmail,
} from "@/components/auth/password-reset-session";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";
import { Input } from "@/components/ui/input";
import type { DemoRole } from "@/lib/auth/demo-session";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/store/hooks";
import {
  clearAuthError,
  setAuthLoading,
  setCredentials,
  toAuthCredentials,
} from "@/store/authSlice";
import {
  postData,
  putData,
  showApiErrorToast,
} from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";

type AuthMode = "login" | "forgot" | "reset";

function copyFor(role: DemoRole, mode: AuthMode) {
  switch (mode) {
    case "login":
      return role === "provider"
        ? {
            eyebrow: "Service companies",
            title: "Provider login",
            description:
              "Sign in to manage your business profile, services, and incoming requests.",
          }
        : {
            eyebrow: "Homeowners",
            title: "Welcome back",
            description:
              "Sign in to review estimates, message pros, and keep your job history in one place.",
          };
    case "forgot":
      return {
        eyebrow: role === "provider" ? "Service companies" : "Homeowners",
        title: "Forgot password",
        description:
          "Enter the email on your account. We’ll send a 4-digit code to verify it’s you.",
      };
    case "reset":
      return {
        eyebrow: role === "provider" ? "Service companies" : "Homeowners",
        title: "Choose a new password",
        description:
          "Use a password you haven’t used here before. You’ll sign in again after this.",
      };
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

function AuthFormInner({
  role,
  mode,
}: {
  role: DemoRole;
  mode: AuthMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const isProvider = role === "provider";
  const copy = copyFor(role, mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetTokenFromQuery = searchParams.get("token")?.trim() || "";
  const resetToken = resetTokenFromQuery || readPasswordResetToken();

  let canSubmit = false;
  switch (mode) {
    case "login":
      canSubmit = email.trim().length > 0 && password.length > 0;
      break;
    case "forgot":
      canSubmit = email.trim().length > 0;
      break;
    case "reset":
      canSubmit =
        password.length > 0 &&
        confirmPassword.length > 0 &&
        Boolean(resetToken);
      break;
    default: {
      const _never: never = mode;
      return _never;
    }
  }

  const loginHref = isProvider ? "/pro/login" : "/login";
  const registerHref = isProvider ? "/pro/register" : "/register";
  const forgotHref = isProvider ? "/pro/forgot-password" : "/forgot-password";
  const verifyForgotHref = isProvider
    ? "/pro/verify-forgot-otp"
    : "/verify-forgot-otp";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch(clearAuthError());

    switch (mode) {
      case "login": {
        setSubmitting(true);
        dispatch(setAuthLoading(true));
        try {
          const data = await postData(
            authApi.login,
            {
              email: email.trim(),
              password,
              expectedRole: isProvider ? "provider" : "customer",
            },
            { silent: true, skipLogoutOn401: true },
          );

          const credentials = toAuthCredentials(data);
          if (!credentials) {
            showApiErrorToast("Login succeeded but session data was incomplete.");
            return;
          }

          dispatch(setCredentials(credentials));
          toast.success(
            (typeof credentials.message === "string" && credentials.message) ||
              (isProvider
                ? "Signed in to your business account."
                : "Welcome back."),
          );
          router.push(isProvider ? proPaths.dashboard : "/");
        } catch (error) {
          showApiErrorToast(error, "Invalid email or password.");
        } finally {
          setSubmitting(false);
          dispatch(setAuthLoading(false));
        }
        return;
      }
      case "forgot": {
        const trimmedEmail = email.trim();
        setSubmitting(true);
        try {
          const data = await postData<{ message?: string; code?: string }>(
            authApi.forgotPassword,
            { email: trimmedEmail },
            { silent: true, skipLogoutOn401: true },
          );
          savePasswordResetEmail(trimmedEmail);
          toast.success(
            data?.message || "Password reset OTP sent to your email",
          );
          router.push(
            `${verifyForgotHref}?email=${encodeURIComponent(trimmedEmail)}`,
          );
        } catch (error) {
          showApiErrorToast(error);
        } finally {
          setSubmitting(false);
        }
        return;
      }
      case "reset": {
        if (password.length < 8) {
          toast.error("Use at least 8 characters.");
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match.");
          return;
        }
        if (!resetToken) {
          toast.error("Reset session expired. Request a new code.");
          router.replace(forgotHref);
          return;
        }

        setSubmitting(true);
        try {
          const data = await putData<{ message?: string }>(
            authApi.updatePasswordReset,
            {
              newPassword: password,
              confirmPassword,
            },
            {
              silent: true,
              skipLogoutOn401: true,
              token: resetToken,
            },
          );
          clearPasswordResetSession();
          toast.success(
            data?.message || "Password updated successfully",
          );
          router.push(loginHref);
        } catch (error) {
          showApiErrorToast(error);
        } finally {
          setSubmitting(false);
        }
        return;
      }
      default: {
        const _never: never = mode;
        return _never;
      }
    }
  }

  return (
    <AuthShell
      audience={role}
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      footer={
        mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href={registerHref} className={authLinkClass}>
              Sign up
            </Link>
          </>
        ) : (
          <>
            Return to{" "}
            <Link href={loginHref} className={authLinkClass}>
              {isProvider ? "provider login" : "customer login"}
            </Link>
            .
          </>
        )
      }
    >
      {mode === "reset" && !resetToken ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg border border-foreground/25 bg-muted/40 px-4 py-3 text-sm leading-6">
            Your password reset session expired or is missing. Request a new
            code to continue.
          </p>
          <Button size="xl" asChild>
            <Link href={forgotHref}>Request a new code</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            {mode !== "reset" ? (
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
            ) : null}

            {mode === "login" || mode === "reset" ? (
              <Field>
                <FieldLabel htmlFor="password">
                  {mode === "reset" ? "New password" : "Password"}
                </FieldLabel>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "reset" ? "At least 8 characters" : "Your password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>
            ) : null}

            {mode === "reset" ? (
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                <PasswordInput
                  id="confirm-password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <FieldDescription>Must match the password above.</FieldDescription>
              </Field>
            ) : null}
          </FieldGroup>

          {mode === "login" ? (
            <div className="flex justify-end">
              <Link href={forgotHref} className={cn("text-sm", authLinkClass)}>
                Forgot password
              </Link>
            </div>
          ) : null}

          <Button type="submit" size="xl" disabled={!canSubmit || submitting}>
            {submitting
              ? mode === "login"
                ? "Signing in…"
                : mode === "forgot"
                  ? "Sending…"
                  : "Updating…"
              : mode === "login"
                ? "Sign in"
                : mode === "forgot"
                  ? "Send reset code"
                  : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function AuthForm({
  role,
  mode,
}: {
  role: DemoRole;
  mode: AuthMode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AuthFormInner role={role} mode={mode} />
    </Suspense>
  );
}
