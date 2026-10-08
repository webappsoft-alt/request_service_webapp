"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  Info,
  Lock,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { postData, showApiErrorToast } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { technicianPaths } from "@/lib/technician-paths";
import { useAppDispatch } from "@/store/hooks";
import { clearAuthError, setAuthLoading, setCredentials, toAuthCredentials } from "@/store/authSlice";

const FEATURES = [
  { icon: ClipboardCheck, title: "Your jobs", text: "Every assigned job and estimate visit with what it needs." },
  { icon: CalendarClock, title: "Schedule", text: "Today's work and what's next, with directions." },
  { icon: Clock3, title: "Time & pay", text: "Clock in on the job and see what you've earned." },
];

function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--tech-sidebar-accent)] to-[var(--tech-accent)] text-white shadow-lg shadow-indigo-900/30">
        <Wrench className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className={light ? "block text-sm font-semibold text-white" : "block text-sm font-semibold text-slate-900"}>
          Request Service
        </span>
        <span className="block text-[10px] font-semibold tracking-[0.18em] text-[var(--tech-sidebar-accent)] uppercase">
          Technician portal
        </span>
      </span>
    </div>
  );
}

/**
 * Technician-only sign in. The API rejects non-technician accounts here
 * (`expectedRole: "technician"`) and technician accounts on the Pro login.
 */
export function TechnicianLoginView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    dispatch(clearAuthError());
    setSubmitting(true);
    dispatch(setAuthLoading(true));
    try {
      const data = await postData(
        authApi.login,
        { email: email.trim(), password, expectedRole: "technician" },
        { silent: true, skipLogoutOn401: true },
      );
      const credentials = toAuthCredentials(data);
      if (!credentials) {
        showApiErrorToast("Login succeeded but session data was incomplete.");
        return;
      }
      dispatch(setCredentials(credentials));
      toast.success("Signed in to your technician portal.");
      router.replace(technicianPaths.dashboard);
    } catch (error) {
      showApiErrorToast(error, "Invalid email or password.");
    } finally {
      setSubmitting(false);
      dispatch(setAuthLoading(false));
    }
  }

  return (
    <div className="technician-theme grid min-h-svh bg-[var(--tech-bg)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Showcase panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[var(--tech-sidebar)] via-[var(--tech-sidebar-2)] to-[#07071a] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-[28rem] rounded-full bg-[var(--tech-sidebar-accent)]/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgb(255_255_255)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255)_1px,transparent_1px)] [background-size:40px_40px]"
        />

        <div className="relative">
          <BrandMark light />
        </div>

        <div className="relative flex flex-col gap-10">
          <div className="max-w-md">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight text-white xl:text-4xl">
              Your jobs, schedule, and hours in one place.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Built for the field team of companies on Request Service.
            </p>
          </div>
          <ul className="grid max-w-lg gap-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex flex-col gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/[0.08] text-[var(--tech-sidebar-accent)]">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs leading-relaxed text-slate-400">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">Your login is set up by the company you work for.</p>
      </aside>

      {/* Sign-in */}
      <main id="main-content" className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_40px_-12px_rgb(15_23_42_/_0.15)] sm:p-8">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--tech-accent)] uppercase">Technician sign in</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500">Sign in with the username (or email) and password your company gave you.</p>

            <form onSubmit={onSubmit} className="mt-7">
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="technician-login">Username or email</FieldLabel>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                    <Input
                      id="technician-login"
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Your username"
                      className="h-11 rounded-xl bg-slate-50/60 pl-10"
                      required
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="technician-password">Password</FieldLabel>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                    <PasswordInput
                      id="technician-password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Your password"
                      className="h-11 rounded-xl bg-slate-50/60 pl-10"
                      required
                    />
                  </div>
                </Field>
                <Button
                  type="submit"
                  className="group h-11 w-full rounded-xl bg-[var(--tech-accent)] text-[15px] hover:bg-[var(--tech-accent-hover)]"
                  disabled={!canSubmit}
                >
                  {submitting ? <Spinner size="sm" className="text-current" label="Signing in" /> : null}
                  {submitting ? "Signing in…" : "Sign in"}
                  {!submitting ? <ArrowRight className="transition-transform group-hover:translate-x-0.5" /> : null}
                </Button>
              </FieldGroup>
            </form>

            <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-[var(--tech-accent-soft)] px-3.5 py-3 text-xs leading-relaxed text-slate-600">
              <Info className="mt-0.5 size-4 shrink-0 text-[var(--tech-accent)]" aria-hidden />
              <span>
                <span className="font-medium text-slate-800">Forgot your password?</span> Ask your company to reset your
                portal access.
              </span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Only technicians added by a company on Request Service can sign in here.
          </p>
        </div>
      </main>
    </div>
  );
}
