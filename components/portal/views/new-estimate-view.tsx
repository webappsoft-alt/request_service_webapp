"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  FilePlus2,
  MapPin,
  User,
} from "lucide-react";
import { CreateEstimateDialog } from "@/components/portal/create-work-dialogs";
import { PortalPage } from "@/components/portal/portal-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { getRequest } from "@/lib/api/crm-client";
import { crmCustomerName } from "@/lib/data/crm-people";
import type { PortalRequest } from "@/lib/data/portal";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";

export function NewEstimateView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request") || "";
  const customerIdParam = searchParams.get("customer") || "";

  const { customers } = useCrmDirectory();
  const [request, setRequest] = useState<PortalRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(Boolean(requestId));
  const [dialogOpen, setDialogOpen] = useState(true);

  useEffect(() => {
    if (!requestId) return;

    let cancelled = false;
    void getRequest(requestId, { silent: true })
      .then((data) => {
        if (!cancelled && data) {
          setRequest(data);
        }
      })
      .catch(() => {
        /* gracefully proceed with manual customer/job inputs */
      })
      .finally(() => {
        if (!cancelled) setLoadingRequest(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const effectiveCustomerId = useMemo(() => {
    if (request?.customerId) return request.customerId;
    if (customerIdParam) return customerIdParam;
    return undefined;
  }, [request?.customerId, customerIdParam]);

  const customerObj = useMemo(() => {
    if (!effectiveCustomerId) return null;
    return customers.find((c) => c.id === effectiveCustomerId) || null;
  }, [customers, effectiveCustomerId]);

  const effectiveCustomerName = useMemo(() => {
    if (request?.customerName) return request.customerName;
    if (customerObj) return crmCustomerName(customerObj);
    return undefined;
  }, [request, customerObj]);

  const address = request
    ? {
        street: "",
        city: request.city || "",
        state: request.state || "",
        zip: request.zip || "",
      }
    : undefined;
  const addressFormatted = useMemo(() => {
    if (!address) return null;
    const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }, [address]);

  return (
    <PortalPage
      eyebrow="Estimates"
      title="Create New Estimate"
      description={
        request
          ? `Drafting estimate proposal for ${request.serviceName || "request"} · ${request.number}`
          : "Draft an estimate proposal with itemized labor, materials, and terms."
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {requestId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/pro/dashboard/requests/${requestId}`}>
                <ArrowLeft className="size-3.5" />
                Back to lead
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/pro/dashboard/estimates">
                <ArrowLeft className="size-3.5" />
                All estimates
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5 bg-[#003F7D] text-white hover:bg-[#003264]"
            onClick={() => setDialogOpen(true)}
          >
            <FilePlus2 className="size-3.5" />
            Open estimate builder
          </Button>
        </div>
      }
    >
      {loadingRequest ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-border bg-card p-12">
          <CenteredSpinner label="Loading request details…" />
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          {request ? (
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {request.serviceName || "Service Request"}
                  </h2>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    Ref: {request.number || request.id}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {request.status}
                </Badge>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <User className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      Customer
                    </dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {effectiveCustomerName || "Direct / Unassigned"}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      Job location
                    </dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {addressFormatted || "Location on file"}
                    </dd>
                  </div>
                </div>
              </dl>

              {request.details ? (
                <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3.5 text-xs">
                  <p className="font-semibold text-foreground">Request Details & Notes</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">
                    {request.details}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  className="gap-1.5 bg-[#003F7D] text-white hover:bg-[#003264]"
                  onClick={() => setDialogOpen(true)}
                >
                  <FilePlus2 className="size-3.5" />
                  Write estimate for this request
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center shadow-xs">
              <FilePlus2 className="mx-auto size-10 text-muted-foreground/60" />
              <h2 className="mt-3 text-base font-semibold text-foreground">
                Ready to create an estimate
              </h2>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                The estimate dialog lets you itemize labor and materials, schedule site visits, set payment terms, and send proposals directly to homeowners.
              </p>
              <Button
                size="sm"
                className="mt-4 gap-1.5 bg-[#003F7D] text-white hover:bg-[#003264]"
                onClick={() => setDialogOpen(true)}
              >
                <FilePlus2 className="size-3.5" />
                Launch estimate builder
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Primary Estimate Creator Dialog */}
      <CreateEstimateDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen);
          if (!nextOpen && !request) {
            router.push("/pro/dashboard/estimates");
          }
        }}
        requestId={request?.id || requestId || undefined}
        customerId={effectiveCustomerId}
        customerName={effectiveCustomerName}
        requestName={request?.serviceName || undefined}
        requestNotes={request?.details || undefined}
        requestAddress={
          address
            ? {
                street: address.street,
                city: address.city,
                state: address.state,
                zip: address.zip,
              }
            : undefined
        }
        onCreated={(saved) => {
          router.push(`/pro/dashboard/estimates/${saved.id}`);
        }}
      />
    </PortalPage>
  );
}
