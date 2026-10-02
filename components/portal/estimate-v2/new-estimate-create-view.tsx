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
import { crmCustomerName, type PortalCustomerCrm } from "@/lib/data/crm-people";
import {
  createEstimateV2Opportunity,
  updateEstimateV2Opportunity,
  createEstimateV2SiteAssessment,
  type PrepChoice,
} from "@/lib/api/estimate-v2-client";
import { updateCustomer } from "@/lib/api/crm-client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import { fetchCustomers } from "@/store/customersSlice";
import { cn } from "@/lib/utils";

const SERVICE_CATEGORIES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Painting",
  "Remodeling",
  "Roofing",
  "Other",
];

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
  const reduxCustomers = useAppSelector((state) => state.customers?.items || []);
  const customersLoading = useAppSelector((state) => Boolean(state.customers?.loading));
  const { customers: directoryCustomers } = useCrmDirectory();

  const [step, setStep] = useState<Step>("customer");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<PortalCustomerCrm[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [addressId, setAddressId] = useState("");

  const [newStreet, setNewStreet] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newZip, setNewZip] = useState("");

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
    if (!selectedCustomer) {
      setAddressId("");
      return;
    }
    const preferred = addresses[0]?.id || "";
    setAddressId((prev) => (prev && addresses.some((a) => a.id === prev) ? prev : preferred));
  }, [selectedCustomer?.id, addresses]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAddress = addresses.find((item) => item.id === addressId) || addresses[0];

  async function addPropertyToCustomer() {
    if (!selectedCustomer) return;
    if (!newStreet.trim() || !newCity.trim()) {
      toast.error("Street and city are required for the property.");
      return;
    }
    setSavingAddress(true);
    try {
      const nextAddress = {
        id: `addr_${Date.now().toString(36)}`,
        label: "Service location",
        address: newStreet.trim(),
        street: newStreet.trim(),
        city: newCity.trim(),
        state: newState.trim(),
        zip: newZip.trim(),
        country: "US",
        lat: null,
        lng: null,
        latitude: null,
        longitude: null,
      };
      const updated = await updateCustomer(selectedCustomer.id, {
        ...selectedCustomer,
        addresses: [...(selectedCustomer.addresses || []), nextAddress],
      });
      const saved = updated || {
        ...selectedCustomer,
        addresses: [...(selectedCustomer.addresses || []), nextAddress],
      };
      setLocalCustomers((prev) => {
        const others = prev.filter((item) => item.id !== saved.id);
        return [...others, saved];
      });
      setCustomerId(saved.id);
      setAddressId(saved.addresses?.[saved.addresses.length - 1]?.id || nextAddress.id);
      setNewStreet("");
      setNewCity("");
      setNewState("");
      setNewZip("");
      toast.success("Property added.");
      void dispatch(fetchCustomers({ force: true, limit: 100 }));
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
        await createEstimateV2SiteAssessment(opportunity.id, {
          status: "scheduled",
          instructions: description.trim() || title.trim(),
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
                <div className="grid gap-2">
                  <Input
                    placeholder="Street address"
                    value={newStreet}
                    onChange={(e) => setNewStreet(e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="City"
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                    />
                    <Input
                      placeholder="State"
                      value={newState}
                      onChange={(e) => setNewState(e.target.value)}
                    />
                    <Input
                      placeholder="ZIP"
                      value={newZip}
                      onChange={(e) => setNewZip(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={savingAddress}
                    onClick={() => void addPropertyToCustomer()}
                  >
                    {savingAddress ? "Saving…" : "Add property"}
                  </Button>
                </div>
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
                  <div className="mt-2 grid gap-2">
                    <Input
                      placeholder="Street address"
                      value={newStreet}
                      onChange={(e) => setNewStreet(e.target.value)}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="City"
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                      />
                      <Input
                        placeholder="State"
                        value={newState}
                        onChange={(e) => setNewState(e.target.value)}
                      />
                      <Input
                        placeholder="ZIP"
                        value={newZip}
                        onChange={(e) => setNewZip(e.target.value)}
                      />
                    </div>
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
              <Select value={categoryName || undefined} onValueChange={setCategoryName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button size="sm" disabled={!title.trim()} onClick={() => setStep("prep")}>
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
          if (customer?.id) {
            setLocalCustomers((prev) => {
              const others = prev.filter((item) => item.id !== customer.id);
              return [...others, customer];
            });
            setCustomerId(customer.id);
            setCustomerQuery(crmCustomerName(customer));
            void dispatch(fetchCustomers({ force: true, limit: 100 }));
          }
          toast.success("Customer created. Select a property to continue.");
        }}
      />
    </PortalPage>
  );
}
