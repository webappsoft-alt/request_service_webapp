"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PortalPage } from "@/components/portal/portal-page";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAreaName } from "@/lib/data/service-areas";
import { serviceCategories } from "@/lib/data/services";
import { formatWorkingDay, formatHoursValue } from "@/lib/format";

export function ProfileView() {
  const { provider } = usePortalWorkspace();
  const { officeHours } = usePortalSettings();
  const [companyName, setCompanyName] = useState(provider.companyName);
  const [tagline, setTagline] = useState(provider.tagline);
  const [description, setDescription] = useState(provider.description);
  const [phone, setPhone] = useState(provider.phone);
  const [email, setEmail] = useState(provider.email);
  const [website, setWebsite] = useState(provider.website ?? "");
  const [street, setStreet] = useState(provider.street);
  const [city, setCity] = useState(provider.city);
  const [state, setState] = useState(provider.state);
  const [zip, setZip] = useState(provider.zip);
  const [licensed, setLicensed] = useState(provider.licensed);
  const [insured, setInsured] = useState(provider.insured);
  const [categoryIds, setCategoryIds] = useState(provider.categoryIds);

  return (
    <PortalPage
      eyebrow="Public listing"
      title="Business profile"
      description="This is the same company record homeowners see on your marketplace page."
      actions={
        <Button asChild variant="outline">
          <a href={`/professionals/${provider.slug}`}>Open public page</a>
        </Button>
      }
    >
      <form
        className="grid gap-4 lg:grid-cols-[1.3fr_1fr]"
        onSubmit={(event) => {
          event.preventDefault();
          toast.success("Profile saved on this demo account. The public page will read the same fields later.");
        }}
      >
        <div className="rounded-xl border border-input bg-card p-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="company">Company name</FieldLabel>
              <Input id="company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
              <Input id="tagline" value={tagline} onChange={(event) => setTagline(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="about">Description</FieldLabel>
              <Textarea id="about" rows={6} value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="website">Website</FieldLabel>
              <Input id="website" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="street">Street address</FieldLabel>
              <Input
                id="street"
                value={street}
                onChange={(event) => setStreet(event.target.value)}
                autoComplete="street-address"
                placeholder="1644 Platte Street"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="city">City</FieldLabel>
                <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="state">State</FieldLabel>
                <Input id="state" value={state} onChange={(event) => setState(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="zip">ZIP</FieldLabel>
                <Input id="zip" value={zip} onChange={(event) => setZip(event.target.value)} />
              </Field>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={licensed} onCheckedChange={(value) => setLicensed(value === true)} />
                Licensed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={insured} onCheckedChange={(value) => setInsured(value === true)} />
                Insured
              </label>
            </div>
            <Button type="submit">Save profile</Button>
          </FieldGroup>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Services</p>
            <ul className="mt-3 flex flex-col gap-2">
              {serviceCategories.map((category) => (
                <li key={category.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={categoryIds.includes(category.id)}
                      onCheckedChange={(value) =>
                        setCategoryIds((current) =>
                          value === true
                            ? [...current, category.id]
                            : current.filter((id) => id !== category.id),
                        )
                      }
                    />
                    {category.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Service area</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {provider.serviceArea.map((zipCode) => (
                <li key={zipCode} className="rounded-md border border-input px-2.5 py-1 text-xs">
                  {getAreaName(zipCode)} · {zipCode}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Working hours</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {officeHours.map((hours) => (
                <li key={hours.day} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{formatWorkingDay(hours.day)}</span>
                  <span className="tabular-nums">{formatHoursValue(hours)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </form>
    </PortalPage>
  );
}
