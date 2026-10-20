"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, LifeBuoy, MessageCircle, Plus } from "lucide-react";
import { getData } from "@/components/api/apiFuntions";
import { supportInquiriesApi } from "@/components/api/ApiRoutesFile";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CenteredSpinner } from "@/components/ui/spinner";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate, formatShortDate } from "@/lib/format";

type SupportInquiry = {
  id: string;
  subject: string;
  message: string;
  status: "NEW" | "RESOLVED" | "REJECTED" | string;
  resolutionNote?: string;
  resolvedAt?: string | null;
  resolvedBy?: { name?: string } | null;
  createdAt?: string;
};

const STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" }> = {
  NEW: { label: "Pending", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

function statusOf(status: string) {
  return STATUS[String(status || "NEW").toUpperCase()] ?? STATUS.NEW;
}

function parseList(response: unknown): SupportInquiry[] {
  const root = (response ?? {}) as { data?: unknown };
  return Array.isArray(root.data) ? (root.data as SupportInquiry[]) : [];
}

async function fetchInquiries(): Promise<{ items: SupportInquiry[] } | { error: string }> {
  try {
    const response = await getData(supportInquiriesApi.list, undefined, {
      silent: true,
      force: true,
    });
    return { items: parseList(response) };
  } catch (err) {
    return { error: extractErrorMessage(err) };
  }
}

export function CustomerSupportView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openId = searchParams.get("inquiry") ?? "";

  const [items, setItems] = useState<SupportInquiry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchInquiries().then((result) => {
        if ("items" in result) {
          setItems(result.items);
          setError(null);
        } else {
          setError(result.error);
        }
        setLoaded(true);
      }),
    [],
  );

  useEffect(() => {
    let alive = true;
    void fetchInquiries().then((result) => {
      if (!alive) return;
      if ("items" in result) setItems(result.items);
      else setError(result.error);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Admin resolve / reject arrives as a NEW_NOTIFICATION over the socket.
  useEffect(
    () =>
      subscribeRealtime((detail) => {
        if (detail?.type !== "NEW_NOTIFICATION") return;
        const payload = (detail.payload ?? {}) as { type?: string };
        if (payload.type === "SUPPORT_INQUIRY_UPDATED") void load();
      }),
    [load],
  );

  const selected = useMemo(
    () => items.find((item) => item.id === openId) ?? null,
    [items, openId],
  );

  const setOpenId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("inquiry", id);
      else params.delete("inquiry");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const pendingCount = items.filter((item) => statusOf(item.status).label === "Pending").length;

  const newInquiryButton = (
    <Button asChild size="sm" variant="outline">
      <Link href="/contact">
        <Plus className="size-4" />
        New inquiry
      </Link>
    </Button>
  );

  return (
    <PortalPage
      eyebrow="Account"
      title="Support"
      description="Inquiries you sent through the Contact form and our team's responses."
      actions={
        <div className="flex flex-wrap gap-2">
          {newInquiryButton}
          <Button asChild size="sm">
            <Link href={customerPaths.supportChat}>
              <MessageCircle className="size-4" />
              Chat with Support
            </Link>
          </Button>
        </div>
      }
    >
      {!loaded ? (
        <CenteredSpinner label="Loading inquiries…" className="min-h-64" />
      ) : error && !items.length ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : (
        <>
          {pendingCount > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {pendingCount} {pendingCount === 1 ? "inquiry is" : "inquiries are"} awaiting review by
              our support team.
            </div>
          ) : null}
          <PortalDataTable
            filename="support-inquiries"
            countLabel="Inquiries"
            searchPlaceholder="Search inquiries…"
            rows={items}
            rowKey={(row) => row.id}
            onRowClick={(row) => setOpenId(row.id)}
            empty="You haven't sent any inquiries yet."
            columns={[
              {
                id: "subject",
                header: "Subject",
                sortValue: (row) => row.subject,
                searchValue: (row) => `${row.subject} ${row.message}`,
                exportValue: (row) => row.subject,
                cell: (row) => (
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{row.subject}</p>
                    <p className="max-w-88 truncate text-xs text-muted-foreground">
                      {row.message}
                    </p>
                  </div>
                ),
              },
              {
                id: "date",
                header: "Date",
                sortValue: (row) => row.createdAt || "",
                exportValue: (row) => row.createdAt || "",
                cell: (row) => (
                  <span className="text-muted-foreground">
                    {row.createdAt ? formatShortDate(row.createdAt) : "—"}
                  </span>
                ),
              },
              {
                id: "status",
                header: "Status",
                sortValue: (row) => statusOf(row.status).label,
                exportValue: (row) => statusOf(row.status).label,
                cell: (row) => {
                  const s = statusOf(row.status);
                  return <StatusPill label={s.label} tone={s.tone} />;
                },
              },
            ]}
            actions={(row) => [
              {
                label: "View details",
                onSelect: () => setOpenId(row.id),
                icon: <Eye className="size-3.5" />,
                quick: true,
              },
              {
                label: "Continue in Chat",
                href: customerPaths.supportChat,
                icon: <MessageCircle className="size-3.5" />,
              },
            ]}
          />
        </>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => (open ? null : setOpenId(null))}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          {selected ? <InquiryDetail inquiry={selected} /> : null}
        </SheetContent>
      </Sheet>
    </PortalPage>
  );
}

function InquiryDetail({ inquiry }: { inquiry: SupportInquiry }) {
  const status = statusOf(inquiry.status);
  const decided = status.label !== "Pending";
  const rejected = status.label === "Rejected";

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-4 text-primary" aria-hidden="true" />
          <StatusPill label={status.label} tone={status.tone} />
        </div>
        <SheetTitle className="text-lg">{inquiry.subject}</SheetTitle>
        <SheetDescription>
          Sent {inquiry.createdAt ? formatDate(inquiry.createdAt) : "—"}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Your message
          </h3>
          <p className="rounded-md border bg-muted/30 p-3 leading-relaxed whitespace-pre-wrap text-foreground">
            {inquiry.message}
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {rejected ? "Reason from Support" : "Response from Support"}
          </h3>
          {decided ? (
            <div
              className={
                rejected
                  ? "rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40"
                  : "rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40"
              }
            >
              <p className="leading-relaxed whitespace-pre-wrap text-foreground">
                {inquiry.resolutionNote || (rejected ? "Your inquiry was rejected." : "Your inquiry was resolved.")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {rejected ? "Rejected" : "Resolved"}
                {inquiry.resolvedAt ? ` on ${formatDate(inquiry.resolvedAt)}` : ""}
                {inquiry.resolvedBy?.name ? ` by ${inquiry.resolvedBy.name}` : ""}
              </p>
            </div>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Our team is reviewing your inquiry. You&apos;ll get an email and a notification
              when there&apos;s an update.
            </p>
          )}
        </section>
      </div>

      <SheetFooter className="border-t">
        <Button asChild>
          <Link href={customerPaths.supportChat}>
            <MessageCircle className="size-4" />
            Continue in Chat
          </Link>
        </Button>
      </SheetFooter>
    </>
  );
}
