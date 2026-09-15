import { Suspense } from "react";
import { CustomerMessagesView } from "@/components/account/customer-messages-view";
import { Container, Section } from "@/components/layout/container";
import { CenteredSpinner } from "@/components/ui/spinner";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Messages",
  description: "Private account inbox for chats with professionals.",
  path: "/account/messages",
  index: false,
  follow: false,
});

export default function CustomerMessagesPage() {
  return (
    <Suspense
      fallback={
        <Section tone="muted">
          <Container>
            <CenteredSpinner label="Loading messages" className="min-h-64" />
          </Container>
        </Section>
      }
    >
      <CustomerMessagesView />
    </Suspense>
  );
}
