"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  GoogleAddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/google-address-autocomplete";
import { UsStateSelect } from "@/components/shared/us-state-select";
import { CreateCustomerDialog } from "@/components/portal/create-person-dialogs";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import {
  createEmptyLine,
  LineItemsActions,
  LineItemsEditor,
} from "@/components/portal/line-items-editor";
import {
  invalidateEstimatesCache,
  fetchEstimates,
} from "@/store/estimatesSlice";
import { createCustomerJob, updateCustomerJob } from "@/store/customersSlice";
import { fetchTeam } from "@/store/teamSlice";
import {
  createEstimate as createEstimateApi,
  getEstimate,
  updateEstimate as updateEstimateApi,
  createRequest,
} from "@/lib/api/crm-client";
import { normalizeUsStateCode } from "@/lib/data/us-states";
import {
  seedJobLines,
  writeCostLines,
  type JobCostLine,
} from "@/components/portal/use-job-costing";
import {
  siteVisitFromRecord,
  writeSiteVisit,
} from "@/components/portal/use-job-file";
import {
  addressFrom,
  buildEstimate,
  buildJob,
  filledWorkLines,
  nextRecordNumber,
  todayISO,
} from "@/components/portal/work-builders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CRM_API_EVENT } from "@/components/portal/crm-data-provider";
import { crmCustomerName } from "@/lib/data/crm-people";
import {
  employeeName,
  JOB_STATUSES,
  jobStatusLabel,
  type PortalRequest,
  type PortalTimeWindow,
} from "@/lib/data/portal";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import type { Estimate, Job, JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  detectCurrentLocation,
  hasLocation,
  setLocationFromPlace,
} from "@/store/locationSlice";

type EstimateTab = "customer" | "scope" | "visit" | "review";
type EstimatePath = "site_visit" | "office";
type JobTab = "customer" | "schedule" | "review";

