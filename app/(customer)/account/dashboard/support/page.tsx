import { Suspense } from "react";
import { CustomerSupportView } from "@/components/account/customer-support-view";
import { CenteredSpinner } from "@/components/ui/spinner";

export default function CustomerSupportPage() {
  return (
    <Suspense
      fallback={<CenteredSpinner label="Loading support" className="min-h-64" />}
    >
      <CustomerSupportView />
    </Suspense>
  );
}
