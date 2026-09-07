import { PortalSuspense } from "@/components/portal/portal-suspense";
import { TaskDetailView } from "@/components/portal/views/tasks-view";
import type { PageParams } from "@/lib/page-props";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Task file",
  "Task details, assignee, and customer.",
  "/pro/dashboard/tasks",
);

export default async function TaskDetailPage({ params }: PageParams<{ id: string }>) {
  const { id } = await params;
  return (
    <PortalSuspense>
      <TaskDetailView id={id} />
    </PortalSuspense>
  );
}
