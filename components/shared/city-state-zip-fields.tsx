"use client";

import type { Ref } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UsStateSelect } from "@/components/shared/us-state-select";
import { normalizeUsStateCode } from "@/lib/data/us-states";

export type CityStateZipValue = {
  city: string;
  state: string;
  zip: string;
};

type CityStateZipFieldsProps = {
  idPrefix: string;
  value: CityStateZipValue;
  onChange: (next: CityStateZipValue) => void;
  disabled?: boolean;
  required?: boolean;
  zipRef?: Ref<HTMLInputElement>;
};

/**
 * Shared City (wide) + State (searchable US codes) + ZIP (narrow) row.
 */
export function CityStateZipFields({
  idPrefix,
  value,
  onChange,
  disabled = false,
  required = false,
  zipRef,
}: CityStateZipFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(6.5rem,0.7fr)_minmax(5rem,0.55fr)]">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-city`}>City</FieldLabel>
        <Input
          id={`${idPrefix}-city`}
          value={value.city}
          onChange={(event) =>
            onChange({ ...value, city: event.target.value })
          }
          placeholder="City"
          required={required}
          disabled={disabled}
          autoComplete="address-level2"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-state`}>State</FieldLabel>
        <UsStateSelect
          id={`${idPrefix}-state`}
          value={normalizeUsStateCode(value.state)}
          onChange={(code) => onChange({ ...value, state: code })}
          disabled={disabled}
          required={required}
          placeholder="State"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-zip`}>ZIP</FieldLabel>
        <Input
          ref={zipRef}
          id={`${idPrefix}-zip`}
          value={value.zip}
          onChange={(event) =>
            onChange({ ...value, zip: event.target.value })
          }
          placeholder="ZIP"
          disabled={disabled}
          autoComplete="postal-code"
          inputMode="numeric"
          className="max-w-full"
        />
      </Field>
    </div>
  );
}
