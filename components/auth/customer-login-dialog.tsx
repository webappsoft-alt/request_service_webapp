"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { postData, showApiErrorToast } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import { useAppDispatch } from "@/store/hooks";
import {
  clearAuthError,
  setAuthLoading,
  setCredentials,
  toAuthCredentials,
  type AuthUser,
} from "@/store/authSlice";

type LoginDialogOptions = {
  /** Short reason shown under the title (e.g. "Sign in to book this service"). */
  reason?: string;
  /** Where "Create account" should return to after registration. */
  registerNext?: string;
  /** Runs after Redux auth is updated, before the dialog closes. */
  onSuccess?: (user: AuthUser | undefined) => void;
};

type LoginDialogContextValue = {
  openLogin: (options?: LoginDialogOptions) => void;
};

const LoginDialogContext = createContext<LoginDialogContextValue | null>(null);

/**
 * Website-level customer sign-in modal. Same API and Redux flow as /login, but the
 * page stays put: no navigation, no reload. Mounted once in the marketing shell.
 */
export function CustomerLoginDialogProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LoginDialogOptions>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const optionsRef = useRef<LoginDialogOptions>({});

  const openLogin = useCallback((next: LoginDialogOptions = {}) => {
    optionsRef.current = next;
    setOptions(next);
    setPassword("");
    setOpen(true);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password || submitting) return;
    dispatch(clearAuthError());
    setSubmitting(true);
    dispatch(setAuthLoading(true));
    try {
      const data = await postData(
        authApi.login,
        { email: email.trim(), password, expectedRole: "customer" },
        { silent: true, skipLogoutOn401: true },
      );
      const credentials = toAuthCredentials(data);
      if (!credentials) {
        showApiErrorToast("Login succeeded but session data was incomplete.");
        return;
      }
      dispatch(setCredentials(credentials));
      toast.success(
        (typeof credentials.message === "string" && credentials.message) || "Welcome back.",
      );
      optionsRef.current.onSuccess?.(credentials.user);
      setPassword("");
      setOpen(false);
    } catch (error) {
      showApiErrorToast(error, "Invalid email or password.");
    } finally {
      setSubmitting(false);
      dispatch(setAuthLoading(false));
    }
  }

  const value = useMemo(() => ({ openLogin }), [openLogin]);
  const registerHref = options.registerNext
    ? `/register?next=${encodeURIComponent(options.registerNext)}`
    : "/register";

  return (
    <LoginDialogContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
        {/* Above the AI assistant panel (z-61) so it can open from inside the chat. */}
        <DialogContent className="z-[70] sm:max-w-sm">
          <div className="flex flex-col gap-1 pr-6">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LogIn className="size-4" aria-hidden />
            </span>
            <DialogTitle className="mt-2 text-lg font-semibold">Welcome back</DialogTitle>
            <DialogDescription>
              {options.reason || "Sign in to your homeowner account to continue."}
            </DialogDescription>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="login-dialog-email">Email</FieldLabel>
                <Input
                  id="login-dialog-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="login-dialog-password">Password</FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="login-dialog-password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>
            </FieldGroup>

            <Button type="submit" size="lg" disabled={submitting || !email.trim() || !password}>
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              {submitting ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              New to Request Service?{" "}
              <Link
                href={registerHref}
                className="font-semibold text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                Create account
              </Link>
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </LoginDialogContext.Provider>
  );
}

/** Null outside the provider so callers can fall back to the /login page. */
export function useCustomerLoginDialog() {
  return useContext(LoginDialogContext);
}
