"use client";

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ClipboardList, ImageIcon, Loader2, MapPinned, Upload } from "lucide-react";
import {
  extractUploadedUrl,
  uploadDoc,
  uploadFile,
} from "@/components/api/uploadFile";
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
  createEstimateActivity,
  getEstimate,
  updateEstimate as updateEstimateApi,
  createRequest,
} from "@/lib/api/crm-client";
import { syncCalendarAssignment } from "@/lib/portal-schedule-sync";
import { normalizeUsStateCode } from "@/lib/data/us-states";
import {
  seedJobLines,
  writeCostLines,
  type JobCostLine,
} from "@/components/portal/use-job-costing";
import {
  siteVisitFromRecord,
  writeSiteVisit,
  type JobAttachment,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type EstimateTab = "customer" | "prep" | "visit" | "schedule" | "scope";
type EstimatePath = "site_visit" | "office" | "";
type JobTab = "customer" | "schedule" | "review";

const ESTIMATE_TIME_SLOTS = (() => {
  const slots: { value: string; startMinutes: number; endMinutes: number; label: string }[] = [];
  const formatClock = (totalMinutes: number) => {
    const clamped = ((totalMinutes % 1440) + 1440) % 1440;
    const hours24 = Math.floor(clamped / 60);
    const mins = clamped % 60;
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
  };
  for (let min = 0; min < 1440; min += 30) {
    slots.push({
      value: String(min),
      startMinutes: min,
      endMinutes: min + 30,
      label: `${formatClock(min)} – ${formatClock(min + 30)}`,
    });
  }
  return slots;
})();

function siteVisitActivityDescription(input: {
  date: string;
  startMinutes?: number;
  endMinutes?: number;
  technician?: string;
  visitLabel?: string;
}) {
  const dateLabel = input.date
    ? new Date(`${input.date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";
  const start = typeof input.startMinutes === "number" ? input.startMinutes : 540;
  const end = typeof input.endMinutes === "number" ? input.endMinutes : start + 30;
  const fmt = (m: number) => {
    const h24 = Math.floor(m / 60) % 24;
    const mins = m % 60;
    const period = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(mins).padStart(2, "0")} ${period}`;
  };
  const tech = String(input.technician || "").trim() || "Unassigned";
  const visit = input.visitLabel ? `<p><strong>${input.visitLabel}</strong></p>` : "";
  return `${visit}<p><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#e8eef5;color:#003F7D;font-weight:600;font-size:12px;">Site visit scheduled</span></p><p><strong>Date:</strong> ${dateLabel}</p><p><strong>Time:</strong> ${fmt(start)} – ${fmt(end)}</p><p><strong>Technician:</strong> ${tech}</p>`;
}

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

  // New estimates go through estimate-v2 — do not create classic estimates here.
  useEffect(() => {
    if (!open || isEdit) return;
    const qs = new URLSearchParams();
    if (customerId) qs.set("customer", customerId);
    if (requestId) qs.set("request", requestId);
    onOpenChange(false);
    router.push(
      `/pro/dashboard/new-estimate/new${qs.toString() ? `?${qs}` : ""}`,
    );
  }, [open, isEdit, customerId, requestId, onOpenChange, router]);

  const [tab, setTab] = useState<EstimateTab>("customer");
  const [path, setPath] = useState<EstimatePath>("");
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
  const [employeeId, setEmployeeId] = useState("");
  const [visitedAt, setVisitedAt] = useState(todayISO());
  const [scheduleTimeSlot, setScheduleTimeSlot] = useState("540");
  const [visitFindings, setVisitFindings] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [visitPhotos, setVisitPhotos] = useState<JobAttachment[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoDropOver, setPhotoDropOver] = useState(false);
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
    null,
    false,
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
    return [{ id: "", label: "Assign later (optional)" }, ...rows];
  }, [useApi, assigneePaging.options, employees]);

  const wizardOptions = useMemo(() => {
    const base = [{ id: "customer" as const, label: "Customer" }];
    if (!path) {
      return [...base, { id: "prep" as const, label: "Prepare" }];
    }
    if (path === "site_visit") {
      return [
        ...base,
        { id: "prep" as const, label: "Prepare" },
        { id: "visit" as const, label: "Site visit" },
        { id: "scope" as const, label: "Labour & Material" },
      ];
    }
    return [
      ...base,
      { id: "prep" as const, label: "Prepare" },
      { id: "scope" as const, label: "Labour & Material" },
    ];
  }, [path]);

  const nextTab = (current: EstimateTab): EstimateTab => {
    if (current === "customer") return "prep";
    if (current === "prep") {
      if (path === "site_visit") return "visit";
      if (path === "office") return "scope";
      return "prep";
    }
    if (current === "visit") return "scope";
    return "scope";
  };
  const prevTab = (current: EstimateTab): EstimateTab => {
    if (current === "scope") {
      return path === "site_visit" ? "visit" : "prep";
    }
    if (current === "visit") return "prep";
    if (current === "prep") return "customer";
    return "customer";
  };

  useEffect(() => {
    if (tab === "schedule") setTab(path === "site_visit" ? "visit" : "prep");
  }, [tab, path]);

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
    setPath("");
    setIssuedAt(todayISO());
    setEmployeeId("");
    setVisitedAt(todayISO());
    setScheduleTimeSlot("540");
    setVisitFindings("");
    setVisitNotes("");
    setVisitPhotos([]);
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
      setVisitFindings(source.siteVisit?.findings || "");
      setVisitNotes(source.siteVisit?.accessNotes || "");
      setVisitPhotos(
        (source.siteVisit?.photos || []).map((photo) => ({
          id: photo.id,
          name: photo.name,
          type: photo.type,
          size: photo.size,
          dataUrl: photo.url,
          addedAt: photo.addedAt,
          actor: photo.actor || "",
        })),
      );
      setScheduleTimeSlot("540");
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

  const scheduleSlot =
    ESTIMATE_TIME_SLOTS.find((slot) => slot.value === scheduleTimeSlot) ??
    ESTIMATE_TIME_SLOTS.find((slot) => slot.value === "540") ??
    ESTIMATE_TIME_SLOTS[0];
  const scheduleStartMinutes = scheduleSlot?.startMinutes ?? 540;
  const scheduleEndMinutes = scheduleSlot?.endMinutes ?? scheduleStartMinutes + 30;
  const techName =
    (technician ? employeeName(technician) : "") ||
    (employeeId
      ? technicianOptions.find((option) => option.id === employeeId)?.label || ""
      : "");

  function canContinueFromTab(current: EstimateTab) {
    if (current === "customer") {
      return (
        hasEstimateName &&
        Boolean((boundCustomerId || selectedCustomer || "").trim())
      );
    }
    if (current === "prep") return Boolean(path);
    return true;
  }

  async function uploadVisitPhotos(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length || uploadingPhotos) return;
    setUploadingPhotos(true);
    const added: JobAttachment[] = [];
    try {
      for (const file of files) {
        if (file.size > 15 * 1024 * 1024) {
          toast.error(`${file.name} is over 15 MB.`);
          continue;
        }
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        const response = isPdf ? await uploadDoc(file) : await uploadFile(file);
        const url = extractUploadedUrl(response.data);
        if (!url) throw new Error(`Could not upload ${file.name}.`);
        added.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
          size: file.size,
          dataUrl: url,
          addedAt: new Date().toISOString(),
          actor: "",
        });
      }
      if (added.length) {
        setVisitPhotos((prev) => [...added, ...prev]);
        toast.success(
          added.length === 1
            ? `${added[0].name} uploaded.`
            : `${added.length} photos uploaded.`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload that photo.",
      );
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function create() {
    // Prefer the customer id from the detail page URL / props.
    const customerIdValue = (boundCustomerId || selectedCustomer || "").trim();
    if (!customerIdValue || !name.trim() || saving) {
      if (!customerIdValue || !name.trim()) {
        toast.error("Customer and estimate title are required.");
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
      const visitPhotosPayload = visitPhotos.map((photo) => ({
        id: photo.id,
        name: photo.name,
        type: photo.type,
        size: photo.size,
        url: photo.dataUrl,
        addedAt: photo.addedAt,
        actor: photo.actor || "",
      }));
      const siteVisitPayload =
        path === "site_visit"
          ? {
              id: `visit_${Date.now()}`,
              label: "Visit 1",
              employeeId: "",
              technician: "",
              visitedAt: "",
              scheduledAt: "",
              createdAt: new Date().toISOString(),
              findings: visitFindings,
              recommendations: estimate?.siteVisit?.recommendations || "",
              measurements: estimate?.siteVisit?.measurements || "",
              photos: visitPhotosPayload,
              accessNotes: visitNotes,
            }
          : estimate?.siteVisit;

      async function syncSiteVisitSideEffects(
        savedId: string,
        visit: NonNullable<typeof siteVisitPayload>,
      ) {
        // Schedule is done later by the provider on the estimate — do not
        // create a calendar entry during estimate create.
        const record = siteVisitFromRecord(visit);
        if (record) writeSiteVisit(session?.email, savedId, record);
      }

      if (isEdit && estimate) {
        const taxRatePercent = await (
          await import("@/lib/tax/state-tax")
        ).fetchTaxRatePercent(state);
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
          status: estimate.status,
          issuedAt,
          notes,
          terms,
          siteVisit: siteVisitPayload,
          lines,
          taxRatePercent,
        });
        const siteVisits =
          path === "site_visit" && siteVisitPayload
            ? [
                ...(estimate.siteVisits || []).filter(
                  (visit) => visit.id && visit.id !== siteVisitPayload.id,
                ),
                siteVisitPayload,
              ]
            : estimate.siteVisits;
        const updated = await updateEstimateApi(estimate.id, {
          ...nextEstimate,
          siteVisits,
          discount: estimate.discount,
          attachments: estimate.attachments,
          signature: estimate.signature,
          shareToken: estimate.shareToken,
          shareUrl: estimate.shareUrl,
          isArchived: estimate.isArchived,
          isArchieved: estimate.isArchieved,
          createdAt: estimate.createdAt,
        });
        const saved = updated ?? { ...nextEstimate, siteVisits };
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
          await syncSiteVisitSideEffects(saved.id, siteVisitPayload);
        }
        dispatch(invalidateEstimatesCache());
        void dispatch(fetchEstimates({ force: true }));
        onUpdated?.(saved);
        onOpenChange(false);
        toast.success(`${saved.number || "Estimate"} updated.`);
        return;
      }

      const taxRatePercent = await (
        await import("@/lib/tax/state-tax")
      ).fetchTaxRatePercent(state);
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
        status: "draft",
        issuedAt,
        notes,
        terms,
        siteVisit: path === "site_visit" ? siteVisitPayload : undefined,
        lines,
        taxRatePercent,
      });
      const created = await createEstimateApi({
        ...estimateDraft,
        siteVisits:
          path === "site_visit" && siteVisitPayload
            ? [siteVisitPayload]
            : undefined,
      });
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
        await syncSiteVisitSideEffects(saved.id, siteVisitPayload);
      }
      dispatch(invalidateEstimatesCache());
      void dispatch(fetchEstimates({ force: true }));
      onCreated?.(saved);
      onOpenChange(false);
      toast.success(`${saved.number || "Estimate"} created.`);
      router.push(
        `/pro/dashboard/new-estimate/${saved.id}${path === "site_visit" ? "?tab=visit" : ""}`,
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
        <DialogContent className="flex max-h-[min(92vh,54rem)] w-[calc(100%-1.5rem)] flex-col gap-4 overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit estimate" : "Create estimate"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update customer, visit, and pricing for this estimate."
                : "Add the estimate title and customer, then choose how to prepare it."}
            </DialogDescription>
          </DialogHeader>
          <WizardTabs
            value={tab === "schedule" ? "visit" : tab}
            onChange={(next) => {
              if (next === "visit" && path !== "site_visit") return;
              if (next === "scope" && !path) return;
              setTab(next);
            }}
            options={wizardOptions}
          />
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          {tab === "customer" ? (
            <div className="grid gap-3 sm:grid-cols-2">
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
                    addLabel="Add customer"
                    onAdd={() => setCreateCustomerOpen(true)}
                    onChange={(id, option) => pickCustomer(id, option)}
                  />
                </Field>
              ) : null}
              <Field
                label="Estimate Title"
                className={lockedCustomer ? "sm:col-span-2" : undefined}
              >
                <Input
                  value={name}
                  placeholder="Enter estimate title"
                  required
                  onChange={(event) => setName(event.target.value)}
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
              <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3">
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
          {tab === "prep" ? (
            <div className="flex w-full flex-col gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#003F7D]">
                  Preparation method
                </p>
                <h3 className="text-base font-semibold text-foreground">
                  How would you like to prepare this estimate?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose one path to continue. You can schedule the site visit later from the estimate.
                </p>
              </div>

              <div
                className="grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Estimate preparation method"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={path === "site_visit"}
                  className={cn(
                    "flex h-full w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    path === "site_visit"
                      ? "border-[#003F7D] bg-[#f3f7fb] ring-1 ring-[#003F7D]"
                      : "border-input bg-background hover:border-[#003F7D]/40 hover:bg-secondary/30",
                  )}
                  onClick={() => setPath("site_visit")}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md border",
                      path === "site_visit"
                        ? "border-[#003F7D]/20 bg-white text-[#003F7D]"
                        : "border-input bg-secondary/50 text-muted-foreground",
                    )}
                  >
                    <MapPinned className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        After a Site Visit
                      </span>
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border",
                          path === "site_visit"
                            ? "border-[#003F7D] bg-[#003F7D] text-white"
                            : "border-input bg-white text-transparent",
                        )}
                        aria-hidden="true"
                      >
                        <Check className="size-3 stroke-[3]" />
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                      Add visit notes and photos first. Schedule the visit later when ready.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={path === "office"}
                  className={cn(
                    "flex h-full w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    path === "office"
                      ? "border-[#003F7D] bg-[#f3f7fb] ring-1 ring-[#003F7D]"
                      : "border-input bg-background hover:border-[#003F7D]/40 hover:bg-secondary/30",
                  )}
                  onClick={() => setPath("office")}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md border",
                      path === "office"
                        ? "border-[#003F7D]/20 bg-white text-[#003F7D]"
                        : "border-input bg-secondary/50 text-muted-foreground",
                    )}
                  >
                    <ClipboardList className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Create Estimate Directly
                      </span>
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border",
                          path === "office"
                            ? "border-[#003F7D] bg-[#003F7D] text-white"
                            : "border-input bg-white text-transparent",
                        )}
                        aria-hidden="true"
                      >
                        <Check className="size-3 stroke-[3]" />
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                      Skip the site visit and go straight to labour and materials.
                    </span>
                  </span>
                </button>
              </div>
            </div>
          ) : null}
          {tab === "visit" && path === "site_visit" ? (
            <div className="grid gap-4">
              <Field label="Site Visit information">
                <Textarea
                  rows={4}
                  placeholder="Describe the visit scope, ticket details, POC, and what to inspect…"
                  value={visitFindings}
                  onChange={(event) => setVisitFindings(event.target.value)}
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  rows={3}
                  placeholder="Gate code, parking, pets, who to ask for…"
                  value={visitNotes}
                  onChange={(event) => setVisitNotes(event.target.value)}
                />
              </Field>
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Upload images</h3>
                  <p className="text-[11px] text-muted-foreground">
                    PNG, JPG, or PDF up to 15 MB
                  </p>
                </div>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 transition-colors",
                    photoDropOver
                      ? "border-primary bg-secondary"
                      : "border-input bg-transparent",
                  )}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setPhotoDropOver(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setPhotoDropOver(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setPhotoDropOver(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setPhotoDropOver(false);
                    if (event.dataTransfer.files.length) {
                      void uploadVisitPhotos(event.dataTransfer.files);
                    }
                  }}
                >
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="sr-only"
                    disabled={uploadingPhotos}
                    onChange={(event) => {
                      if (event.target.files?.length) {
                        void uploadVisitPhotos(event.target.files);
                        event.target.value = "";
                      }
                    }}
                  />
                  {uploadingPhotos ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <Upload className="size-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {uploadingPhotos ? "Uploading…" : "Drop photos here or browse"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Optional — you can add more later on the estimate.
                    </p>
                  </div>
                </label>
                {visitPhotos.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {visitPhotos.map((photo) => (
                      <li
                        key={photo.id}
                        className="flex items-center gap-2 rounded-md border border-input px-2 py-1.5 text-sm"
                      >
                        <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{photo.name}</span>
                        <button
                          type="button"
                          className="text-xs text-destructive hover:underline"
                          onClick={() =>
                            setVisitPhotos((prev) =>
                              prev.filter((item) => item.id !== photo.id),
                            )
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No photos yet.</p>
                )}
              </div>
            </div>
          ) : null}
          {tab === "scope" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-input bg-secondary/40 px-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    Labour &amp; materials are optional — you can skip and add them later.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={!hasEstimateName || saving}
                    onClick={() => void create()}
                  >
                    Skip &amp; create estimate
                  </Button>
                </div>
              <LineEditor lines={lines} onChange={setLines} />
            </div>
          ) : null}
          </div>
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
            {tab === "scope" ? (
              <Button
                data-action="submit-estimate"
                disabled={!hasEstimateName || saving}
                onClick={() => void create()}
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
                disabled={!canContinueFromTab(tab)}
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
        onSaved={(created) => {
          pickCustomer(created.id, {
            id: created.id,
            label: crmCustomerName(created),
          });
          customerPaging.prependOption({
            id: created.id,
            label: crmCustomerName(created),
          });
        }}
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
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
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
          assignedTo: techId || "",
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
                assignedEmployeeId: techId || "",
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
        if (start) {
          await syncCalendarAssignment({
            kind: "job",
            recordId: saved.id,
            title: saved.number || name.trim() || "Job",
            date: start,
            endDate: due || start,
            employeeId: techId || null,
            status: "scheduled",
          });
        }
        onUpdated?.(saved);
        onOpenChange(false);
        toast.success(`${saved.number || "Job"} updated.`);
        return;
      }

      let estimateId = source?.id || "";

      // Offline / local-only path still keeps a draft quote on file.
      if (!source && !useApi) {
        const taxRatePercent = await (
          await import("@/lib/tax/state-tax")
        ).fetchTaxRatePercent(state);
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
          taxRatePercent,
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
        assignedTo: techId || "",
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
          createCustomerJob({
            job: { ...createdJob, assignedEmployeeId: techId || "" },
            employees,
          }),
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
      // Put Start / assignee on the Schedule calendar when a date is set.
      if (start) {
        await syncCalendarAssignment({
          kind: "job",
          recordId: saved.id,
          title: saved.number || name.trim() || "Job",
          date: start,
          endDate: due || start,
          employeeId: techId || null,
          status: status === "unscheduled" ? "scheduled" : "scheduled",
        });
      }
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
    <>
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
                  emptyLabel="No estimates found. Create an estimate first."
                  loading={useApi ? estimatePaging.loading : false}
                  loadingMore={useApi ? estimatePaging.loadingMore : false}
                  hasMore={useApi ? estimatePaging.hasMore : false}
                  onLoadMore={useApi ? estimatePaging.loadMore : () => {}}
                  searchable={useApi}
                  searchValue={useApi ? estimatePaging.search : ""}
                  onSearchChange={useApi ? estimatePaging.setSearch : undefined}
                  searchPlaceholder="Search estimates…"
                  addLabel="Create estimate"
                  onAdd={() => {
                    onOpenChange(false);
                    router.push("/pro/dashboard/new-estimate");
                  }}
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
                  addLabel="Add customer"
                  onAdd={() => setCreateCustomerOpen(true)}
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
            <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3">
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
                addLabel="Add team member"
                onAdd={() => {
                  onOpenChange(false);
                  router.push("/pro/dashboard/team");
                }}
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
    <CreateCustomerDialog
      open={createCustomerOpen}
      onOpenChange={setCreateCustomerOpen}
      onSaved={(created) => {
        const label = crmCustomerName(created);
        setSelectedCustomer(created.id);
        setCustomerLabel(label);
        customerPaging.prependOption({ id: created.id, label });
      }}
    />
    </>
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
      <LineItemsEditor
        lines={lines}
        onChange={onChange}
        allowMaterialImages
        wideDescription
      />
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
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
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
            source: "phone",
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
        source: "phone",
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
    <>
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
              addLabel="Add customer"
              onAdd={() => setCreateCustomerOpen(true)}
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
    <CreateCustomerDialog
      open={createCustomerOpen}
      onOpenChange={setCreateCustomerOpen}
      onSaved={(created) => {
        const label = crmCustomerName(created);
        setCustomerId(created.id);
        setCustomerLabel(label);
        customerPaging.prependOption({ id: created.id, label });
      }}
    />
    </>
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
    <div className="flex gap-1 border-b border-input pb-2">
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
