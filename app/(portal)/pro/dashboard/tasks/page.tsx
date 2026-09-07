import { PortalSuspense } from "@/components/portal/portal-suspense";
import { TasksView } from "@/components/portal/views/tasks-view";
import { portalMetadata } from "@/lib/portal-meta";

export const metadata = portalMetadata(
  "Tasks",
  "Office and field tasks that sit beside jobs.",
  "/pro/dashboard/tasks",
);

export default function TasksPage() {
  return (
    <PortalSuspense>
      <TasksView />
    </PortalSuspense>
  );
}
