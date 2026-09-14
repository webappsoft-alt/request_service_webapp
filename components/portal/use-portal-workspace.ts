"use client";

import { useMemo } from "react";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { handleUserLogout } from "@/components/api/apiFuntions";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthProvider,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import type { DemoSession } from "@/lib/auth/demo-session";
import type { PortalActivity, PortalRevenuePoint } from "@/lib/data/portal";
import { getPortalWorkspace } from "@/lib/data/portal";
import { providerDisplayId, workingHoursFromProvider } from "@/lib/auth/provider-profile";
import type { Estimate, Invoice, Job, Payment } from "@/lib/types";

function isOverdue(date?: string): boolean {
  if (!date) return false;
  const due = new Date(date);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function computeStats(
  requests: ReturnType<typeof getPortalWorkspace>["requests"],
  estimates: Estimate[],
  jobs: Job[],
  invoices: Invoice[],
  payments: Payment[],
) {
  const revenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  return {
    newRequests: requests.filter((item) => item.status === "new" || item.status === "viewed").length,
    awaitingReply: requests.filter((item) => item.status === "new").length,
    activeJobs: jobs.filter(
      (item) =>
        item.status !== "completed" &&
        item.status !== "invoiced" &&
        item.status !== "paid" &&
        item.status !== "cancelled",
    ).length,
    scheduledThisWeek: jobs.filter((item) => item.status === "scheduled").length,
    pendingEstimates: estimates.filter((item) => item.status === "sent" || item.status === "draft").length,
    pendingEstimateValue: estimates
      .filter((item) => item.status === "sent" || item.status === "draft")
      .reduce((sum, item) => sum + item.total, 0),
    outstanding,
    overdueInvoices: invoices.filter((item) => item.status !== "paid" && item.status !== "cancelled" && isOverdue(item.dueAt)).length,
    revenue,
    upcomingJobs: jobs.filter((item) => item.status === "scheduled"),
  };
}

function computeRevenue(payments: Payment[]): PortalRevenuePoint[] {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleString("en-US", { month: "short" });
    const value = payments
      .filter((payment) => {
        if (!payment.paidAt) return false;
        const paidAt = new Date(payment.paidAt);
        return (
          paidAt.getFullYear() === date.getFullYear() &&
          paidAt.getMonth() === date.getMonth()
        );
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
    return { key, label, value };
  });

  return months.map(({ label, value }) => ({ label, value }));
}

function computeActivity(
  requests: ReturnType<typeof getPortalWorkspace>["requests"],
  estimates: Estimate[],
  jobs: Job[],
  invoices: Invoice[],
  payments: Payment[],
): PortalActivity[] {
  return [
    ...requests.map((item) => ({
      id: `req:${item.id}`,
      title: "Lead received",
      detail: `${item.customerName} · ${item.serviceName}`,
      at: item.createdAt,
      href: `/pro/dashboard/requests/${item.id}`,
    })),
    ...estimates.map((item) => ({
      id: `est:${item.id}`,
      title: "Estimate updated",
      detail: item.number,
      at: item.updatedAt || item.issuedAt,
      href: `/pro/dashboard/estimates/${item.id}`,
    })),
    ...jobs.map((item) => ({
      id: `job:${item.id}`,
      title: "Job updated",
      detail: item.number,
      at: item.updatedAt || item.createdAt,
      href: `/pro/dashboard/jobs/${item.id}`,
    })),
    ...invoices.map((item) => ({
      id: `inv:${item.id}`,
      title: item.balanceDue > 0 ? "Invoice due" : "Invoice paid",
      detail: item.number,
      at: item.updatedAt || item.issuedAt,
      href: `/pro/dashboard/invoices/${item.id}`,
    })),
    ...payments.map((item) => ({
      id: `pay:${item.id}`,
      title: "Payment received",
      detail: item.invoiceId,
      at: item.paidAt || item.createdAt,
      href: `/pro/dashboard/payments/${item.id}`,
    })),
  ]
    .filter((item) => Boolean(item.at))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
}

export function usePortalWorkspace() {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const crm = useCrmApiData();

  const ready = auth.hydrated;
  const isProvider =
    isAuthenticated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const companyName =
    (typeof authProvider?.companyName === "string" &&
      authProvider.companyName.trim()) ||
    "Your company";

  const session: DemoSession | null =
    isProvider && user
      ? {
          role: "provider",
          firstName: String(user.firstName || ""),
          lastName: String(user.lastName || ""),
          email: String(user.email || authProvider?.email || ""),
          companyName,
        }
      : null;

  const workspace = getPortalWorkspace(session);
  const resolvedProviderId = providerDisplayId(authProvider) || workspace.provider.id;
  const shouldUseApi = crm.enabled && isProvider;
  const apiReady = shouldUseApi && crm.ready;
  const suppressSeedData = shouldUseApi && !crm.ready;

  const customers = apiReady ? crm.customers : suppressSeedData ? [] : workspace.customers;
  const requests = apiReady ? crm.requests : suppressSeedData ? [] : workspace.requests;
  const estimates = apiReady ? crm.estimates : suppressSeedData ? [] : workspace.estimates;
  const jobs = apiReady ? crm.jobs : suppressSeedData ? [] : workspace.jobs;
  const invoices = apiReady ? crm.invoices : suppressSeedData ? [] : workspace.invoices;
  const payments = apiReady ? crm.payments : suppressSeedData ? [] : workspace.payments;
  const employees = apiReady ? crm.employees : suppressSeedData ? [] : workspace.employees;
  const calendarEvents = apiReady ? crm.schedule : suppressSeedData ? [] : workspace.calendarEvents;
  const stats = apiReady
    ? computeStats(requests, estimates, jobs, invoices, payments)
    : suppressSeedData
      ? computeStats([], [], [], [], [])
      : workspace.stats;
  const revenue = apiReady ? computeRevenue(payments) : suppressSeedData ? computeRevenue([]) : workspace.revenue;
  const activity = apiReady
    ? computeActivity(requests, estimates, jobs, invoices, payments)
    : suppressSeedData
      ? []
      : workspace.activity;

  const provider = useMemo(
    () => ({
      ...workspace.provider,
      id: resolvedProviderId,
      companyName,
      email: String(user?.email || authProvider?.email || workspace.provider.email),
      phone: String(
        (typeof user?.phone === "string" && user.phone) ||
          authProvider?.phone ||
          workspace.provider.phone ||
          "",
      ),
      website:
        typeof authProvider?.website === "string"
          ? authProvider.website
          : workspace.provider.website,
      tagline: String(authProvider?.tagline || workspace.provider.tagline || ""),
      description: String(
        authProvider?.description || workspace.provider.description || "",
      ),
      slug: String(authProvider?.slug || workspace.provider.slug || ""),
      street: String(authProvider?.location?.address || workspace.provider.street || ""),
      city: String(authProvider?.location?.city || workspace.provider.city || ""),
      state: String(
        (typeof authProvider?.location?.state === "string" &&
          authProvider.location.state) ||
          workspace.provider.state ||
          "",
      ),
      zip: String(authProvider?.location?.zip || workspace.provider.zip || ""),
      licensed: Boolean(
        authProvider?.profile?.licensed ?? workspace.provider.licensed,
      ),
      insured: Boolean(
        authProvider?.profile?.insured ?? workspace.provider.insured,
      ),
      categoryIds: Array.isArray(authProvider?.services?.categoryIds)
        ? authProvider.services.categoryIds
        : workspace.provider.categoryIds,
      contact: {
        name:
          [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          workspace.provider.contact?.name ||
          "Owner",
        role: String(
          authProvider?.contactRole ||
            workspace.provider.contact?.role ||
            "Business owner",
        ),
      },
      yearsInBusiness:
        typeof authProvider?.profile?.yearsInBusiness === "number"
          ? authProvider.profile.yearsInBusiness
          : workspace.provider.yearsInBusiness,
      employeeCount: String(
        authProvider?.profile?.employeeCount ||
          workspace.provider.employeeCount ||
          "",
      ),
      startingPrice:
        typeof authProvider?.services?.startingPrice === "number"
          ? authProvider.services.startingPrice
          : workspace.provider.startingPrice,
      workingHours: (() => {
        const fromAuth = workingHoursFromProvider(authProvider);
        return fromAuth.length ? fromAuth : workspace.provider.workingHours;
      })(),
    }),
    [authProvider, companyName, resolvedProviderId, user, workspace.provider],
  );

  return {
    ready,
    session,
    authProvider,
    signOut: () => handleUserLogout(),
    ...workspace,
    provider,
    customers,
    requests,
    estimates,
    jobs,
    invoices,
    payments,
    employees,
    calendarEvents,
    stats,
    revenue,
    activity,
  };
}
