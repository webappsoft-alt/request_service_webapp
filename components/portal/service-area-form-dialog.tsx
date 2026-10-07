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
  areasForServiceAreaCity,
  cityServiceAreaKey,
  type CityServiceAreaNeighborhood,
} from "@/lib/data/city-service-areas";
import { normalizeUsStateCode } from "@/lib/data/us-states";
import {
  getUsCityAreas,
  searchUsCities,
  type UsCityAreas,
} from "@/lib/api/us-cities-client";
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

type CityChoice = { city: string; state: string };

/**
 * Main areas of a city: curated neighborhoods, the city itself, nearby suburbs,
 * then ZIP (postal) areas. Areas already saved on this service area stay listed.
 */
function buildAreaChoices(
  data: UsCityAreas | null,
  city: CityChoice,
  saved: CityServiceAreaNeighborhood[],
): CityServiceAreaNeighborhood[] {
  const choices = new Map<string, CityServiceAreaNeighborhood>();
  const add = (choice: CityServiceAreaNeighborhood) => {
    const key = choice.name.trim().toLowerCase();
    if (key && !choices.has(key)) choices.set(key, choice);
  };

  for (const item of areasForServiceAreaCity(city.city, city.state)) add(item);
  if (data) add({ name: data.city.name, lat: data.city.lat, lng: data.city.lng });
  for (const item of data?.suburbs || []) add({ name: item.name, lat: item.lat, lng: item.lng });
  for (const item of data?.zips || []) add({ name: `ZIP ${item.zip}`, lat: item.lat, lng: item.lng, zip: item.zip });
  for (const item of saved) add(item);
  return [...choices.values()];
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
  const isEdit = Boolean(area);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        {/* Mounted per open so it starts from the area (or profile city) each time. */}
        {open ? (
          <ServiceAreaFormBody
            area={area}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ServiceAreaFormBody({
  area,
  onClose,
  onSaved,
}: {
  area: ServiceArea | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const mutating = useAppSelector((state) => state.serviceAreas.mutating);
  const provider = useAppSelector((state) => state.auth.provider);
  const isEdit = Boolean(area);

  const profileCity = String(provider?.location?.city || "").trim();
  const profileState = normalizeUsStateCode(
    typeof provider?.location?.state === "string" ? provider.location.state : "",
  );

  const [city, setCity] = useState<CityChoice | null>(() =>
    area?.location.city && area.location.state
      ? { city: area.location.city, state: normalizeUsStateCode(area.location.state) || area.location.state }
      : null,
  );
  const [selectedAreaNames, setSelectedAreaNames] = useState<string[]>(() =>
    area ? (area.areas?.length ? area.areas.map((item) => item.name) : area.title ? [area.title] : []) : [],
  );

  // New area: start on the provider's business city when the city list has it.
  useEffect(() => {
    if (area || !profileCity || !profileState) return;
    let cancelled = false;
    searchUsCities(`${profileCity}, ${profileState}`, { limit: 5 })
      .then((rows) => {
        const match = rows.find((row) => row.name.toLowerCase() === profileCity.toLowerCase());
        if (!cancelled && match) setCity((current) => current || { city: match.name, state: match.state });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [area, profileCity, profileState]);

  // City search runs on the backend (every US city / town); results keyed by query.
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [query]);
  const [results, setResults] = useState<{ query: string; rows: CityChoice[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Empty search: the largest cities in the provider's state (or the US).
    searchUsCities(debouncedQuery, { state: debouncedQuery ? undefined : profileState || undefined })
      .then((rows) => {
        if (!cancelled) {
          setResults({ query: debouncedQuery, rows: rows.map((row) => ({ city: row.name, state: row.state })) });
        }
      })
      .catch(() => {
        if (!cancelled) setResults({ query: debouncedQuery, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, profileState]);
  const searching = query.trim() !== debouncedQuery || results?.query !== debouncedQuery;

  const cityOptions = useMemo(() => {
    const rows = [...(results?.rows || [])];
    // Keep the picked city listed so its label shows.
    if (city && !rows.some((row) => cityServiceAreaKey(row.city, row.state) === cityServiceAreaKey(city.city, city.state))) {
      rows.unshift(city);
    }
    return rows.map((row) => ({
      value: cityServiceAreaKey(row.city, row.state),
      label: `${row.city}, ${row.state}`,
    }));
  }, [results, city]);

  // Main areas of the picked city.
  const areaKey = city ? cityServiceAreaKey(city.city, city.state) : "";
  const [areasResult, setAreasResult] = useState<{ key: string; data: UsCityAreas | null } | null>(null);
  useEffect(() => {
    if (!city) return;
    const key = cityServiceAreaKey(city.city, city.state);
    let cancelled = false;
    getUsCityAreas(city.state, city.city)
      .then((data) => {
        if (!cancelled) setAreasResult({ key, data });
      })
      .catch(() => {
        if (!cancelled) setAreasResult({ key, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [city]);
  const areasData = areasResult?.key === areaKey ? areasResult.data : null;
  const areasLoading = Boolean(areaKey) && areasResult?.key !== areaKey;

  const cityAreas = useMemo(
    () => (city ? buildAreaChoices(areasData, city, isEdit ? area?.areas || [] : []) : []),
    [city, areasData, isEdit, area?.areas],
  );
  const areaOptions = useMemo(
    () => cityAreas.map((entry) => ({ value: entry.name, label: entry.name })),
    [cityAreas],
  );

  async function save() {
    if (!city) {
      toast.error("Select a city.");
      return;
    }

    const chosen = cityAreas.filter((item) => selectedAreaNames.includes(item.name));
    if (!chosen.length) {
      toast.error("Select at least one area.");
      return;
    }

    const payload = buildCityAreasPayload(city.city, city.state, chosen);

    if (isEdit && area) {
      const primary = payload.areas[0];
      const result = await dispatch(
        updateServiceArea({
          id: area.id,
          title: `${city.city}, ${city.state}`,
          areas: payload.areas,
          location: {
            type: "Point",
            coordinates: [primary.lng, primary.lat],
            city: city.city,
            state: city.state,
            country: "US",
            address: `${city.city}, ${city.state}`,
            zip: primary.zip || "",
          },
        }),
      );
      if (updateServiceArea.fulfilled.match(result)) {
        toast.success("Service area updated.");
        onClose();
        onSaved();
      } else {
        toast.error(typeof result.payload === "string" ? result.payload : "Could not update service area.");
      }
      return;
    }

    const result = await dispatch(createServiceAreas(payload));
    if (createServiceAreas.fulfilled.match(result)) {
      toast.success(`${city.city} added with ${payload.areas.length} area${payload.areas.length === 1 ? "" : "s"}.`);
      onClose();
      onSaved();
      return;
    }

    toast.error(typeof result.payload === "string" ? result.payload : "Could not create service areas.");
  }

  return (
    <>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="sa-city">City</FieldLabel>
          <SearchableSelect
            id="sa-city"
            options={cityOptions}
            value={areaKey || null}
            onChange={(value) => {
              const [name, state] = String(value || "").split("|");
              setCity(name && state ? { city: name, state } : null);
              setSelectedAreaNames([]);
            }}
            onSearchChange={setQuery}
            loading={searching}
            placeholder="Search or select a city…"
            emptyMessage="No US city by that name."
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
            maxResults={150}
            disabled={!city || areasLoading}
            placeholder={
              !city ? "Select a city first" : areasLoading ? "Loading areas…" : "Search or select areas…"
            }
          />
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutating}>
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
    </>
  );
}
