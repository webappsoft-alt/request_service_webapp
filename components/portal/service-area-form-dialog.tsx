"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AddressAutocomplete, type PlaceAddress } from "@/components/shared/address-autocomplete";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  createServiceArea,
  updateServiceArea,
  type ServiceArea,
  type ServiceAreaInput,
} from "@/store/serviceAreasSlice";

type FormState = {
  title: string;
  address: string;
  city: string;
  country: string;
  zip: string;
  longitude: string;
  latitude: string;
};

const emptyForm = (): FormState => ({
  title: "",
  address: "",
  city: "",
  country: "",
  zip: "",
  longitude: "",
  latitude: "",
});

function fromArea(area: ServiceArea): FormState {
  return {
    title: area.title,
    address: area.location.address,
    city: area.location.city,
    country: area.location.country || "",
    zip: area.location.zip,
    longitude: String(area.location.coordinates[0] ?? ""),
    latitude: String(area.location.coordinates[1] ?? ""),
  };
}

function buildPayload(form: FormState): ServiceAreaInput | null {
  const title = form.title.trim();
  const address = form.address.trim();
  const city = form.city.trim();
  const country = form.country.trim();
  const zip = form.zip.trim();
  const longitude = Number(form.longitude);
  const latitude = Number(form.latitude);

  if (!title) {
    toast.error("Title is required.");
    return null;
  }
  if (!address) {
    toast.error("Location is required.");
    return null;
  }
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    toast.error("Select a location from the Google suggestions to set coordinates.");
    return null;
  }

  return {
    title,
    location: {
      type: "Point",
      coordinates: [longitude, latitude],
      city,
      country,
      address,
      zip,
    },
  };
}

export function ServiceAreaFormDialog({
  open,
  onOpenChange,
  area,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: ServiceArea | null;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const mutating = useAppSelector((state) => state.serviceAreas.mutating);
  const [form, setForm] = useState<FormState>(emptyForm);
  const isEdit = Boolean(area);

  useEffect(() => {
    if (!open) return;
    setForm(area ? fromArea(area) : emptyForm());
  }, [area, open]);

  function reset() {
    setForm(emptyForm());
  }

  function applyAddress(place: PlaceAddress) {
    setForm((current) => ({
      ...current,
      address: place.formattedAddress || place.streetAddress,
      city: place.city || current.city,
      zip: place.zipCode || current.zip,
      country: place.country || current.country,
      latitude: place.latitude != null ? String(place.latitude) : current.latitude,
      longitude: place.longitude != null ? String(place.longitude) : current.longitude,
    }));
  }

  async function save() {
    const payload = buildPayload(form);
    if (!payload) return;

    if (isEdit && area) {
      const result = await dispatch(updateServiceArea({ id: area.id, ...payload }));
      if (updateServiceArea.fulfilled.match(result)) {
        toast.success("Service area updated.");
        onOpenChange(false);
        reset();
        onSaved();
      } else {
        toast.error(
          typeof result.payload === "string"
            ? result.payload
            : "Could not update service area.",
        );
      }
      return;
    }

    const result = await dispatch(createServiceArea(payload));
    if (createServiceArea.fulfilled.match(result)) {
      toast.success("Service area added.");
      onOpenChange(false);
      reset();
      onSaved();
    } else {
      toast.error(
        typeof result.payload === "string"
          ? result.payload
          : "Could not create service area.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit service area" : "Add service area"}</DialogTitle>
          <DialogDescription>
            Define a geographic zone with address details for this account.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="sa-title">Title</FieldLabel>
            <Input
              id="sa-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Austin Downtown & Central"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sa-location">Location</FieldLabel>
            <AddressAutocomplete
              id="sa-location"
              value={form.address}
              onChange={(value) => setForm((current) => ({ ...current, address: value }))}
              onSelect={applyAddress}
              placeholder="Start typing a street address…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="sa-zip">ZIP Code</FieldLabel>
              <Input
                id="sa-zip"
                value={form.zip}
                onChange={(event) => setForm((current) => ({ ...current, zip: event.target.value }))}
                placeholder="78701"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sa-country">Country</FieldLabel>
              <Input
                id="sa-country"
                value={form.country}
                onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
                placeholder="US"
              />
            </Field>
          </div>
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutating}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={mutating}>
            {mutating ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Add area"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