export function CreateEstimateDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  requestId,
  requestName,
  requestNotes,
  requestAddress,
  estimate,
  onCreated,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  customerName?: string;
  requestId?: string;
  requestName?: string;
  requestNotes?: string;
  requestAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  /** When set, dialog edits this estimate (PUT) instead of creating. */
  estimate?: Estimate | null;
  onCreated?: (estimate: Estimate) => void;
  onUpdated?: (estimate: Estimate) => void;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const customerLocation = useAppSelector((state) => state.location);
  const { session, provider, estimates } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { employees } = usePortalCrew();
  const records = usePortalRecords();
  const all = records.mergeEstimates(estimates);
  const first = customers[0];
  const isEdit = Boolean(estimate?.id);
  const [tab, setTab] = useState<EstimateTab>("customer");
  const [path, setPath] = useState<EstimatePath>("site_visit");
  const [name, setName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(
    customerId ?? first?.id ?? "",
  );
  const [customerLabel, setCustomerLabel] = useState("");
  const customer =
    customers.find((item) => item.id === selectedCustomer) ?? first;
  const address = customer?.addresses[0];
  const [street, setStreet] = useState(
    address?.street || customerLocation.address || "",
  );
  const [city, setCity] = useState(
    address?.city || customerLocation.city || "",
  );
  const [state, setState] = useState(
    normalizeUsStateCode(address?.state || customerLocation.state) || "CO",
  );
  const [zip, setZip] = useState(address?.zip || customerLocation.zip || "");
  const [latitude, setLatitude] = useState<number | null>(
    address?.latitude ?? address?.lat ?? customerLocation.latitude ?? null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    address?.longitude ?? address?.lng ?? customerLocation.longitude ?? null,
  );
  const [issuedAt, setIssuedAt] = useState(todayISO());
  const [expiresAt, setExpiresAt] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [visitedAt, setVisitedAt] = useState(todayISO());
  const [accessNotes, setAccessNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "Valid for 30 days. Materials may change after site inspection.",
  );
  const [lines, setLines] = useState<JobCostLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const hasEstimateName = Boolean(name.trim());
  const technician = employees.find((item) => item.id === employeeId);
  // Opened from customer detail / edit → always bind to that customer id.
  const boundCustomerId = (customerId || estimate?.customerId || "").trim();
  const lockedCustomer = Boolean(boundCustomerId);

  const technicianFilter = useMemo(() => ({ role: "technician" }), []);
  const customerPaging = usePaginatedCrmOptions(
    open && useApi && !lockedCustomer ? "customer" : null,
    open && useApi && !lockedCustomer,
  );
  const assigneePaging = usePaginatedCrmOptions(
    open && useApi && path === "site_visit" ? "assignee" : null,
    open && useApi && path === "site_visit",
    undefined,
    technicianFilter,
  );

  const customerOptions = useMemo(
    () =>
      useApi
        ? customerPaging.options
        : customers.map((item) => ({
            id: item.id,
            label: crmCustomerName(item),
          })),
    [useApi, customerPaging.options, customers],
  );
  const technicianOptions = useMemo(() => {
    const rows = useApi
      ? assigneePaging.options
      : employees
          .filter((item) => {
            const role = String(item.role || "").toLowerCase().trim();
            return (
              item.active !== false &&
              (role === "technician" || role === "tech")
            );
          })
          .map((item) => ({
            id: item.id,
            label: `${employeeName(item)}${item.trade ? ` · ${item.trade}` : ""}`,
          }));
    return [{ id: "", label: "Assign later" }, ...rows];
  }, [useApi, assigneePaging.options, employees]);

  const nextTab = (current: EstimateTab): EstimateTab => {
    if (current === "customer")
      return path === "site_visit" ? "visit" : "scope";
    if (current === "visit" || current === "scope") return "review";
    return "review";
  };
  const prevTab = (current: EstimateTab): EstimateTab => {
    if (current === "review") return path === "site_visit" ? "visit" : "scope";
    return "customer";
  };

  useEffect(() => {
    if (!open) {
      setTab("customer");
      return;
    }
    // Edit mode hydrates in a separate effect — don't wipe the form.
    if (estimate?.id) return;
    if (requestName) {
      setName(
        requestName.endsWith("Proposal") || requestName.endsWith("Estimate")
          ? requestName
          : `${requestName} Proposal`,
      );
    } else {
      setName("");
    }
    setSaving(false);
    setLines([]);
    setPath("site_visit");
    setIssuedAt(todayISO());
    setExpiresAt("");
    setEmployeeId("");
    setVisitedAt(todayISO());
    setAccessNotes("");
    setTerms("Valid for 30 days. Materials may change after site inspection.");
    if (requestNotes) setNotes(requestNotes);
    else setNotes("");
    if (customerName) {
      setCustomerLabel(customerName);
    }
    if (boundCustomerId) {
      pickCustomer(boundCustomerId);
    }
    if (requestAddress) {
      if (requestAddress.street) setStreet(requestAddress.street);
      if (requestAddress.city) setCity(requestAddress.city);
      if (requestAddress.state) setState(requestAddress.state);
      if (requestAddress.zip) setZip(requestAddress.zip);
    }
    if (!useApi && employees.length === 0) {
      void dispatch(fetchTeam({ role: "technician", force: true, limit: 100 }));
    }
  }, [
    boundCustomerId,
    customerName,
    open,
    requestAddress,
    requestName,
    requestNotes,
    useApi,
    employees.length,
    dispatch,
    estimate?.id,
  ]);

  // Hydrate edit form once per open+estimate — fetch full detail when possible.
  useEffect(() => {
    if (!open || !estimate?.id) return;
    let cancelled = false;

    function applySource(source: Estimate) {
      setSelectedCustomer(source.customerId);
      const cust = customers.find((item) => item.id === source.customerId);
      if (cust) setCustomerLabel(crmCustomerName(cust));
      else if (source.customerName) setCustomerLabel(source.customerName);
      setName(source.title?.trim() || "");
      setStreet(source.propertyAddress?.street || "");
      setCity(source.propertyAddress?.city || "");
      setState(source.propertyAddress?.state || "CO");
      setZip(source.propertyAddress?.zip || "");
      setIssuedAt((source.issuedAt || todayISO()).slice(0, 10));
      setExpiresAt(source.expiresAt ? source.expiresAt.slice(0, 10) : "");
      setNotes(source.notes || "");
      setTerms(
        source.terms ||
          "Valid for 30 days. Materials may change after site inspection.",
      );
      const siteVisit =
        source.status === "site_visit" || Boolean(source.siteVisit);
      setPath(siteVisit ? "site_visit" : "office");
      setEmployeeId(source.siteVisit?.employeeId || "");
      setVisitedAt(
        (source.siteVisit?.visitedAt || todayISO()).slice(0, 10),
      );
      setAccessNotes(source.siteVisit?.accessNotes || "");
      setLines(
        (source.items || []).map((item) => ({
          id: item.id,
          description: item.description,
          kind: item.type === "labor" ? "labor" : "materials",
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
      );
      setSaving(false);
      setTab("customer");
    }

    applySource(estimate);
    void (async () => {
      try {
        const detail = await getEstimate(estimate.id);
        if (!cancelled && detail) applySource(detail);
      } catch {
        /* keep list-row hydrate */
      }
      if (!cancelled && !useApi && employees.length === 0) {
        void dispatch(
          fetchTeam({ role: "technician", force: true, limit: 100 }),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally only when dialog opens or the edited estimate id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per open
  }, [open, estimate?.id]);

  useEffect(() => {
    if (!open) return;
    if (tab === "visit" && !useApi && employees.length === 0) {
      void dispatch(fetchTeam({ role: "technician", force: true, limit: 100 }));
    }
  }, [open, tab, useApi, employees.length, dispatch]);

  useEffect(() => {
    if (!open || lockedCustomer || isEdit) return;
    if (selectedCustomer) return;
    const firstOption = customerOptions[0];
    if (firstOption) pickCustomer(firstOption.id, firstOption);
  }, [open, lockedCustomer, selectedCustomer, customerOptions, isEdit]);

  // Auto-detect location if empty and not yet attempted
  useEffect(() => {
    if (!open || isEdit) return;
    if (customerLocation.detectAttempted || customerLocation.detecting) return;
    if (hasLocation(customerLocation)) return;
    void dispatch(detectCurrentLocation());
  }, [
    customerLocation.detectAttempted,
    customerLocation.detecting,
    customerLocation,
    dispatch,
    open,
    isEdit,
  ]);

  // When location finishes detecting or is available, prefill if fields are empty
  useEffect(() => {
    if (!open || isEdit) return;
    if (!hasLocation(customerLocation)) return;
    const currentCustomer = customers.find(
      (item) => item.id === selectedCustomer,
    );
    const custAddr = currentCustomer?.addresses[0];
    if (!custAddr?.street && !street) {
      setStreet(customerLocation.address || "");
    }
    if (!custAddr?.city && !city) {
      setCity(customerLocation.city || "");
    }
    if (!custAddr?.state && (!state || state === "CO")) {
      setState(customerLocation.state || "CO");
    }
    if (!custAddr?.zip && !zip) {
      setZip(customerLocation.zip || "");
    }
  }, [
    customerLocation,
    customers,
    open,
    selectedCustomer,
    street,
    city,
    state,
    zip,
    isEdit,
  ]);

  function pickCustomer(id: string, option?: { id: string; label: string }) {
    setSelectedCustomer(id);
    if (option?.label) setCustomerLabel(option.label);
    else {
      const match = customers.find((item) => item.id === id);
      if (match) setCustomerLabel(crmCustomerName(match));
    }
    const next = customers.find((item) => item.id === id);
    const nextAddress = next?.addresses[0];
    if (
      nextAddress &&
      (nextAddress.street || nextAddress.address || nextAddress.city || nextAddress.zip)
    ) {
      setStreet(nextAddress.address || nextAddress.street || "");
      setCity(nextAddress.city || "");
      setState(nextAddress.state || "CO");
      setZip(nextAddress.zip || "");
      setLatitude(nextAddress.latitude ?? nextAddress.lat ?? null);
      setLongitude(nextAddress.longitude ?? nextAddress.lng ?? null);
    } else if (hasLocation(customerLocation)) {
      setStreet(customerLocation.address || "");
      setCity(customerLocation.city || "");
      setState(customerLocation.state || "CO");
      setZip(customerLocation.zip || "");
      setLatitude(customerLocation.latitude ?? null);
      setLongitude(customerLocation.longitude ?? null);
    }
  }

  function applyJobAddress(address: PlaceAddress) {
    setStreet(address.streetAddress.trim());
    setCity(address.city || "");
    setState(normalizeUsStateCode(address.state) || "");
    // Keep ZIP manually editable when Places has no postal code.
    if (address.zipCode) setZip(address.zipCode);
    setLatitude(
      typeof address.latitude === "number" && Number.isFinite(address.latitude)
        ? address.latitude
        : null,
    );
    setLongitude(
      typeof address.longitude === "number" &&
        Number.isFinite(address.longitude)
        ? address.longitude
        : null,
    );
    dispatch(setLocationFromPlace(address));
  }

  async function create() {
    // Prefer the customer id from the detail page URL / props.
    const customerIdValue = (boundCustomerId || selectedCustomer || "").trim();
    if (!customerIdValue || !name.trim() || saving) {
      if (!customerIdValue || !name.trim()) {
        toast.error("Customer and estimate name are required.");
        setTab("customer");
      }
      return;
    }
    if (!useApi) {
      toast.error("Sign in as a Pro to create estimates.");
      return;
    }
    setSaving(true);
    try {
      const siteVisitPayload =
        path === "site_visit"
          ? {
              employeeId,
              technician: technician ? employeeName(technician) : "",
              visitedAt,
              accessNotes,
              findings: estimate?.siteVisit?.findings || "",
              recommendations: estimate?.siteVisit?.recommendations || "",
              measurements: estimate?.siteVisit?.measurements || "",
              photos: estimate?.siteVisit?.photos || [],
            }
          : estimate?.siteVisit;

      if (isEdit && estimate) {
        const nextEstimate = buildEstimate({
          id: estimate.id,
          number: estimate.number,
          title: name.trim(),
          providerId: estimate.providerId || provider.id,
          customerId: customerIdValue,
          customerName:
            customerLabel ||
            (customer ? crmCustomerName(customer) : estimate.customerName),
          requestId: estimate.requestId || requestId,
          address: addressFrom(
            street,
            city,
            state,
            zip,
            estimate.propertyAddress?.id,
            { latitude, longitude, lat: latitude, lng: longitude },
          ),
          // Status has dedicated endpoints — keep existing on update.
          status: estimate.status,
          issuedAt,
          expiresAt: expiresAt || undefined,
          notes,
          terms,
          siteVisit: siteVisitPayload,
          lines,
        });
        const updated = await updateEstimateApi(estimate.id, {
          ...nextEstimate,
          discount: estimate.discount,
          attachments: estimate.attachments,
          signature: estimate.signature,
          shareToken: estimate.shareToken,
          shareUrl: estimate.shareUrl,
          isArchived: estimate.isArchived,
          isArchieved: estimate.isArchieved,
          createdAt: estimate.createdAt,
        });
        const saved = updated ?? nextEstimate;
        if (!saved?.id) throw new Error("Could not update this estimate.");
        writeCostLines(
          session?.email,
          saved.id,
          saved.items.map((item) => ({
            id: item.id,
            description: item.description,
            kind: item.type === "labor" ? "labor" : "materials",
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
          })),
        );
        if (path === "site_visit" && siteVisitPayload) {
          const visit = siteVisitFromRecord(siteVisitPayload);
          if (visit) writeSiteVisit(session?.email, saved.id, visit);
        }
        dispatch(invalidateEstimatesCache());
        void dispatch(fetchEstimates({ force: true }));
        onUpdated?.(saved);
        onOpenChange(false);
        toast.success(`${saved.number || "Estimate"} updated.`);
        return;
      }

      const estimateDraft = buildEstimate({
        number: nextRecordNumber(
          "EST",
          all.map((item) => item.number),
        ),
        title: name.trim(),
        providerId: provider.id,
        customerId: customerIdValue,
        customerName:
          customerLabel || (customer ? crmCustomerName(customer) : undefined),
        requestId,
        address: addressFrom(street, city, state, zip, undefined, {
          latitude,
          longitude,
          lat: latitude,
          lng: longitude,
        }),
        status: path === "site_visit" ? "site_visit" : "draft",
        issuedAt,
        expiresAt: expiresAt || undefined,
        notes,
        terms,
        siteVisit: path === "site_visit" ? siteVisitPayload : undefined,
        lines,
      });
      const created = await createEstimateApi(estimateDraft);
      if (!created?.id) {
        throw new Error("Could not create this estimate on the server.");
      }
      const saved = created;
      writeCostLines(
        session?.email,
        saved.id,
        saved.items.map((item) => ({
          id: item.id,
          description: item.description,
          kind: item.type === "labor" ? "labor" : "materials",
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
      );
      if (path === "site_visit" && siteVisitPayload) {
        const visit = siteVisitFromRecord(siteVisitPayload);
        if (visit) writeSiteVisit(session?.email, saved.id, visit);
      }
      dispatch(invalidateEstimatesCache());
      void dispatch(fetchEstimates({ force: true }));
      onCreated?.(saved);
      onOpenChange(false);
      toast.success(`${saved.number || "Estimate"} created.`);
      router.push(
        `/pro/dashboard/estimates/${saved.id}${path === "site_visit" ? "?tab=visit" : ""}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "Could not update this estimate."
            : "Could not create this estimate.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit estimate" : "Create estimate"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the estimate details. Changes are saved without leaving this customer."
                : "Send a team member for a site visit, or write the quote in the office. The customer signs the finalized estimate before the job starts."}
            </DialogDescription>
          </DialogHeader>
          <WizardTabs
            value={tab}
            onChange={setTab}
            options={
              path === "site_visit"
                ? [
                    { id: "customer", label: "Customer" },
                    { id: "visit", label: "Site visit" },
                    { id: "review", label: "Review" },
                  ]
                : [
                    { id: "customer", label: "Customer" },
                    { id: "scope", label: "Line items" },
                    { id: "review", label: "Review" },
                  ]
            }
          />
          {tab === "customer" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-[4px] border px-3 py-3 text-left",
                    path === "site_visit"
                      ? "border-[#003F7D] bg-[#e8eef5]"
                      : "border-black/15 bg-card",
                  )}
                  onClick={() => {
                    setPath("site_visit");
                    setTab((current) =>
                      current === "scope" ? "visit" : current,
                    );
                  }}
                >
                  <p className="text-sm font-semibold">Site visit first</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Send a team member to inspect, take photos, then finalize in
                    the office.
                  </p>
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-[4px] border px-3 py-3 text-left",
                    path === "office"
                      ? "border-[#003F7D] bg-[#e8eef5]"
                      : "border-black/15 bg-card",
                  )}
                  onClick={() => {
                    setPath("office");
                    setTab((current) =>
                      current === "visit" ? "scope" : current,
                    );
                  }}
                >
                  <p className="text-sm font-semibold">Write in the office</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Price the quote now, finalize, and send it for signature.
                  </p>
                </button>
              </div>
              {!lockedCustomer ? (
                <Field
                  label="Customer"
                  action={
                    <button
                      type="button"
                      onClick={() => setCreateCustomerOpen(true)}
                      className="text-xs font-medium text-primary hover:underline cursor-pointer"
                    >
                      + New customer
                    </button>
                  }
                >
                  <PaginatedEntitySelect
                    id="estimate-customer"
                    value={selectedCustomer}
                    options={customerOptions}
                    selectedLabel={customerLabel}
                    placeholder="Select customer"
                    emptyLabel="No customers found. Add a customer to continue."
                    loading={useApi ? customerPaging.loading : false}
                    loadingMore={useApi ? customerPaging.loadingMore : false}
                    hasMore={useApi ? customerPaging.hasMore : false}
                    onLoadMore={useApi ? customerPaging.loadMore : () => {}}
                    searchable={useApi}
                    searchValue={useApi ? customerPaging.search : ""}
                    onSearchChange={useApi ? customerPaging.setSearch : undefined}
                    searchPlaceholder="Search customers…"
                    onChange={(id, option) => pickCustomer(id, option)}
                  />
                </Field>
              ) : null}
              <Field label="Estimate name">
                <Input
                  value={name}
                  placeholder="Enter estimate name"
                  required
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="Issued">
                <Input
                  type="date"
                  value={issuedAt}
                  placeholder="mm/dd/yyyy"
                  onChange={(event) => setIssuedAt(event.target.value)}
                />
              </Field>
              <Field label="Expires">
                <Input
                  type="date"
                  value={expiresAt}
                  placeholder="mm/dd/yyyy"
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <GoogleAddressAutocomplete
                  id="estimate-job-address"
                  value={street}
                  onChange={setStreet}
                  onSelect={applyJobAddress}
                  placeholder="Start typing your address…"
                  autoComplete="off"
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(6.5rem,0.7fr)_minmax(5rem,0.55fr)]">
              <Field label="City">
                <Input
                  value={city}
                  placeholder="City"
                  onChange={(event) => setCity(event.target.value)}
                />
              </Field>
              <Field label="State">
                <UsStateSelect
                  value={normalizeUsStateCode(state)}
                  onChange={setState}
                  placeholder="State"
                />
              </Field>
              <Field label="ZIP">
                <Input
                  value={zip}
                  placeholder="ZIP"
                  onChange={(event) => setZip(event.target.value)}
                  inputMode="numeric"
                />
              </Field>
              </div>
            </div>
          ) : null}
          {tab === "visit" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Team member">
                <PaginatedEntitySelect
                  id="estimate-technician"
                  value={employeeId}
                  options={technicianOptions}
                  placeholder="Assign later"
                  selectedLabel={
                    technician
                      ? employeeName(technician)
                      : estimate?.siteVisit?.technician || undefined
                  }
                  emptyLabel="No team members found."
                  loading={useApi ? assigneePaging.loading : false}
                  loadingMore={useApi ? assigneePaging.loadingMore : false}
                  hasMore={useApi ? assigneePaging.hasMore : false}
                  onLoadMore={useApi ? assigneePaging.loadMore : () => {}}
                  searchable={useApi}
                  searchValue={useApi ? assigneePaging.search : ""}
                  onSearchChange={useApi ? assigneePaging.setSearch : undefined}
                  searchPlaceholder="Search team members…"
                  onChange={(id) => setEmployeeId(id)}
                />
              </Field>
              <Field label="Visit date">
                <Input
                  type="date"
                  value={visitedAt}
                  placeholder="mm/dd/yyyy"
                  onChange={(event) => setVisitedAt(event.target.value)}
                />
              </Field>
              <Field label="Access / site notes" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  placeholder="Gate code, pets, parking, who to ask for"
                  value={accessNotes}
                  onChange={(event) => setAccessNotes(event.target.value)}
                />
              </Field>
              <p className="sm:col-span-2 text-sm text-muted-foreground">
                Photos and findings are captured on the estimate after the
                team member is on site.
              </p>
            </div>
          ) : null}
          {tab === "scope" ? (
            <LineEditor lines={lines} onChange={setLines} />
          ) : null}
          {tab === "review" ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                {name} for{" "}
                {customerLabel ||
                  (customer ? crmCustomerName(customer) : "customer")}{" "}
                · {street || "No street"}
              </p>
              <Field label="Notes">
                <Textarea
                  rows={3}
                  placeholder="Optional notes for this estimate"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
              <Field label="Terms">
                <Textarea
                  rows={3}
                  placeholder="Payment and validity terms"
                  value={terms}
                  onChange={(event) => setTerms(event.target.value)}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            {tab !== "customer" ? (
              <Button variant="outline" onClick={() => setTab(prevTab(tab))}>
                Back
              </Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}
            {tab === "review" ? (
              <Button
                data-action="submit-estimate"
                disabled={!hasEstimateName || saving}
                onClick={create}
              >
                {saving
                  ? isEdit
                    ? "Saving…"
                    : "Creating…"
                  : isEdit
                    ? "Save estimate"
                    : "Create estimate"}
              </Button>
            ) : (
              <Button
                disabled={!hasEstimateName}
                onClick={() => setTab(nextTab(tab))}
              >
                Continue
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateCustomerDialog
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
      />
    </>
  );
}

export function CreateJobDialog({
  open,
  onOpenChange,
  customerId,
  estimate,
  job,
  onCreated,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  estimate?: Estimate;
  /** When set, dialog edits this job (PUT) instead of creating. */
  job?: Job | null;
  onCreated?: (job: Job) => void;
  onUpdated?: (job: Job) => void;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const customerLocation = useAppSelector((state) => state.location);
  const { session, provider, estimates, jobs } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { employees } = usePortalCrew();
  const records = usePortalRecords();
  const allEstimates = records.mergeEstimates(estimates);
  const allJobs = records.mergeJobs(jobs);
  const first = customers[0];
  const isEdit = Boolean(job?.id);
  const [tab, setTab] = useState<JobTab>("customer");
  const [sourceId, setSourceId] = useState(estimate?.id ?? "");
  const [linkedEstimate, setLinkedEstimate] = useState<Estimate | null>(
    estimate ?? null,
  );
  const source =
    linkedEstimate ?? allEstimates.find((item) => item.id === sourceId);
  const [name, setName] = useState(
    source?.items[0]?.description.replace(/ labor$/i, "") ?? "Service visit",
  );
  const [selectedCustomer, setSelectedCustomer] = useState(
    customerId ?? estimate?.customerId ?? first?.id ?? "",
  );
  const [customerLabel, setCustomerLabel] = useState("");
  const customer =
    customers.find((item) => item.id === selectedCustomer) ?? first;
  const address = source?.propertyAddress ?? customer?.addresses[0];
  const [street, setStreet] = useState(
    address?.street || customerLocation.address || "",
  );
  const [city, setCity] = useState(
    address?.city || customerLocation.city || "",
  );
  const [state, setState] = useState(
    normalizeUsStateCode(address?.state || customerLocation.state) || "CO",
  );
  const [zip, setZip] = useState(address?.zip || customerLocation.zip || "");
  const [latitude, setLatitude] = useState<number | null>(
    address?.latitude ?? customerLocation.latitude ?? null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    address?.longitude ?? customerLocation.longitude ?? null,
  );
  const [start, setStart] = useState(todayISO());
  const [due, setDue] = useState("");
  const [status, setStatus] = useState<JobStatus>("unscheduled");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<JobCostLine[]>(() =>
    source
      ? source.items.map((item) => ({
          id: item.id,
          description: item.description,
          kind: item.type === "labor" ? "labor" : "materials",
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        }))
      : [],
  );
  // Opened from customer detail / estimate detail / edit → customer is fixed from that page.
  const boundCustomerId = (
    customerId ||
    estimate?.customerId ||
    job?.customerId ||
    ""
  ).trim();
  const lockedCustomer = Boolean(boundCustomerId);
  const estimateFilter = useMemo(
    () => (boundCustomerId ? { customerId: boundCustomerId } : {}),
    [boundCustomerId],
  );

  const technicianFilter = useMemo(() => ({ role: "technician" }), []);
  const customerPaging = usePaginatedCrmOptions(
    open && useApi && !lockedCustomer ? "customer" : null,
    open && useApi && !lockedCustomer,
  );
  const estimatePaging = usePaginatedCrmOptions(
    open && useApi && tab === "customer" ? "estimate" : null,
    open && useApi && tab === "customer",
    undefined,
    estimateFilter,
  );
  const assigneePaging = usePaginatedCrmOptions(
    open && useApi ? "assignee" : null,
    open && useApi,
    undefined,
    technicianFilter,
  );

  const customerOptions = useMemo(
    () =>
      useApi
        ? customerPaging.options
        : customers.map((item) => ({
            id: item.id,
            label: crmCustomerName(item),
          })),
    [useApi, customerPaging.options, customers],
  );
  const estimateOptions = useMemo(() => {
    const localRows = boundCustomerId
      ? allEstimates.filter((item) => item.customerId === boundCustomerId)
      : allEstimates;
    const rows = useApi
      ? estimatePaging.options
      : localRows.map((item) => ({
          id: item.id,
          label: item.number || item.id,
        }));
    return [{ id: "", label: "New job (creates a draft quote)" }, ...rows];
  }, [useApi, estimatePaging.options, allEstimates, boundCustomerId]);
  const technicianOptions = useMemo(() => {
    const rows = useApi
      ? assigneePaging.options
      : employees
          .filter((item) => {
            const role = String(item.role || "").toLowerCase().trim();
            return (
              item.active !== false &&
              (role === "technician" || role === "tech")
            );
          })
          .map((item) => ({
            id: item.id,
            label: `${employeeName(item)}${item.trade ? ` · ${item.trade}` : ""}`,
          }));
    return [{ id: "", label: "Unassigned" }, ...rows];
  }, [useApi, assigneePaging.options, employees]);
  const statusOptions = useMemo(
    () =>
      JOB_STATUSES.map((item) => ({ id: item, label: jobStatusLabel(item) })),
    [],
  );

  const assignedTo =
    employeeLabel ||
    (() => {
      const match = employees.find((item) => item.id === employeeId);
      return match ? employeeName(match) : "";
    })();

  useEffect(() => {
    if (!open) {
      setTab("customer");
      return;
    }
    // Always bind to the customer from the detail page URL / props.
    if (boundCustomerId && !job?.id) {
      setSelectedCustomer(boundCustomerId);
      const match = customers.find((item) => item.id === boundCustomerId);
      if (match) setCustomerLabel(crmCustomerName(match));
    }
    // Prefill from estimate only when creating (not editing).
    if (!job?.id && estimate?.id) void pickSource(estimate.id);
    if (!useApi && employees.length === 0) {
      void dispatch(fetchTeam({ role: "technician", force: true, limit: 100 }));
    }
  }, [estimate, open, boundCustomerId, customers, job?.id, useApi, employees.length, dispatch]);

  // Hydrate edit form once per open+job — do not re-run on customers/employees
  // changes or typing will be wiped on every keystroke.
  useEffect(() => {
    if (!open || !job?.id) return;
    setSelectedCustomer(job.customerId);
    const cust = customers.find((item) => item.id === job.customerId);
    if (cust) setCustomerLabel(crmCustomerName(cust));
    setSourceId(job.estimateId || "");
    setLinkedEstimate(null);
    setName(job.title?.trim() || job.number || "Service visit");
    setStreet(job.address?.street || "");
    setCity(job.address?.city || "");
    setState(job.address?.state || "");
    setZip(job.address?.zip || "");
    setLatitude(job.address?.latitude ?? null);
    setLongitude(job.address?.longitude ?? null);
    setStart((job.scheduledAt || todayISO()).slice(0, 10));
    setDue(job.dueAt ? job.dueAt.slice(0, 10) : "");
    setStatus(job.status || "unscheduled");
    setNotes(job.notes || "");
    setLines(seedJobLines(job));
    const assigned = (job.assignedTo || "").trim();
    const matchEmp = employees.find(
      (item) => item.id === assigned || employeeName(item) === assigned,
    );
    setEmployeeId(matchEmp?.id || "");
    setEmployeeLabel(matchEmp ? employeeName(matchEmp) : assigned);
    // Intentionally only when dialog opens or the edited job id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per open
  }, [open, job?.id]);

  useEffect(() => {
    if (!open || lockedCustomer || selectedCustomer || job?.id) return;
    const firstOption = customerOptions[0];
    if (firstOption) {
      setSelectedCustomer(firstOption.id);
      setCustomerLabel(firstOption.label);
    }
  }, [open, lockedCustomer, selectedCustomer, customerOptions, job?.id]);

  // Auto-detect location if empty and not yet attempted
  useEffect(() => {
    if (!open || job?.id) return;
    if (customerLocation.detectAttempted || customerLocation.detecting) return;
    if (hasLocation(customerLocation)) return;
    void dispatch(detectCurrentLocation());
  }, [
    customerLocation.detectAttempted,
    customerLocation.detecting,
    customerLocation,
    dispatch,
    open,
    job?.id,
  ]);

  // When location finishes detecting or is available, prefill if fields are empty
  useEffect(() => {
    if (!open || sourceId || job?.id) return;
    if (!hasLocation(customerLocation)) return;
    const currentCustomer = customers.find(
      (item) => item.id === selectedCustomer,
    );
    const custAddr = currentCustomer?.addresses[0];
    if (!custAddr?.street && !street) {
      setStreet(customerLocation.address || "");
    }
    if (!custAddr?.city && !city) {
      setCity(customerLocation.city || "");
    }
    if (!custAddr?.state && !state) {
      setState(customerLocation.state || "");
    }
    if (!custAddr?.zip && !zip) {
      setZip(customerLocation.zip || "");
    }
    if (latitude == null && customerLocation.latitude != null) {
      setLatitude(customerLocation.latitude);
    }
    if (longitude == null && customerLocation.longitude != null) {
      setLongitude(customerLocation.longitude);
    }
  }, [
    customerLocation,
    customers,
    open,
    selectedCustomer,
    sourceId,
    street,
    city,
    state,
    zip,
    job?.id,
    latitude,
    longitude,
  ]);

  function applyEstimateSource(next: Estimate) {
    setLinkedEstimate(next);
    // Never overwrite the customer when creating from a customer detail page.
    if (!boundCustomerId) {
      setSelectedCustomer(next.customerId);
      const match = customers.find((item) => item.id === next.customerId);
      if (match) setCustomerLabel(crmCustomerName(match));
    }
    setStreet(next.propertyAddress.street || "");
    setCity(next.propertyAddress.city || "");
    setState(next.propertyAddress.state || "");
    setZip(next.propertyAddress.zip || "");
    setLatitude(next.propertyAddress.latitude ?? null);
    setLongitude(next.propertyAddress.longitude ?? null);
    setName(next.items[0]?.description.replace(/ labor$/i, "") ?? name);
    setLines(
      next.items.map((item) => ({
        id: item.id,
        description: item.description,
        kind: item.type === "labor" ? "labor" : "materials",
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      })),
    );
  }

  async function pickSource(id: string) {
    setSourceId(id);
    if (!id) {
      setLinkedEstimate(null);
      return;
    }
    const local = allEstimates.find((item) => item.id === id);
    if (local) {
      if (
        boundCustomerId &&
        local.customerId &&
        local.customerId !== boundCustomerId
      ) {
        toast.error("That estimate belongs to a different customer.");
        setSourceId("");
        setLinkedEstimate(null);
        return;
      }
      applyEstimateSource(local);
      return;
    }
    try {
      const remote = await getEstimate(id);
      if (!remote) return;
      if (
        boundCustomerId &&
        remote.customerId &&
        remote.customerId !== boundCustomerId
      ) {
        toast.error("That estimate belongs to a different customer.");
        setSourceId("");
        setLinkedEstimate(null);
        return;
      }
      applyEstimateSource(remote);
    } catch {
      toast.error("Could not load that estimate.");
    }
  }

  function applyJobAddress(address: PlaceAddress) {
    setStreet(address.streetAddress.trim());
    setCity(address.city || "");
    setState(normalizeUsStateCode(address.state) || "");
    // Keep ZIP editable — only fill when Places returns one.
    if (address.zipCode) setZip(address.zipCode);
    setLatitude(address.latitude);
    setLongitude(address.longitude);
    dispatch(setLocationFromPlace(address));
  }

  async function create() {
    // Prefer the customer id from the detail page URL / props.
    const jobCustomerId = (boundCustomerId || selectedCustomer).trim();
    if (!jobCustomerId || !name.trim() || saving) {
      if (!jobCustomerId || !name.trim()) {
        toast.error("Customer and job name are required.");
        setTab("customer");
      }
      return;
    }
    setSaving(true);
    try {
      const workLines = filledWorkLines(lines);
      const jobCoords = {
        latitude: latitude ?? customerLocation.latitude ?? null,
        longitude: longitude ?? customerLocation.longitude ?? null,
      };

      const techId = employeeId.trim();
      if (isEdit && job) {
        const nextJob = buildJob({
          id: job.id,
          number: job.number,
          title: name.trim(),
          providerId: job.providerId || provider.id,
          customerId: jobCustomerId,
          estimateId: job.estimateId || source?.id || undefined,
          serviceId: job.serviceId,
          address: addressFrom(
            street,
            city,
            state,
            zip,
            job.address?.id,
            jobCoords,
          ),
          assignedTo: techId || undefined,
          scheduledAt: start,
          dueAt: due || undefined,
          // Status has a separate PUT /jobs/:id/status endpoint — do not change it here.
          status: job.status,
          notes,
          lines: workLines,
        });
        let saved: Job;
        if (useApi) {
          saved = await dispatch(
            updateCustomerJob({
              id: job.id,
              job: {
                ...nextJob,
                changeOrders: job.changeOrders,
                createdAt: job.createdAt,
              },
              employees,
              customerId: jobCustomerId,
            }),
          ).unwrap();
        } else {
          saved = {
            ...nextJob,
            changeOrders: job.changeOrders,
            createdAt: job.createdAt,
          };
          toast.error("Sign in as a Pro to update jobs.");
          return;
        }
        writeCostLines(session?.email, saved.id, workLines);
        onUpdated?.(saved);
        onOpenChange(false);
        toast.success(`${saved.number || "Job"} updated.`);
        return;
      }

      let estimateId = source?.id || "";

      // Offline / local-only path still keeps a draft quote on file.
      if (!source && !useApi) {
        const linked = buildEstimate({
          number: nextRecordNumber(
            "EST",
            allEstimates.map((item) => item.number),
          ),
          providerId: provider.id,
          customerId: jobCustomerId,
          customerName:
            customerLabel || (customer ? crmCustomerName(customer) : undefined),
          address: addressFrom(street, city, state, zip, undefined, jobCoords),
          status: "accepted",
          notes,
          lines: workLines,
        });
        records.addEstimate(linked);
        estimateId = linked.id;
      }

      const createdJob = buildJob({
        number: nextRecordNumber(
          "JOB",
          allJobs.map((item) => item.number),
        ),
        title: name.trim(),
        providerId: provider.id,
        customerId: jobCustomerId,
        estimateId: estimateId || undefined,
        address: addressFrom(street, city, state, zip, undefined, jobCoords),
        // Technician select id → job.assignedTo → assignedEmployees[]
        assignedTo: techId || undefined,
        scheduledAt: start,
        dueAt: due || undefined,
        status,
        notes,
        lines: workLines,
      });

      let saved: Job;
      if (useApi) {
        // MD: POST /api/provider/jobs { customerId, estimateId?, title, items, scheduledAt, ... }
        saved = await dispatch(
          createCustomerJob({ job: createdJob, employees }),
        ).unwrap();
      } else {
        const created = await Promise.resolve(records.addJob(createdJob));
        saved = created ?? createdJob;
        if (estimateId) {
          records.linkRecords("estimate", estimateId, saved.id);
          records.setStatus("estimate", estimateId, "accepted");
        }
      }

      if (estimateId) {
        writeCostLines(session?.email, estimateId, workLines);
      }
      writeCostLines(session?.email, saved.id, workLines);
      onCreated?.(saved);
      onOpenChange(false);
      toast.success(`${saved.number || "Job"} created.`);
      router.push(`/pro/dashboard/jobs/${saved.id}`);
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : isEdit
              ? "Could not update this job."
              : "Could not create this job.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit job" : "Create job"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update schedule, status, and line items for this job."
              : "Open field work from a written estimate, or start a job and keep a quote on file."}
          </DialogDescription>
        </DialogHeader>
        <WizardTabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "customer", label: "Customer" },
            { id: "schedule", label: "Schedule" },
            { id: "review", label: "Review" },
          ]}
        />
        {tab === "customer" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {!isEdit ? (
              <Field label="From estimate">
                <PaginatedEntitySelect
                  id="job-from-estimate"
                  value={sourceId}
                  options={estimateOptions}
                  placeholder="Select estimate"
                  emptyLabel="No estimates found."
                  loading={useApi ? estimatePaging.loading : false}
                  loadingMore={useApi ? estimatePaging.loadingMore : false}
                  hasMore={useApi ? estimatePaging.hasMore : false}
                  onLoadMore={useApi ? estimatePaging.loadMore : () => {}}
                  searchable={useApi}
                  searchValue={useApi ? estimatePaging.search : ""}
                  onSearchChange={useApi ? estimatePaging.setSearch : undefined}
                  searchPlaceholder="Search estimates…"
                  onChange={(id) => void pickSource(id)}
                />
              </Field>
            ) : null}
            {!lockedCustomer && !sourceId && !isEdit ? (
              <Field label="Customer">
                <PaginatedEntitySelect
                  id="job-customer"
                  value={selectedCustomer}
                  options={customerOptions}
                  selectedLabel={customerLabel}
                  placeholder="Select customer"
                  emptyLabel="No customers found. Add a customer to continue."
                  loading={useApi ? customerPaging.loading : false}
                  loadingMore={useApi ? customerPaging.loadingMore : false}
                  hasMore={useApi ? customerPaging.hasMore : false}
                  onLoadMore={useApi ? customerPaging.loadMore : () => {}}
                  searchable={useApi}
                  searchValue={useApi ? customerPaging.search : ""}
                  onSearchChange={useApi ? customerPaging.setSearch : undefined}
                  searchPlaceholder="Search customers…"
                  onChange={(id, option) => {
                    setSelectedCustomer(id);
                    if (option?.label) setCustomerLabel(option.label);
                  }}
                />
              </Field>
            ) : null}
            <Field label="Job name">
              <Input
                value={name}
                placeholder="Enter job name"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <GoogleAddressAutocomplete
                id="job-address-autocomplete"
                value={street}
                onChange={setStreet}
                onSelect={applyJobAddress}
                placeholder="Start typing your address…"
                autoComplete="off"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(6.5rem,0.7fr)_minmax(5rem,0.55fr)]">
            <Field label="City">
              <Input
                value={city}
                placeholder="City"
                onChange={(event) => setCity(event.target.value)}
              />
            </Field>
            <Field label="State">
              <UsStateSelect
                value={normalizeUsStateCode(state)}
                onChange={setState}
                placeholder="State"
              />
            </Field>
            <Field label="ZIP">
              <Input
                value={zip}
                placeholder="ZIP"
                onChange={(event) => setZip(event.target.value)}
                inputMode="numeric"
              />
            </Field>
            </div>
          </div>
        ) : null}
        {tab === "schedule" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start">
              <Input
                type="date"
                value={start}
                placeholder="mm/dd/yyyy"
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label="Due">
              <Input
                type="date"
                value={due}
                placeholder="mm/dd/yyyy"
                onChange={(event) => setDue(event.target.value)}
              />
            </Field>
            <Field label="Team member">
              <PaginatedEntitySelect
                id="job-technician"
                value={employeeId}
                selectedLabel={employeeLabel}
                options={technicianOptions}
                placeholder="Unassigned"
                emptyLabel="No team members found."
                loading={useApi ? assigneePaging.loading : false}
                loadingMore={useApi ? assigneePaging.loadingMore : false}
                hasMore={useApi ? assigneePaging.hasMore : false}
                onLoadMore={useApi ? assigneePaging.loadMore : () => {}}
                searchable={useApi}
                searchValue={useApi ? assigneePaging.search : ""}
                onSearchChange={useApi ? assigneePaging.setSearch : undefined}
                searchPlaceholder="Search team members…"
                onChange={(id, option) => {
                  setEmployeeId(id);
                  setEmployeeLabel(option?.label && id ? option.label : "");
                }}
              />
            </Field>
            {!isEdit ? (
              <Field label="Status">
                <PaginatedEntitySelect
                  id="job-status"
                  value={status}
                  options={statusOptions}
                  selectedLabel={jobStatusLabel(status)}
                  placeholder="Select status"
                  emptyLabel="No statuses available."
                  hasMore={false}
                  onLoadMore={() => {}}
                  onChange={(id) => setStatus(id as JobStatus)}
                />
              </Field>
            ) : null}
            <div className="sm:col-span-2">
              <LineEditor lines={lines} onChange={setLines} />
            </div>
          </div>
        ) : null}
        {tab === "review" ? (
          <Field label="Notes">
            <Textarea
              rows={4}
              placeholder="Optional job notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        ) : null}
        <DialogFooter>
          {tab !== "customer" ? (
            <Button
              variant="outline"
              onClick={() => setTab(tab === "review" ? "schedule" : "customer")}
            >
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {tab === "review" ? (
            <Button
              data-action="submit-job"
              disabled={saving}
              onClick={() => void create()}
            >
              {saving
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create job"}
            </Button>
          ) : (
            <Button
              onClick={() => setTab(tab === "customer" ? "schedule" : "review")}
            >
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LineEditor({
  lines,
  onChange,
}: {
  lines: JobCostLine[];
  onChange: (lines: JobCostLine[]) => void;
}) {
  return (
    <div className="space-y-3">
      <LineItemsActions
        onAddLabor={() => onChange([...lines, createEmptyLine("labor")])}
        onAddMaterial={() => onChange([...lines, createEmptyLine("materials")])}
        className="justify-start"
      />
      <LineItemsEditor lines={lines} onChange={onChange} allowMaterialImages />
    </div>
  );
}

const LEAD_WINDOWS: { value: PortalTimeWindow; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "all_day", label: "All Day" },
];

export function CreateLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const customerLocation = useAppSelector((state) => state.location);
  const { provider, requests } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const all = records.mergeRequests(requests);
  const first = customers[0];
  const [customerId, setCustomerId] = useState(first?.id ?? "");
  const [customerLabel, setCustomerLabel] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [details, setDetails] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTimeWindow, setPreferredTimeWindow] = useState<PortalTimeWindow>("morning");
  const customer = customers.find((item) => item.id === customerId) ?? first;
  const address = customer?.addresses[0];

  const customerPaging = usePaginatedCrmOptions(
    open && useApi ? "customer" : null,
    open && useApi,
  );
  const customerOptions = useMemo(
    () =>
      useApi
        ? customerPaging.options
        : customers.map((item) => ({
            id: item.id,
            label: crmCustomerName(item),
          })),
    [useApi, customerPaging.options, customers],
  );

  useEffect(() => {
    if (!open) return;
    setServiceName("");
    setDetails("");
    setPreferredDate("");
    setPreferredTimeWindow("morning");
    if (!customerId && customerOptions[0]) {
      setCustomerId(customerOptions[0].id);
      setCustomerLabel(customerOptions[0].label);
    }
  }, [open, customerId, customerOptions]);

  const [submitting, setSubmitting] = useState(false);

  async function save() {
    if (!customerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (!serviceName.trim()) {
      toast.error("Please enter a service name.");
      return;
    }
    if (!details.trim()) {
      toast.error("Please enter details of what the customer asked for.");
      return;
    }
    if (!preferredDate) {
      toast.error("Please select a preferred date.");
      return;
    }
    if (!preferredTimeWindow) {
      toast.error("Please select a time window.");
      return;
    }

    setSubmitting(true);
    try {
      let created: PortalRequest | null = null;
      if (useApi) {
        try {
          created = await createRequest({
            customerId,
            serviceName: serviceName.trim(),
            channel: "direct",
            details: details.trim(),
            preferredDate,
            preferredTimeWindow,
          });
        } catch (error) {
          const msg = extractErrorMessage(error);
          toast.error(msg || "Failed to create lead.");
          return;
        }
      }

      const displayName =
        customerLabel || (customer ? crmCustomerName(customer) : "Customer");
      const request: PortalRequest = created || {
        id: `req_${Date.now().toString(36)}`,
        number: nextRecordNumber(
          "RS",
          all.map((item) => item.number),
        ),
        customerId,
        providerId: provider.id,
        categoryId: provider.categoryIds[0] ?? "plumbing",
        channel: "direct",
        zip: address?.zip || customerLocation.zip || "",
        city: address?.city || customerLocation.city || provider.city,
        state: address?.state || customerLocation.state || provider.state,
        details: details.trim(),
        preferredDate,
        preferredTimeWindow,
        photoUrls: [],
        status: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customerName: displayName,
        customerEmail: customer?.email ?? "",
        customerPhone: customer?.phone ?? "",
        serviceName: serviceName.trim(),
        categoryName: "Service",
        neighborhood: address?.city || customerLocation.city || provider.city,
      };

      records.addRequest(request);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CRM_API_EVENT));
      }
      toast.success(`${request.number} added to leads.`);
      onOpenChange(false);
      router.push(`/pro/dashboard/requests/${request.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Create lead</DialogTitle>
          <DialogDescription>
            Log a phone, walk-in, or referral request before you write the
            estimate.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={<>Customer <span className="text-destructive">*</span></>}>
            <PaginatedEntitySelect
              id="lead-customer"
              value={customerId}
              options={customerOptions}
              selectedLabel={customerLabel}
              placeholder="Select customer"
              emptyLabel="No customers found. Add a customer to continue."
              loading={useApi ? customerPaging.loading : false}
              loadingMore={useApi ? customerPaging.loadingMore : false}
              hasMore={useApi ? customerPaging.hasMore : false}
              onLoadMore={useApi ? customerPaging.loadMore : () => {}}
              searchable={useApi}
              searchValue={useApi ? customerPaging.search : ""}
              onSearchChange={useApi ? customerPaging.setSearch : undefined}
              searchPlaceholder="Search customers…"
              onChange={(id, option) => {
                setCustomerId(id);
                if (option?.label) setCustomerLabel(option.label);
              }}
            />
          </Field>
          <Field label={<>Service <span className="text-destructive">*</span></>}>
            <Input
              value={serviceName}
              placeholder="Leak detection and repair"
              onChange={(event) => setServiceName(event.target.value)}
            />
          </Field>
          <Field label={<>What they asked for <span className="text-destructive">*</span></>}>
            <Textarea
              value={details}
              placeholder="Details from the call or walk-in"
              onChange={(event) => setDetails(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={<>Preferred date <span className="text-destructive">*</span></>}>
              <Input
                type="date"
                value={preferredDate}
                placeholder="mm/dd/yyyy"
                onChange={(event) => setPreferredDate(event.target.value)}
              />
            </Field>
            <Field label={<>Window <span className="text-destructive">*</span></>}>
              <NativeSelect
                className="w-full"
                value={preferredTimeWindow}
                onChange={(event) => setPreferredTimeWindow(event.target.value as PortalTimeWindow)}
              >
                {LEAD_WINDOWS.map((item) => (
                  <NativeSelectOption key={item.value} value={item.value}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            disabled={
              !serviceName.trim() ||
              !customerId ||
              !details.trim() ||
              !preferredDate ||
              !preferredTimeWindow ||
              submitting
            }
            onClick={() => void save()}
          >
            {submitting ? "Saving…" : "Save lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WizardTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 border-b border-black/10 pb-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-[4px] px-3 py-1.5 text-sm",
            value === option.id
              ? "bg-[#e8eef5] font-semibold text-[#003F7D]"
              : "text-muted-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  action,
  children,
  className,
}: {
  label: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5 text-sm", className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
