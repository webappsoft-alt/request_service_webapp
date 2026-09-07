"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import { useDemoSession } from "@/components/auth/use-demo-session";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";
import { Input } from "@/components/ui/input";
import type { DemoRole } from "@/lib/auth/demo-session";
import { getAllProviders } from "@/lib/data/providers";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "forgot" | "reset";

function copyFor(role: DemoRole, mode: AuthMode) {
  switch (mode) {
    case "login":
      return role === "provider"
        ? {
            eyebrow: "Service companies",
            title: "Provider login",
            description: "Sign in to manage your business profile, services, and incoming requests.",
          }
        : {
            eyebrow: "Homeowners",
            title: "Welcome back",
            description: "Sign in to review estimates, message pros, and keep your job history in one place.",
          };
    case "forgot":
      return {
        eyebrow: role === "provider" ? "Service companies" : "Homeowners",
        title: "Forgot password",
        description: "Enter the email on the account. We’ll send a reset link you can open on the next screen.",
      };
    case "reset":
      return {
        eyebrow: role === "provider" ? "Service companies" : "Homeowners",
        title: "Choose a new password",
        description: "Use a password you haven’t used here before. You’ll sign in again after this.",
      };
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

export function AuthForm({
  role,
  mode,
}: {
  role: DemoRole;
  mode: AuthMode;
}) {
  const router = useRouter();
  const { signIn } = useDemoSession();
  const isProvider = role === "provider";
  const copy = copyFor(role, mode);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  let canSubmit = false;
  switch (mode) {
    case "login":
      canSubmit = email.trim().length > 0 && password.length > 0;
      break;
    case "forgot":
      canSubmit = email.trim().length > 0;
      break;
    case "reset":
      canSubmit = password.length > 0 && confirmPassword.length > 0;
      break;
    default: {
      const _never: never = mode;
      return _never;
    }
  }

  const loginHref = isProvider ? "/pro/login" : "/login";
  const registerHref = isProvider ? "/pro/register" : "/register";
  const forgotHref = isProvider ? "/pro/forgot-password" : "/forgot-password";
  const resetHref = isProvider ? "/pro/reset-password" : "/reset-password";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");

    switch (mode) {
      case "login": {
        const matched = isProvider
          ? getAllProviders().find((item) => item.email.toLowerCase() === email.toLowerCase())
          : undefined;
        const firstName =
          matched?.contact?.name.split(" ")[0] ||
          email.split("@")[0] ||
          "There";
        signIn({
          role,
          firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
          lastName: matched?.contact?.name.split(" ").slice(1).join(" ") ?? "",
          email,
          companyName: isProvider ? matched?.companyName ?? "Your company" : undefined,
        });
        toast.success(isProvider ? "Signed in to your business account." : "Welcome back.");
        router.push(isProvider ? "/pro/dashboard" : "/");
        return;
      }
      case "forgot":
        setSent(true);
        return;
      case "reset":
        if (password.length < 8) {
          toast.error("Use at least 8 characters.");
          return;
        }
        if (password !== confirm) {
          toast.error("Passwords do not match.");
          return;
        }
        toast.success("Password updated. Sign in to continue.");
        router.push(loginHref);
        return;
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
      {mode === "forgot" && sent ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg border border-foreground/25 bg-muted/40 px-4 py-3 text-sm leading-6">
            If an account exists for that email, a reset link is ready. This demo opens the reset
            page directly.
          </p>
          <Button size="xl" asChild>
            <Link href={resetHref}>Open reset page</Link>
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
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "reset" ? "At least 8 characters" : "Your password"}
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

          <Button type="submit" size="xl" disabled={!canSubmit}>
            {mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
