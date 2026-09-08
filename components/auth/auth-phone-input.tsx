"use client";

import type { InputHTMLAttributes } from "react";
import PhoneInputLib from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

import { cn } from "@/lib/utils";

type AuthPhoneInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
};

/**
 * Reusable phone field (react-phone-input-2) for Customer + Pro auth and profile.
 * Default country: USA (+1). Value stored as E.164-style `+…` when present.
 */
export function AuthPhoneInput({
  id,
  value,
  onChange,
  placeholder = "Enter phone number",
  disabled,
  required,
  className,
  inputProps,
}: AuthPhoneInputProps) {
  const digits = value.replace(/^\+/, "").replace(/\D/g, "");

  return (
    <div className={cn("rs-phone-input", className)}>
      <PhoneInputLib
        country="us"
        preferredCountries={["us", "ca", "gb", "au", "pk"]}
        value={digits}
        onChange={(next) => {
          const cleaned = String(next || "").replace(/\D/g, "");
          onChange(cleaned ? `+${cleaned}` : "");
        }}
        disabled={disabled}
        enableSearch
        disableSearchIcon
        countryCodeEditable={false}
        placeholder={placeholder}
        specialLabel=""
        inputProps={{
          id,
          name: inputProps?.name || "phone",
          required,
          autoComplete: "tel",
          ...inputProps,
        }}
        containerClass="rs-phone-container"
        inputClass="rs-phone-field"
        buttonClass="rs-phone-button"
        dropdownClass="rs-phone-dropdown"
        searchClass="rs-phone-search"
      />
    </div>
  );
}
