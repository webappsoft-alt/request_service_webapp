import { Suspense } from "react";
import { OtpVerificationForm } from "@/components/auth/otp-verification-form";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Verify Email",
  description:
    "Enter the 4-digit code sent to your email to finish creating your account.",
  path: "/verify-otp",
  index: false,
  follow: false,
});

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading verification…
        </div>
      }
    >
      <OtpVerificationForm />
    </Suspense>
  );
}
