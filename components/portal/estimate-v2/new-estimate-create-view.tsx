"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PortalPage } from "@/components/portal/portal-page";
import { CreateCustomerDialog } from "@/components/portal/create-person-dialogs";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import {
  AddressFields,
  type AddressFieldsValue,
} from "@/components/shared/address-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { CenteredSpinner } from "@/components/ui/spinner";
import { crmCustomerName, type PortalCustomerCrm } from "@/lib/data/crm-people";
import { getServiceCategoryById } from "@/lib/data/services";
import {
  createEstimateV2Opportunity,
  updateEstimateV2Opportunity,
  createEstimateV2SiteAssessment,
  listEstimateV2Opportunities,
  type PrepChoice,
} from "@/lib/api/estimate-v2-client";
import { getRequest, updateCustomer } from "@/lib/api/crm-client";
import {
  findTemplateCategory,
  getEstimateTemplateCatalog,
  type EstimateTemplateCategory,
} from "@/lib/api/estimate-templates-client";
import { QuoteAnswersCard, quoteNotesFromDetails } from "@/components/portal/quote-answers-card";
import type { QuoteAnswer } from "@/lib/data/portal";
import type { ServiceAddress } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthProvider, selectAuthUser } from "@/store/authSlice";
import { fetchCustomers } from "@/store/customersSlice";
import { cn } from "@/lib/utils";

const EMPTY_PROPERTY: AddressFieldsValue = {
  address: "",
  city: "",
  state: "",
  zip: "",
  lat: null,
  lng: null,
};

const SETUP_CATEGORIES_VALUE = "__setup_service_categories__";
const PROFILE_CATEGORIES_HREF = "/pro/dashboard/profile?step=categories";

function serviceAddressToFields(addr?: ServiceAddress | null): AddressFieldsValue {
  if (!addr) return EMPTY_PROPERTY;
  const street = String(addr.address || addr.street || "").trim();
  return {
    address: street,
    city: String(addr.city || "").trim(),
    state: String(addr.state || "").trim(),
    zip: String(addr.zip || "").trim(),
    lat: addr.lat ?? addr.latitude ?? null,
    lng: addr.lng ?? addr.longitude ?? null,
  };
}

type Step = "customer" | "request" | "prep";

function addressLine(addr: {
  address?: string;
  street?: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
}) {
  const street = [addr.address || addr.street, addr.unit].filter(Boolean).join(" ");
  const cityLine = [addr.city, addr.state, addr.zip].filter(Boolean).join(" ");
  return [street, cityLine].filter(Boolean).join(", ");
}

