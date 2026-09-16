"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { NoData } from "@/components/shared/no-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  loadRememberedCustomerEstimates,
  type CustomerEstimateListItem,
} from "@/lib/api/customer-estimates";
import {
  extractEstimateTokenFromInput,
  rememberCustomerEstimateToken,
} from "@/lib/booking/customer-estimates-store";
import { customerPaths } from "@/lib/customer-paths";
import { formatMoney } from "@/lib/format";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";

function statusVariant(status: string) {
  const value = status.toLowerCase();
  if (value === "accepted" || value === "converted_to_job") return "default" as const;
  if (value === "sent" || value === "finalized") return "secondary" as const;
  if (value === "rejected" || value === "expired") return "destructive" as const;
  return "outline" as const;
}

function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function CustomerEstimatesDashboardView() {
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [items, setItems] = useState<CustomerEstimateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openLink, setOpenLink] = useState("");

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.estimates)}`,
      );
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await loadRememberedCustomerEstimates();
        if (!cancelled) setItems(list);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load estimates.",
          );
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.hydrated, isAuthenticated, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.title, item.number, item.status, item.provider?.companyName]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  function handleOpenLink(event: React.FormEvent) {
    event.preventDefault();
    const token = extractEstimateTokenFromInput(openLink);
    if (!token) return;
    rememberCustomerEstimateToken(token);
    router.push(customerPaths.estimate(token));
  }

  if (!auth.hydrated || (!isAuthenticated && loading)) {
    return <CenteredSpinner label="Checking your account…" />;
  }

  return (
    <PortalPage
      eyebrow="Activity"
      title="Estimates"
      description="Open a share link from a professional to review and sign. Estimates you open are kept here for easy access."
    >
      <form
        onSubmit={handleOpenLink}
        className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <Input
          value={openLink}
          onChange={(event) => setOpenLink(event.target.value)}
          placeholder="Paste estimate link or token…"
          className="h-9 bg-card sm:max-w-md"
          aria-label="Estimate link"
        />
        <Button type="submit" size="sm" disabled={!openLink.trim()}>
          Open estimate
        </Button>
      </form>

      <div className="mb-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search estimates…"
            className="h-9 bg-card pl-8"
            aria-label="Search estimates"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[4px] border border-black/10 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-[#e8eef5] text-[11px] tracking-[0.12em] text-[#003F7D] uppercase">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Estimate</th>
                <th className="px-3 py-2.5 font-semibold">Professional</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Total</th>
                <th className="px-3 py-2.5 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {loading && !filtered.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    Loading estimates…
                  </td>
                </tr>
              ) : error && !filtered.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-black/10 hover:bg-[#f7f8fa]"
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium">
                        {item.title || item.number || "Estimate"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.number || item.id}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {item.provider?.companyName || "Professional"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusVariant(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 font-semibold tabular-nums text-[#003F7D]">
                      {formatMoney(item.total)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {item.shareToken ? (
                        <Button asChild size="sm">
                          <Link href={customerPaths.estimate(item.shareToken)}>
                            {["sent", "finalized", "changes_requested"].includes(
                              item.status,
                            )
                              ? "Review & sign"
                              : "View"}
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No share link
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-8">
                    <NoData
                      title="No estimates yet"
                      description="When a professional sends you an estimate link, open it here (or paste the link above) to review and sign."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PortalPage>
  );
}
