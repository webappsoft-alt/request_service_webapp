import { Suspense } from "react";
import { ForgotPasswordOtpForm } from "@/components/auth/forgot-password-otp-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Verify Password Reset Code",
  description: "Enter the OTP sent to your email to reset your provider password.",
  path: "/pro/verify-forgot-otp",
  index: false,
  follow: false,
});

export default function ProVerifyForgotOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ForgotPasswordOtpForm role="provider" />
    </Suspense>
  );
}
