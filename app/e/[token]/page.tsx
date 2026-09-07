import { CustomerEstimatePage } from "@/components/estimate/customer-estimate";
import type { PageParams } from "@/lib/page-props";

export const metadata = {
  title: "Review estimate",
  robots: { index: false, follow: false },
};

export default async function PublicEstimatePage({ params }: PageParams<{ token: string }>) {
  const { token } = await params;
  return <CustomerEstimatePage token={token} />;
}
