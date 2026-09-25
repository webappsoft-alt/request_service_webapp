"use client";

import {
  GoogleAddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/google-address-autocomplete";
import { CityStateZipFields } from "@/components/shared/city-state-zip-fields";
import { Field, FieldLabel } from "@/components/ui/field";
import { normalizeUsStateCode } from "@/lib/data/us-states";

export type AddressFieldsValue = {
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  /** Optional display label for the autocomplete input (defaults to address). */
  label?: string;
};

type AddressFieldsProps = {
  idPrefix: string;
  value: AddressFieldsValue;
  onChange: (next: AddressFieldsValue) => void;
  disabled?: boolean;
  required?: boolean;
  addressLabel?: string;
  addressPlaceholder?: string;
};

/**
 * Standard address block used across signup, booking, estimates, etc.
 * Order: Address → City (wide) → State (US codes) → ZIP (narrow).
 */
export function AddressFields({
  idPrefix,
  value,
  onChange,
  disabled = false,
  required = false,
  addressLabel = "Address",
  addressPlaceholder = "Start typing your address",
}: AddressFieldsProps) {
  const autocompleteValue = value.label ?? value.address;

  function applyPlace(place: PlaceAddress) {
    const streetOnly =
      place.streetAddress.trim() ||
      place.formattedAddress.split(",")[0]?.trim() ||
      "";
    onChange({
      ...value,
      // Address field = street / place line only (never city/state/ZIP).
      label: streetOnly,
      address: streetOnly,
      city: place.city || "",
      // Match US dropdown when Google's state maps to a known code; else "".
      state: normalizeUsStateCode(place.state) || "",
      zip: place.zipCode || "",
      lat:
        typeof place.latitude === "number" && Number.isFinite(place.latitude)
          ? place.latitude
          : null,
      lng:
        typeof place.longitude === "number" && Number.isFinite(place.longitude)
          ? place.longitude
          : null,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-address`}>{addressLabel}</FieldLabel>
        <GoogleAddressAutocomplete
          id={`${idPrefix}-address`}
          value={autocompleteValue}
          onChange={(next) =>
            onChange({
              ...value,
              label: next,
              address: next,
            })
          }
          onSelect={applyPlace}
          placeholder={addressPlaceholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
        />
      </Field>

      <CityStateZipFields
        idPrefix={idPrefix}
        value={{
          city: value.city,
          state: value.state,
          zip: value.zip,
        }}
        onChange={(next) => onChange({ ...value, ...next })}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}
