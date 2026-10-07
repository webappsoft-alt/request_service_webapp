import { redirect } from "next/navigation";

/** Technician chats moved into Messages → Technicians. */
export default async function TeamChatRedirect({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread } = await searchParams;
  redirect(thread ? `/pro/dashboard/messages?tab=technicians&thread=${thread}` : "/pro/dashboard/messages?tab=technicians");
}
