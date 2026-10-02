"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { crmCustomerName, type PortalCustomerCrm } from "@/lib/data/crm-people";
import { getServiceCategoryById } from "@/lib/data/services";
import {
  createEstimateV2Opportunity,
  updateEstimateV2Opportunity,
  createEstimateV2SiteAssessment,
  type PrepChoice,
} from "@/lib/api/estimate-v2-client";
import { updateCustomer } from "@/lib/api/crm-client";
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
  const [localCustomers, setLocalCustomers] = useState<PortalCustomerCrm[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [addressId, setAddressId] = useState("");

  const [newProperty, setNewProperty] = useState<AddressFieldsValue>(EMPTY_PROPERTY);
  const [sameAsCustomerAddress, setSameAsCustomerAddress] = useState(false);

  const [categoryName, setCategoryName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  useEffect(() => {
    if (!useApi) return;
    void dispatch(fetchCustomers({ force: true, limit: 100 }));
  }, [dispatch, useApi]);

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

  async function addPropertyToCustomer() {
    if (!selectedCustomer) return;
    if (!selectedCustomer.id || !/^[a-f\d]{24}$/i.test(selectedCustomer.id)) {
      toast.error("Customer is not saved on the server yet. Create the customer again.");
      return;
    }
    const street = newProperty.address.trim();
    const city = newProperty.city.trim();
    const state = newProperty.state.trim();
    const zip = newProperty.zip.trim();
    if (!street || !city || !state || !zip) {
      toast.error("Street, city, state, and ZIP are required for the property.");
      return;
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add property.");
    } finally {
      setSavingAddress(false);
    }
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
        source: "manual",
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

      router.push(`/pro/dashboard/new-estimate/${opportunity.id}`);
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
            onClick={() => setStep(id)}
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
                disabled={!selectedCustomer || !selectedAddress}
                onClick={() => setStep("request")}
              >
                Continue
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
