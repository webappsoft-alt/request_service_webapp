import { Suspense } from "react";
import { CustomerMessagesView } from "@/components/account/customer-messages-view";
import { PortalPage } from "@/components/portal/portal-page";
import { CenteredSpinner } from "@/components/ui/spinner";

export default function CustomerDashboardMessagesPage() {
  return (
    <PortalPage
      eyebrow="Activity"
      title="Messages"
      description="Conversations with professionals you contacted from their profiles."
    >
      <Suspense
        fallback={<CenteredSpinner label="Loading messages" className="min-h-64" />}
      >
        <CustomerMessagesView embedded />
      </Suspense>
    </PortalPage>
  );
}
