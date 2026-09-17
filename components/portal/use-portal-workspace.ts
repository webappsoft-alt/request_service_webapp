"use client";

import { useEffect, useMemo } from "react";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { handleUserLogout } from "@/components/api/apiFuntions";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthProvider,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import { fetchServiceAreasPicker } from "@/store/serviceAreasSlice";
import type { DemoSession } from "@/lib/auth/demo-session";
import { coverageNeighborhoodLabels } from "@/lib/coverage-areas";
import type { PortalActivity, PortalRevenuePoint } from "@/lib/data/portal";
import { getPortalWorkspace } from "@/lib/data/portal";
import { getActivePlans } from "@/lib/data/plans";
import { getServiceCategoryById } from "@/lib/data/services";
import {
  providerDisplayId,
  workingHoursFromProvider,
} from "@/lib/auth/provider-profile";
import type {
  Estimate,
  Invoice,
  Job,
  Payment,
  Provider,
  Subscription,
  SubscriptionStatus,
} from "@/lib/types";

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
    overdueInvoices: invoices.filter(
      (item) => item.status !== "paid" && item.status !== "cancelled" && isOverdue(item.dueAt),
    ).length,
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
      title: "Invoice updated",
      detail: item.number,
      at: item.updatedAt || item.issuedAt,
      href: `/pro/dashboard/invoices/${item.id}`,
    })),
    ...payments.map((item) => ({
      id: `pay:${item.id}`,
      title: "Payment recorded",
      detail: `$${item.amount.toFixed(2)}`,
      at: item.paidAt || item.createdAt,
      href: `/pro/dashboard/payments/${item.id}`,
    })),
  ]
    .filter((item) => item.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function emptyStats() {
  return computeStats([], [], [], [], []);
}

function subscriptionFromAuth(
  providerId: string,
  authProvider: ReturnType<typeof selectAuthProvider>,
): Subscription {
  const highlighted = getActivePlans().find((plan) => plan.highlighted) ?? getActivePlans()[0];
  const rawStatus = String(
    (typeof authProvider?.subscriptionStatus === "string" && authProvider.subscriptionStatus) ||
      (typeof authProvider?.status === "string" && authProvider.status) ||
      "active",
  ).toLowerCase();
  const status = (
    ["trialing", "active", "past_due", "canceled", "incomplete"].includes(rawStatus)
      ? rawStatus
      : "active"
  ) as SubscriptionStatus;
  const planId =
    (typeof authProvider?.planId === "string" && authProvider.planId) ||
    (typeof authProvider?.subscriptionPlanId === "string" && authProvider.subscriptionPlanId) ||
    highlighted?.id ||
    "";
  const periodStart =
    (typeof authProvider?.currentPeriodStart === "string" && authProvider.currentPeriodStart) ||
    "";
  const periodEnd =
    (typeof authProvider?.currentPeriodEnd === "string" && authProvider.currentPeriodEnd) ||
    "";
  const now = new Date().toISOString().slice(0, 10);
  return {
    id: `sub_${providerId || "provider"}`,
    providerId: providerId || "provider",
    planId,
    status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(authProvider?.cancelAtPeriodEnd),
    createdAt: now,
    updatedAt: now,
  };
}

export function usePortalWorkspace() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const pickerItems = useAppSelector(
    (state) => state.serviceAreas?.pickerItems ?? [],
  );
  const listItems = useAppSelector((state) => state.serviceAreas?.items ?? []);
  const crm = useCrmApiData();

  const ready = auth.hydrated;
  const isProvider =
    isAuthenticated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  useEffect(() => {
    if (!isProvider) return;
    void dispatch(fetchServiceAreasPicker());
  }, [dispatch, isProvider]);

  const areasById = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of [...listItems, ...pickerItems]) {
      if (area?.id && area.title) map.set(area.id, area.title);
    }
    return map;
  }, [listItems, pickerItems]);

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

  // Authenticated providers never use seed/demo workspace lists.
  const useLiveOnly = !ready || isProvider;
  const demoWorkspace = useLiveOnly ? null : getPortalWorkspace(session);
  const resolvedProviderId =
    providerDisplayId(authProvider) || demoWorkspace?.provider.id || "";
  const shouldUseApi = crm.enabled && isProvider;
  const apiReady = shouldUseApi && crm.ready;
  const loading = crm.enabled && (!crm.ready || crm.loading);

  const customers = apiReady ? crm.customers : useLiveOnly ? [] : demoWorkspace!.customers;
  const requests = apiReady ? crm.requests : useLiveOnly ? [] : demoWorkspace!.requests;
  const estimates = apiReady ? crm.estimates : useLiveOnly ? [] : demoWorkspace!.estimates;
  const jobs = apiReady ? crm.jobs : useLiveOnly ? [] : demoWorkspace!.jobs;
  const invoices = apiReady ? crm.invoices : useLiveOnly ? [] : demoWorkspace!.invoices;
  const payments = apiReady ? crm.payments : useLiveOnly ? [] : demoWorkspace!.payments;
  const employees = apiReady ? crm.employees : useLiveOnly ? [] : demoWorkspace!.employees;
  const calendarEvents = apiReady
    ? crm.schedule
    : useLiveOnly
      ? []
      : demoWorkspace!.calendarEvents;
  const services = useLiveOnly ? [] : demoWorkspace!.services;
  const stats = apiReady
    ? computeStats(requests, estimates, jobs, invoices, payments)
    : useLiveOnly
      ? emptyStats()
      : demoWorkspace!.stats;
  const revenue = apiReady
    ? computeRevenue(payments)
    : useLiveOnly
      ? computeRevenue([])
      : demoWorkspace!.revenue;
  const activity = apiReady
    ? computeActivity(requests, estimates, jobs, invoices, payments)
    : useLiveOnly
      ? []
      : demoWorkspace!.activity;

  const subscription = useMemo(() => {
    if (useLiveOnly) return subscriptionFromAuth(resolvedProviderId, authProvider);
    return demoWorkspace!.subscription;
  }, [authProvider, demoWorkspace, resolvedProviderId, useLiveOnly]);

  const provider = useMemo((): Provider => {
    if (useLiveOnly) {
      const hours = workingHoursFromProvider(authProvider);
      const initials = companyName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
      return {
        id: resolvedProviderId || "provider",
        slug: String(authProvider?.slug || ""),
        companyName,
        logoInitials: initials || "RS",
        logoUrl: typeof authProvider?.logoUrl === "string" ? authProvider.logoUrl : undefined,
        coverImage: typeof authProvider?.coverImage === "string" ? authProvider.coverImage : undefined,
        images: Array.isArray(authProvider?.images)
          ? authProvider.images.filter((item): item is string => typeof item === "string")
          : [],
        startingPrice:
          typeof authProvider?.services?.startingPrice === "number"
            ? authProvider.services.startingPrice
            : undefined,
        tagline: String(authProvider?.tagline || ""),
        description: String(authProvider?.description || ""),
        rating: 0,
        reviewCount: 0,
        yearsInBusiness:
          typeof authProvider?.profile?.yearsInBusiness === "number"
            ? authProvider.profile.yearsInBusiness
            : 0,
        licensed: Boolean(authProvider?.profile?.licensed),
        insured: Boolean(authProvider?.profile?.insured),
        categoryIds: Array.isArray(authProvider?.services?.categoryIds)
          ? authProvider.services.categoryIds
          : [],
        serviceArea: coverageNeighborhoodLabels(
          authProvider?.coverage?.neighborhoods,
          areasById,
        ),
        street: String(authProvider?.location?.address || ""),
        city: String(authProvider?.location?.city || ""),
        state: String(
          (typeof authProvider?.location?.state === "string" && authProvider.location.state) ||
            "",
        ),
        zip: String(authProvider?.location?.zip || ""),
        lat: 0,
        lng: 0,
        phone: String(
          (typeof user?.phone === "string" && user.phone) || authProvider?.phone || "",
        ),
        email: String(user?.email || authProvider?.email || ""),
        website: typeof authProvider?.website === "string" ? authProvider.website : "",
        contact: {
          name:
            [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "Owner",
          role: String(authProvider?.contactRole || "Business owner"),
        },
        workingHours: hours,
        gallery: [],
        foundedYear: new Date().getFullYear(),
        employeeCount: String(authProvider?.profile?.employeeCount || ""),
        reviews: [],
        featured: false,
      };
    }

    const seed = demoWorkspace!.provider;
    return {
      ...seed,
      id: resolvedProviderId || seed.id,
      companyName,
      email: String(user?.email || authProvider?.email || seed.email),
      phone: String(
        (typeof user?.phone === "string" && user.phone) ||
          authProvider?.phone ||
          seed.phone ||
          "",
      ),
      website:
        typeof authProvider?.website === "string" ? authProvider.website : seed.website,
      tagline: String(authProvider?.tagline || seed.tagline || ""),
      description: String(authProvider?.description || seed.description || ""),
      slug: String(authProvider?.slug || seed.slug || ""),
      street: String(authProvider?.location?.address || seed.street || ""),
      city: String(authProvider?.location?.city || seed.city || ""),
      state: String(
        (typeof authProvider?.location?.state === "string" && authProvider.location.state) ||
          seed.state ||
          "",
      ),
      zip: String(authProvider?.location?.zip || seed.zip || ""),
      licensed: Boolean(authProvider?.profile?.licensed ?? seed.licensed),
      insured: Boolean(authProvider?.profile?.insured ?? seed.insured),
      categoryIds: Array.isArray(authProvider?.services?.categoryIds)
        ? authProvider.services.categoryIds
        : seed.categoryIds,
      contact: {
        name:
          [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          seed.contact?.name ||
          "Owner",
        role: String(authProvider?.contactRole || seed.contact?.role || "Business owner"),
      },
      yearsInBusiness:
        typeof authProvider?.profile?.yearsInBusiness === "number"
          ? authProvider.profile.yearsInBusiness
          : seed.yearsInBusiness,
      employeeCount: String(
        authProvider?.profile?.employeeCount || seed.employeeCount || "",
      ),
      startingPrice:
        typeof authProvider?.services?.startingPrice === "number"
          ? authProvider.services.startingPrice
          : seed.startingPrice,
      workingHours: (() => {
        const fromAuth = workingHoursFromProvider(authProvider);
        return fromAuth.length ? fromAuth : seed.workingHours;
      })(),
    };
  }, [
    areasById,
    authProvider,
    companyName,
    demoWorkspace,
    resolvedProviderId,
    useLiveOnly,
    user,
  ]);

  const categories = useMemo(
    () =>
      provider.categoryIds
        .map((id) => getServiceCategoryById(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [provider.categoryIds],
  );

  return {
    ready,
    loading,
    session,
    authProvider,
    signOut: () => handleUserLogout(),
    provider,
    customers,
    requests,
    estimates,
    jobs,
    invoices,
    payments,
    employees,
    calendarEvents,
    services,
    subscription,
    stats,
    revenue,
    activity,
    categories,
  };
}
