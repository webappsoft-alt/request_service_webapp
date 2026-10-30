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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  SearchableMultiSelect,
  SearchableSelect,
} from "@/components/ui/searchable-select";
import { normalizeUsStateCode, US_STATES } from "@/lib/data/us-states";
import { searchUsCities, type UsCity } from "@/lib/api/us-cities-client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  createServiceAreas,
  updateServiceArea,
  type ServiceArea,
} from "@/store/serviceAreasSlice";

const STATE_OPTIONS = US_STATES.map((state) => ({
  value: state.code,
  label: `${state.name} (${state.code})`,
}));

/** Every city / town in a state, largest first (cached per state while the page is open). */
const citiesByState = new Map<string, Promise<UsCity[]>>();
function loadStateCities(state: string) {
  let pending = citiesByState.get(state);
  if (!pending) {
    pending = searchUsCities("", { state, limit: 5000 }).catch((error) => {
      citiesByState.delete(state);
      throw error;
    });
    citiesByState.set(state, pending);
  }
  return pending;
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
              ? "Change the city for this service area."
              : "Choose a state, then every city you serve in it."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted per open so it starts from the area (or profile state) each time. */}
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

  const profileState = normalizeUsStateCode(
    typeof provider?.location?.state === "string" ? provider.location.state : "",
  );

  const [state, setState] = useState(
    () => normalizeUsStateCode(area?.location.state) || profileState || "",
  );
  const [cityNames, setCityNames] = useState<string[]>(() =>
    area?.location.city ? [area.location.city] : [],
  );

  const [loaded, setLoaded] = useState<{ state: string; rows: UsCity[] } | null>(null);
  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    loadStateCities(state)
      .then((rows) => {
        if (!cancelled) setLoaded({ state, rows });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ state, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [state]);
  const citiesLoading = Boolean(state) && loaded?.state !== state;

  const cityOptions = useMemo(() => {
    const rows = loaded?.state === state ? loaded.rows : [];
    const options = rows.map((row) => ({
      value: row.name,
      label: row.name,
      description: row.zipCount ? `${row.zipCount} ZIP Codes` : undefined,
    }));
    // Keep the edited city listed so its label shows while the list loads.
    for (const name of cityNames) {
      if (!options.some((option) => option.value === name)) options.unshift({ value: name, label: name, description: undefined });
    }
    return options;
  }, [loaded, state, cityNames]);

  async function save() {
    if (!state) {
      toast.error("Select a state.");
      return;
    }
    if (!cityNames.length) {
      toast.error("Select at least one city.");
      return;
    }

    if (isEdit && area) {
      const result = await dispatch(updateServiceArea({ id: area.id, city: cityNames[0], state }));
      if (updateServiceArea.fulfilled.match(result)) {
        toast.success("Service area updated.");
        onClose();
        onSaved();
      } else {
        toast.error(typeof result.payload === "string" ? result.payload : "Could not update service area.");
      }
      return;
    }

    const result = await dispatch(createServiceAreas({ state, cityNames }));
    if (createServiceAreas.fulfilled.match(result)) {
      toast.success(
        cityNames.length === 1
          ? `${cityNames[0]}, ${state} added.`
          : `${cityNames.length} cities in ${state} added.`,
      );
      onClose();
      onSaved();
      return;
    }
    toast.error(typeof result.payload === "string" ? result.payload : "Could not add service areas.");
  }

  const cityPlaceholder = !state
    ? "Select a state first"
    : citiesLoading
      ? "Loading cities…"
      : isEdit
        ? "Search or select a city…"
        : "Search or select cities…";

  return (
    <>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="sa-state">State</FieldLabel>
          <SearchableSelect
            id="sa-state"
            options={STATE_OPTIONS}
            value={state || null}
            onChange={(value) => {
              setState(value || "");
              setCityNames([]);
            }}
            placeholder="Select a state…"
            emptyMessage="No US state by that name."
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="sa-cities">{isEdit ? "City" : "Cities"}</FieldLabel>
          {isEdit ? (
            <SearchableSelect
              id="sa-cities"
              options={cityOptions}
              value={cityNames[0] || null}
              onChange={(value) => setCityNames(value ? [value] : [])}
              maxResults={200}
              disabled={!state || citiesLoading}
              placeholder={cityPlaceholder}
              emptyMessage="No city by that name in this state."
            />
          ) : (
            <SearchableMultiSelect
              id="sa-cities"
              keepOpen
              options={cityOptions}
              value={cityNames}
              onChange={setCityNames}
              maxResults={200}
              disabled={!state || citiesLoading}
              placeholder={cityPlaceholder}
              emptyMessage="No city by that name in this state."
            />
          )}
          <FieldDescription>
            Customers in these cities can find you and send you requests. Every ZIP Code
            in a city is covered.
          </FieldDescription>
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
            : cityNames.length > 1
              ? `Add ${cityNames.length} cities`
              : "Add city"}
        </Button>
      </DialogFooter>
    </>
  );
}
