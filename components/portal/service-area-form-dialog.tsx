"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  SearchableMultiSelect,
  SearchableSelect,
} from "@/components/ui/searchable-select";
import {
  CITY_SERVICE_AREAS,
  cityServiceAreaKey,
  findServiceAreaCity,
  type CityServiceAreaNeighborhood,
} from "@/lib/data/city-service-areas";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  createServiceAreas,
  updateServiceArea,
  type ServiceArea,
  type CityServiceAreasPayload,
} from "@/store/serviceAreasSlice";

/** Merge selected neighborhoods under one city object. */
function buildCityAreasPayload(
  city: string,
  state: string,
  areas: CityServiceAreaNeighborhood[],
): CityServiceAreasPayload {
  const seen = new Set<string>();
  const merged: CityServiceAreasPayload["areas"] = [];

  for (const area of areas) {
    const name = area.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      name,
      lat: area.lat,
      lng: area.lng,
      ...(area.zip ? { zip: area.zip } : {}),
    });
  }

  return { city, state, areas: merged };
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
  const provider = useAppSelector((state) => state.auth.provider);
  const isEdit = Boolean(area);

  const [cityKey, setCityKey] = useState("");
  const [selectedAreaNames, setSelectedAreaNames] = useState<string[]>([]);

  const cityOptions = useMemo(
    () =>
      CITY_SERVICE_AREAS.map((entry) => ({
        value: cityServiceAreaKey(entry.city, entry.state),
        label: `${entry.city}, ${entry.state}`,
      })),
    [],
  );

  const selectedCity = useMemo(
    () =>
      CITY_SERVICE_AREAS.find(
        (entry) => cityServiceAreaKey(entry.city, entry.state) === cityKey,
      ),
    [cityKey],
  );

  const cityAreas = selectedCity?.areas ?? [];

  const areaOptions = useMemo(
    () =>
      cityAreas.map((entry) => ({
        value: entry.name,
        label: entry.name,
      })),
    [cityAreas],
  );

  useEffect(() => {
    if (!open) return;

    if (area) {
      const matched = findServiceAreaCity(
        area.location.city,
        area.location.state,
      );
      const key = matched
        ? cityServiceAreaKey(matched.city, matched.state)
        : "";
      setCityKey(key);
      const names =
        area.areas?.length > 0
          ? area.areas.map((item) => item.name)
          : area.title
            ? [area.title]
            : [];
      setSelectedAreaNames(names);
      return;
    }

    const profileCity = provider?.location?.city;
    const profileState =
      typeof provider?.location?.state === "string"
        ? provider.location.state
        : undefined;
    const matched = findServiceAreaCity(profileCity, profileState);
    setCityKey(matched ? cityServiceAreaKey(matched.city, matched.state) : "");
    setSelectedAreaNames([]);
  }, [area, open, provider?.location?.city, provider?.location?.state]);

  function reset() {
    setCityKey("");
    setSelectedAreaNames([]);
  }

  async function save() {
    if (!selectedCity) {
      toast.error("Select a city.");
      return;
    }

    const chosen = cityAreas.filter((item) =>
      selectedAreaNames.includes(item.name),
    );
    if (!chosen.length) {
      toast.error("Select at least one area.");
      return;
    }

    const payload = buildCityAreasPayload(
      selectedCity.city,
      selectedCity.state,
      chosen,
    );

    if (isEdit && area) {
      const primary = payload.areas[0];
      const result = await dispatch(
        updateServiceArea({
          id: area.id,
          title: `${selectedCity.city}, ${selectedCity.state}`,
          areas: payload.areas,
          location: {
            type: "Point",
            coordinates: [primary.lng, primary.lat],
            city: selectedCity.city,
            state: selectedCity.state,
            country: "US",
            address: `${selectedCity.city}, ${selectedCity.state}`,
            zip: primary.zip || "",
          },
        }),
      );
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

    const result = await dispatch(createServiceAreas(payload));
    if (createServiceAreas.fulfilled.match(result)) {
      toast.success(
        `${selectedCity.city} added with ${payload.areas.length} area${
          payload.areas.length === 1 ? "" : "s"
        }.`,
      );
      onOpenChange(false);
      reset();
      onSaved();
      return;
    }

    toast.error(
      typeof result.payload === "string"
        ? result.payload
        : "Could not create service areas.",
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit service area" : "Add service area"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the city and neighborhoods for this service area."
              : "Choose a city, then select one or more areas to cover."}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="sa-city">City</FieldLabel>
            <SearchableSelect
              id="sa-city"
              options={cityOptions}
              value={cityKey || null}
              onChange={(value) => {
                setCityKey(value || "");
                setSelectedAreaNames([]);
              }}
              placeholder="Search or select a city…"
              disabled={isEdit}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="sa-areas">Areas</FieldLabel>
            <SearchableMultiSelect
              id="sa-areas"
              options={areaOptions}
              value={selectedAreaNames}
              onChange={setSelectedAreaNames}
              disabled={!selectedCity}
              placeholder={
                selectedCity
                  ? "Search or select areas…"
                  : "Select a city first"
              }
            />
          </Field>
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
            {isEdit
              ? "Save changes"
              : selectedAreaNames.length > 1
                ? `Add ${selectedAreaNames.length} areas`
                : "Add area"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
