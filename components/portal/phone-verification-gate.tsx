"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { handleUserLogout, refreshAuthMe } from "@/components/api/apiFuntions";
import { PhoneVerificationDialog } from "@/components/portal/phone-verification-dialog";
import { useAppSelector } from "@/store/hooks";
import { selectAuthUser } from "@/store/authSlice";
import { PHONE_VERIFICATION_EVENT } from "@/lib/auth/phone-verification";

/** At most one /me re-read per burst of gated requests. */
const GATE_REFRESH_COOLDOWN_MS = 5000;

/**
 * Pros must verify their business phone before using the portal. The
 * dashboard renders underneath (blurred, inert: no clicks, focus or screen
 * reader access) and a modal that can't be dismissed asks for the SMS code.
 * The API enforces the same rule, so gated calls the dashboard makes on mount
 * fail quietly (no toasts; see notifyRequestError) until the phone is verified.
 */
export function PhoneVerificationGate({ children }: { children: ReactNode }) {
  const user = useAppSelector(selectAuthUser);
  // Undefined means an older session payload; /me sync fills it in.
  const needsVerification = user?.isPhoneVerified === false;
  const lastRefreshRef = useRef(0);

  // A request was refused by the phone gate: re-read the account so the flag catches up.
  useEffect(() => {
    const onGateHit = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < GATE_REFRESH_COOLDOWN_MS) return;
      lastRefreshRef.current = now;
      void refreshAuthMe().catch(() => null);
    };
    window.addEventListener(PHONE_VERIFICATION_EVENT, onGateHit);
    return () => window.removeEventListener(PHONE_VERIFICATION_EVENT, onGateHit);
  }, []);

  return (
    <>
      {/* Same wrapper either way, so verifying doesn't remount the dashboard. */}
      <div className="contents" inert={needsVerification} aria-hidden={needsVerification || undefined}>
        {children}
      </div>

      {needsVerification ? (
        <PhoneVerificationDialog
          open
          dismissible={false}
          overlayClassName="bg-slate-900/40 backdrop-blur-md"
          initialPhone={typeof user?.phone === "string" ? user.phone : ""}
          title="Verify your business phone"
          description="Before you can receive leads or manage jobs, confirm your phone number. We'll text you a 4-digit code."
          onVerified={() => {
            // refreshAuthMe inside the dialog flips isPhoneVerified and lifts the gate.
          }}
          footer={
            <>
              Not you?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => handleUserLogout()}
              >
                Sign out
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
