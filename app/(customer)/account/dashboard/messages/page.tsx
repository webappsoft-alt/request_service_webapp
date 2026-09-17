import { Suspense } from "react";
import { CustomerMessagesView } from "@/components/account/customer-messages-view";
import { CenteredSpinner } from "@/components/ui/spinner";

export default function CustomerDashboardMessagesPage() {
  return (
    <Suspense
      fallback={<CenteredSpinner label="Loading messages" className="min-h-64" />}
    >
      <CustomerMessagesView embedded />
    </Suspense>
  );
}

