"use client";

import { CityStateZipFields } from "@/components/shared/city-state-zip-fields";
import { GoogleAddressAutocomplete } from "@/components/shared/google-address-autocomplete";
import { Field, FieldLabel } from "@/components/ui/field";
import type { PortalPersonAddress } from "@/lib/data/portal";
import { normalizeUsStateCode } from "@/lib/data/us-states";

/**
 * Location address for people (employees, contractors): Google street autocomplete
 * plus the shared City / State / ZIP row.
 */
export function PersonAddressFields({
  idPrefix,
  value,
  onChange,
  label = "Location address",
  disabled = false,
}: {
  idPrefix: string;
  value: PortalPersonAddress;
  onChange: (next: PortalPersonAddress) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-street`}>{label}</FieldLabel>
        <GoogleAddressAutocomplete
          id={`${idPrefix}-street`}
          value={value.street}
          disabled={disabled}
          // Typing by hand drops coordinates picked earlier from a suggestion.
          onChange={(street) => onChange({ ...value, street, latitude: null, longitude: null })}
          onSelect={(address) =>
            onChange({
              street: address.streetAddress.trim(),
              city: address.city || value.city,
              state: normalizeUsStateCode(address.state) || value.state,
              zip: address.zipCode || value.zip,
              latitude: address.latitude ?? null,
              longitude: address.longitude ?? null,
            })
          }
          placeholder="Start typing a street address…"
        />
      </Field>
      <CityStateZipFields
        idPrefix={idPrefix}
        disabled={disabled}
        value={{ city: value.city, state: value.state, zip: value.zip }}
        onChange={(next) => onChange({ ...value, ...next })}
      />
    </div>
  );
}