export function NewEstimateCreateView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestParam = String(searchParams.get("request") || "").trim();
  const customerParam = String(searchParams.get("customer") || "").trim();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const reduxCustomers = useAppSelector((state) => state.customers?.items || []);
  const customersLoading = useAppSelector((state) => Boolean(state.customers?.loading));
  const { customers: directoryCustomers } = useCrmDirectory();

  const providerCategories = useMemo(() => {
    const ids = Array.isArray(authProvider?.services?.categoryIds)
      ? authProvider.services.categoryIds
      : [];
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string }> = [];
    for (const id of ids) {
      const category = getServiceCategoryById(id);
      const name = (category?.name || category?.shortName || "").trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      list.push({ id, name });
    }
    return list;
  }, [authProvider?.services?.categoryIds]);

  const [step, setStep] = useState<Step>("customer");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [resolvingLead, setResolvingLead] = useState(Boolean(requestParam));
  const [localCustomers, setLocalCustomers] = useState<PortalCustomerCrm[]>([]);
  const [linkedRequestId, setLinkedRequestId] = useState(requestParam);

  const [customerId, setCustomerId] = useState(customerParam);
  const [customerQuery, setCustomerQuery] = useState("");
  const [addressId, setAddressId] = useState("");

  const [newProperty, setNewProperty] = useState<AddressFieldsValue>(EMPTY_PROPERTY);
  const [sameAsCustomerAddress, setSameAsCustomerAddress] = useState(false);

  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [templateCatalog, setTemplateCatalog] = useState<EstimateTemplateCategory[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [leadAnswers, setLeadAnswers] = useState<QuoteAnswer[]>([]);

  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  useEffect(() => {
    if (!useApi) return;
    void dispatch(fetchCustomers({ force: true, limit: 100 }));
  }, [dispatch, useApi]);

  // Reuse existing opportunity for this lead, otherwise prefill from the request.
  useEffect(() => {
    if (!useApi || !requestParam) {
      setResolvingLead(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const existing = await listEstimateV2Opportunities({
          requestId: requestParam,
          limit: 1,
          page: 1,
        });
        const first = existing.items[0];
        if (!cancelled && first?.id) {
          router.replace(`/pro/dashboard/new-estimate/${first.id}`);
          return;
        }
        const request = await getRequest(requestParam, { silent: true });
        if (cancelled || !request) {
          setResolvingLead(false);
          return;
        }
        setLinkedRequestId(request.id);
        if (request.customerId) setCustomerId(request.customerId);
        if (request.serviceName) setCategoryName(request.serviceName);
        const requestTitle =
          String(request.serviceName || "").trim() ||
          String(request.number || "").trim() ||
          "Work request";
        setTitle(requestTitle);
        const notes = quoteNotesFromDetails(request.details);
        if (notes) setDescription(notes);
        setLeadAnswers(
          (request.answers || []).filter(
            (item) => String(item.label || "").trim() && String(item.value || "").trim(),
          ),
        );
        setStep("customer");
      } catch {
        /* allow manual create */
      } finally {
        if (!cancelled) setResolvingLead(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useApi, requestParam, router]);

  useEffect(() => {
    if (customerParam && !customerId) setCustomerId(customerParam);
  }, [customerParam, customerId]);

  // Subcategories (offered jobs) for the picked category — they choose the ready-made template.
  useEffect(() => {
    if (!useApi) return;
    getEstimateTemplateCatalog()
      .then(setTemplateCatalog)
      .catch(() => setTemplateCatalog([]));
  }, [useApi]);
  const subcategoryOptions = useMemo(
    () => findTemplateCategory(templateCatalog, categoryName)?.subcategories || [],
    [templateCatalog, categoryName],
  );
  // A subcategory from another category no longer applies once the category changes.
  const validSubcategory = subcategoryOptions.some((item) => item.name === subcategoryName) ? subcategoryName : "";

  useEffect(() => {
    if (!useApi || !customerQuery.trim()) return;
    const handle = window.setTimeout(() => {
      void dispatch(
        fetchCustomers({
          force: true,
          limit: 50,
          search: customerQuery.trim(),
          page: 1,
        }),
      );
    }, 300);
    return () => window.clearTimeout(handle);
  }, [customerQuery, dispatch, useApi]);

  const customers = useMemo(() => {
    const map = new Map<string, PortalCustomerCrm>();
    for (const item of [
      ...directoryCustomers,
      ...reduxCustomers,
      ...localCustomers,
    ]) {
      if (item?.id) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [directoryCustomers, localCustomers, reduxCustomers]);

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === customerId) || null,
    [customers, customerId],
  );

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 40);
    return customers
      .filter((item) => {
        const hay = `${crmCustomerName(item)} ${item.email || ""} ${item.phone || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [customers, customerQuery]);

  const addresses = selectedCustomer?.addresses || [];

  useEffect(() => {
    setSameAsCustomerAddress(false);
    setNewProperty(EMPTY_PROPERTY);
  }, [selectedCustomer?.id]);

  useEffect(() => {
    if (!selectedCustomer) {
      setAddressId("");
      return;
    }
    const preferred = addresses[0]?.id || "";
    setAddressId((prev) => (prev && addresses.some((a) => a.id === prev) ? prev : preferred));
  }, [selectedCustomer?.id, addresses]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sameAsCustomerAddress || !selectedCustomer) return;
    const primary = selectedCustomer.addresses?.[0];
    if (!primary) {
      setSameAsCustomerAddress(false);
      toast.error("This customer has no saved address to copy.");
      return;
    }
    setNewProperty(serviceAddressToFields(primary));
    if (primary.id) setAddressId(primary.id);
  }, [sameAsCustomerAddress, selectedCustomer]);

  const selectedAddress = addresses.find((item) => item.id === addressId) || addresses[0];

  useEffect(() => {
    if (!categoryName) return;
    const stillValid = providerCategories.some(
      (item) => item.name.toLowerCase() === categoryName.trim().toLowerCase(),
    );
    if (!stillValid) setCategoryName("");
  }, [providerCategories, categoryName]);

  /** The provider typed a separate property but has not pressed "Add property" yet. */
  const typedNewProperty =
    !sameAsCustomerAddress &&
    Boolean(newProperty.address.trim() || newProperty.city.trim() || newProperty.zip.trim());

  async function addPropertyToCustomer({ fromContinue = false } = {}): Promise<boolean> {
    if (!selectedCustomer) return false;
    if (!selectedCustomer.id || !/^[a-f\d]{24}$/i.test(selectedCustomer.id)) {
      toast.error("Customer is not saved on the server yet. Create the customer again.");
      return false;
    }
    const street = newProperty.address.trim();
    const city = newProperty.city.trim();
    const state = newProperty.state.trim();
    const zip = newProperty.zip.trim();
    if (!street || !city || !state || !zip) {
      toast.error(
        fromContinue
          ? "Finish the new service location (street, city, state and ZIP), or clear it to use the selected property."
          : "Street, city, state, and ZIP are required for the property.",
      );
      return false;
    }
    setSavingAddress(true);
    try {
      const nextAddress: ServiceAddress = {
        id: `addr_${Date.now().toString(36)}`,
        label: "Service location",
        address: street,
        street,
        city,
        state,
        zip,
        country: "US",
        lat: newProperty.lat,
        lng: newProperty.lng,
        latitude: newProperty.lat,
        longitude: newProperty.lng,
      };
      const saved = await updateCustomer(selectedCustomer.id, {
        ...selectedCustomer,
        addresses: [...(selectedCustomer.addresses || []), nextAddress],
      });
      if (!saved?.id) {
        throw new Error("Property was saved but the server response could not be read.");
      }
      setLocalCustomers((prev) => {
        const others = prev.filter((item) => item.id !== saved.id);
        return [...others, saved];
      });
      setCustomerId(saved.id);
      setAddressId(saved.addresses?.[saved.addresses.length - 1]?.id || nextAddress.id);
      setNewProperty(EMPTY_PROPERTY);
      setSameAsCustomerAddress(false);
      toast.success("Property added.");
      void dispatch(fetchCustomers({ force: true, limit: 100, page: 1, search: "" }));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add property.");
      return false;
    } finally {
      setSavingAddress(false);
    }
  }

  /**
   * A separately typed service location wins over the highlighted saved one:
   * save it to the customer, select it, then continue — so the estimate gets
   * the address the provider entered, not the customer's primary address.
   */
  async function continueFromCustomerStep() {
    if (typedNewProperty) {
      const saved = await addPropertyToCustomer({ fromContinue: true });
      if (!saved) return;
    }
    setStep("request");
  }

  async function handleCreateAndContinue(prepChoice: PrepChoice) {
    if (!selectedCustomer || !selectedAddress) {
      toast.error("Select a customer and property first.");
      setStep("customer");
      return;
    }
    if (!providerCategories.length) {
      toast.error("Set your service categories in Business profile first.");
      router.push(PROFILE_CATEGORIES_HREF);
      return;
    }
    if (!categoryName.trim()) {
      toast.error("Select a service category.");
      setStep("request");
      return;
    }
    if (!title.trim()) {
      toast.error("Add a request title.");
      setStep("request");
      return;
    }

    setSaving(true);
    try {
      const opportunity = await createEstimateV2Opportunity({
        customerId: selectedCustomer.id,
        propertyAddress: {
          label: selectedAddress.label || "Service location",
          addressId:
            selectedAddress.id && /^[a-f\d]{24}$/i.test(selectedAddress.id)
              ? selectedAddress.id
              : undefined,
          address: selectedAddress.address || selectedAddress.street || "",
          street: selectedAddress.street || selectedAddress.address || "",
          unit: selectedAddress.unit || "",
          city: selectedAddress.city || "",
          state: selectedAddress.state || "",
          zip: selectedAddress.zip || "",
          lat: selectedAddress.lat || selectedAddress.latitude || 0,
          lng: selectedAddress.lng || selectedAddress.longitude || 0,
        },
        title: title.trim(),
        description: description.trim(),
        categoryName: categoryName.trim(),
        subcategoryName: validSubcategory || undefined,
        source: linkedRequestId ? "lead" : "manual",
        requestId: linkedRequestId || undefined,
        internalNotes: internalNotes.trim(),
      });

      await updateEstimateV2Opportunity(opportunity.id, { prepChoice });

      if (prepChoice === "schedule_assessment") {
        const customerDescription = description.trim();
        const officeNotes = internalNotes.trim();
        await createEstimateV2SiteAssessment(opportunity.id, {
          status: "scheduled",
          visitType: "initial_assessment",
          instructions: customerDescription || title.trim(),
          // Copies from estimate create — edits on the visit stay on the assessment only.
          customerRequirements: customerDescription,
          findings: officeNotes || customerDescription,
        });
        toast.success("Estimate created. Schedule the site assessment next.");
      } else {
        toast.success("Estimate created. Continue in the workspace.");
      }

      // Create now → the workspace asks Manual vs Ready-made template.
      router.push(
        `/pro/dashboard/new-estimate/${opportunity.id}${prepChoice === "create_now" || prepChoice === "have_information" ? "?start=1" : ""}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create estimate.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalPage
      eyebrow="Work / Estimate"
      title="New estimate"
      description="Start with the customer and property, capture the work request, then choose how the estimate will be prepared."
      actions={
        <Button variant="outline" size="sm" onClick={() => router.push("/pro/dashboard/new-estimate")}>
          Back to list
        </Button>
      }
    >
      {resolvingLead ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 py-12">
          <CenteredSpinner />
          <p className="text-sm text-muted-foreground">Opening estimate from lead…</p>
        </div>
      ) : null}
      <div className={cn(resolvingLead && "hidden")}>
      <div className="flex flex-wrap gap-2 border-b border-input pb-3">
        {(
          [
            ["customer", "1. Customer & property"],
            ["request", "2. Work request"],
            ["prep", "3. Prepare estimate"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              // Leaving step 1 with a typed service location saves it first.
              if (step === "customer" && id !== "customer" && typedNewProperty) {
                void addPropertyToCustomer({ fromContinue: true }).then((saved) => saved && setStep(id));
                return;
              }
              setStep(id);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              step === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {step === "customer" ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-input bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Customer</h2>
                <p className="text-xs text-muted-foreground">
                  Search an existing customer or create a new one without leaving this flow.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setCreateCustomerOpen(true)}>
                + New customer
              </Button>
            </div>
            <Input
              className="mt-3"
              placeholder="Search by name, email, or phone"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
            />
            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {customersLoading && !filteredCustomers.length ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Loading customers…
                </p>
              ) : null}
              {filteredCustomers.map((item: PortalCustomerCrm) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCustomerId(item.id)}
                  className={cn(
                    "flex w-full flex-col rounded-md border px-3 py-2 text-left text-sm transition",
                    customerId === item.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-secondary/60",
                  )}
                >
                  <span className="font-medium">{crmCustomerName(item)}</span>
                  <span className="text-xs text-muted-foreground">
                    {[item.email, item.phone].filter(Boolean).join(" · ") || "No contact yet"}
                  </span>
                </button>
              ))}
              {!customersLoading && !filteredCustomers.length ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  No customers match. Create a new customer to continue.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-input bg-card p-4">
            <h2 className="text-sm font-semibold">Service location</h2>
            <p className="text-xs text-muted-foreground">
              The estimate belongs to a specific property, not only the customer.
            </p>
            {!selectedCustomer ? (
              <p className="mt-6 text-sm text-muted-foreground">Select a customer to see properties.</p>
            ) : !addresses.length ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  This customer has no saved addresses yet. Add a property here to continue.
                </p>
                <AddressFields
                  idPrefix="new-est-property-empty"
                  value={newProperty}
                  onChange={(next) => {
                    setSameAsCustomerAddress(false);
                    setNewProperty(next);
                  }}
                  disabled={savingAddress}
                  addressPlaceholder="Start typing a street address…"
                />
                <Button
                  size="sm"
                  disabled={savingAddress}
                  onClick={() => void addPropertyToCustomer()}
                >
                  {savingAddress ? "Saving…" : "Add property"}
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => setAddressId(addr.id)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                      addressId === addr.id
                        ? "border-primary bg-primary/5"
                        : "border-input hover:bg-secondary/60",
                    )}
                  >
                    <p className="font-medium">{addr.label || "Property"}</p>
                    <p className="text-xs text-muted-foreground">{addressLine(addr)}</p>
                  </button>
                ))}
                <div className="rounded-md border border-dashed border-input p-3">
                  <p className="text-xs font-medium text-muted-foreground">Add another property</p>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={sameAsCustomerAddress}
                      onCheckedChange={(checked) => {
                        const on = checked === true;
                        setSameAsCustomerAddress(on);
                        if (!on) setNewProperty(EMPTY_PROPERTY);
                      }}
                      disabled={savingAddress || !selectedCustomer.addresses?.[0]}
                    />
                    <span>Same as customer address</span>
                  </label>
                  <div className="mt-2 space-y-3">
                    <AddressFields
                      idPrefix="new-est-property-add"
                      value={newProperty}
                      onChange={(next) => {
                        setSameAsCustomerAddress(false);
                        setNewProperty(next);
                      }}
                      disabled={savingAddress || sameAsCustomerAddress}
                      addressPlaceholder="Start typing a street address…"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingAddress}
                      onClick={() => void addPropertyToCustomer()}
                    >
                      {savingAddress ? "Saving…" : "Add property"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                disabled={!selectedCustomer || savingAddress || (!selectedAddress && !typedNewProperty)}
                onClick={() => void continueFromCustomerStep()}
              >
                {savingAddress ? "Saving…" : "Continue"}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {step === "request" ? (
        <section className="mt-4 rounded-xl border border-input bg-card p-4">
          <h2 className="text-sm font-semibold">Work request</h2>
          <p className="text-xs text-muted-foreground">
            Capture enough detail for the estimate before deciding how to price it.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Service category</Label>
              <Select
                value={categoryName || undefined}
                onValueChange={(value) => {
                  if (value === SETUP_CATEGORIES_VALUE) {
                    router.push(PROFILE_CATEGORIES_HREF);
                    return;
                  }
                  setCategoryName(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      providerCategories.length
                        ? "Select category"
                        : "Set your service categories"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {providerCategories.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={SETUP_CATEGORIES_VALUE}>
                    {providerCategories.length
                      ? "Manage service categories…"
                      : "Set your service categories…"}
                  </SelectItem>
                </SelectContent>
              </Select>
              {!providerCategories.length ? (
                <p className="text-xs text-muted-foreground">
                  No categories on your business profile yet.{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => router.push(PROFILE_CATEGORIES_HREF)}
                  >
                    Set them in Business profile
                  </button>
                  .
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Subcategory (optional)</Label>
              <Select
                value={validSubcategory || undefined}
                onValueChange={setSubcategoryName}
                disabled={!subcategoryOptions.length}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={categoryName ? "Select subcategory" : "Pick a category first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {subcategoryOptions.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Loads the matching ready-made estimate template.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="opp-title">Request title</Label>
              <Input
                id="opp-title"
                placeholder="Replace upstairs HVAC system"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="opp-desc">Customer description</Label>
              <Textarea
                id="opp-desc"
                rows={4}
                placeholder="What does the customer need? Symptoms, goals, constraints…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {leadAnswers.length ? (
              <div className="sm:col-span-2">
                <QuoteAnswersCard compact answers={leadAnswers} />
              </div>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="opp-notes">Internal notes</Label>
              <Textarea
                id="opp-notes"
                rows={3}
                placeholder="Office-only notes (not shown on the customer proposal)"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep("customer")}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={!title.trim() || !categoryName.trim()}
              onClick={() => {
                if (!providerCategories.length) {
                  toast.error("Set your service categories in Business profile first.");
                  router.push(PROFILE_CATEGORIES_HREF);
                  return;
                }
                if (!categoryName.trim()) {
                  toast.error("Select a service category.");
                  return;
                }
                setStep("prep");
              }}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {step === "prep" ? (
        <section className="mt-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">How will this estimate be prepared?</h2>
            <p className="text-xs text-muted-foreground">
              Pick the path that matches this job. Site assessment is optional — not forced.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                {
                  id: "schedule_assessment" as const,
                  title: "Schedule site assessment",
                  body: "Someone needs to visit the property before we can price the work.",
                },
                {
                  id: "have_information" as const,
                  title: "I already have the information",
                  body: "Skip the visit — enter photos, notes, and work items you already have.",
                },
                {
                  id: "create_now" as const,
                  title: "Create estimate now",
                  body: "I'm with the customer or on-site and can build the estimate immediately.",
                },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={saving}
                onClick={() => void handleCreateAndContinue(option.id)}
                className="rounded-xl border border-input bg-card p-4 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-60"
              >
                <p className="text-sm font-semibold">{option.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.body}</p>
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setStep("request")}>
            Back
          </Button>
        </section>
      ) : null}
      </div>

      <CreateCustomerDialog
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        onSaved={(customer) => {
          if (!customer?.id) {
            toast.error("Customer was not saved to the server.");
            return;
          }
          setLocalCustomers((prev) => {
            const others = prev.filter((item) => item.id !== customer.id);
            return [...others, customer];
          });
          setCustomerId(customer.id);
          // Keep the search box empty so list fetch isn't filtered away from the new customer.
          setCustomerQuery("");
          void dispatch(fetchCustomers({ force: true, limit: 100, page: 1, search: "" }));
        }}
      />
    </PortalPage>
  );
}
